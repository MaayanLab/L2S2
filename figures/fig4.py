
#%%
import pandas as pd
import os
import json
import pyenrichr as pye
from tqdm import tqdm
import numpy as np
from numba import float64, int64, njit, prange
import matplotlib.pyplot as plt
from sklearn.metrics import roc_curve, auc
import pathlib

fig_dir = pathlib.Path('figures')/'fig4'
fig_dir.mkdir(parents=True, exist_ok=True)


# %%
@njit(parallel=True)
def get_p_value_list(fisher, contingency_tables):
    num_tests = contingency_tables.shape[0]
    results = np.empty(num_tests, dtype=np.float64)
    for i in prange(num_tests):
        a, b, c, d = contingency_tables[i]
        p_value = fisher.get_p_value(a, b, c, d)
        results[i] = p_value
    return results

# %%
with open('../data/counts_genes.json') as f:
    counts = json.load(f)
    
with open('../data/counts_perts.json') as f:
    counts_perts = json.load(f)

counts.update(counts_perts)


#%%
fisher = pye.enrichment.FastFisher(44000)
def compute_consensus_stats_up_dn(enrich_df):
    # Ensure 'is_up' and 'is_down' columns exist
    enrich_df = enrich_df.assign(
        is_mimicker=enrich_df['pvalue_mimic'] < 0.05,
        is_reverser=enrich_df['pvalue_reverse'] < 0.05
    )

    # Filter for 'pert' values in counts
    enrich_df = enrich_df[enrich_df['pert'].isin(counts)]
    
    # Precompute total_n
    enrich_df['total_n'] = enrich_df['pert'].map(counts)

    # Group by 'pert' and compute aggregates
    grouped = enrich_df.groupby('pert').agg(
        a_up=('is_mimicker', 'sum'),
        b_up=('is_reverser', 'sum'),
        total_n=('total_n', 'first')  # All rows in the same group have the same total_n
    ).reset_index()

    # Compute additional columns for Fisher's test
    grouped['a_down'] = (grouped['total_n'] // 2) - grouped['a_up']
    grouped['b_down'] = (grouped['total_n'] // 2) - grouped['b_up']

    # Create contingency tables
    contingency_tables = grouped[['a_up', 'b_up', 'a_down', 'b_down']].to_numpy(dtype=np.int64)

    # Compute p-values using the FastFisher instance
    p_values_up = get_p_value_list(fisher, contingency_tables)
    p_values_down = get_p_value_list(
        fisher, contingency_tables[:, [1, 0, 3, 2]]  # Swap a/b and c/d for down test
    )

    # Append results to the DataFrame
    grouped['pvalue_mimicker'] = p_values_up
    grouped['pvalue_reverser'] = p_values_down

    # Return the final DataFrame
    return grouped[['pert', 'pvalue_mimicker', 'pvalue_reverser']]

def get_consensus_ranking_dicts(dir, positive_func):

    ranking_dict = {
        #"pvalue_mimicker_500": {"scores": [], "labels": []},
        #"pvalue_mimicker_1000": {"scores": [], "labels": []},
        "pvalue_mimicker_5000": {"scores": [], "labels": []},    
        #"pvalue_mimicker_10000": {"scores": [], "labels": []},
        "pvalue_mimicker_20000": {"scores": [], "labels": []},
        #"pvalue_mimicker_40000": {"scores": [], "labels": []},
        "pvalue_mimicker_50000": {"scores": [], "labels": []},
    }

    for file in tqdm(os.listdir(dir)): 
        enrich_df = pd.read_csv(f'{dir}/{file}', sep='\t', index_col=0)
        enrich_df['pert'] = enrich_df['sig'].map(lambda term: term.split('_')[4])
        enrich_df = enrich_df[enrich_df['pvalue_mimic'] < 0.05]
        enrich_df.sort_values('pvalue_mimic', inplace=True)
        enrich_df.reset_index(inplace=True, drop=True)
        for topn in [5000, 20000, 50000]:
            consensus_table = compute_consensus_stats_up_dn(enrich_df[:topn])
            consensus_table['hit'] = consensus_table['pert'].map(positive_func)
            consensus_table.sort_values('pvalue_mimicker', inplace=True)
            consensus_table.reset_index(inplace=True, drop=True)
            consensus_table['scores'] = 1 -  ((consensus_table.index.values + 1) / len(consensus_table))
           
            ranking_dict[f'pvalue_mimicker_{topn}']["labels"].extend(consensus_table['hit'].values)
            ranking_dict[f'pvalue_mimicker_{topn}']["scores"].extend(consensus_table['scores'].values)
    return ranking_dict



def get_mw_ks_ranking_dicts(dir, positive_func):
    
    mw_ks_ranking_dict = {
        "pvalue": {"scores": [], "labels": []}
    }
    
    for f in tqdm(os.listdir(dir)):
        if 'mimickers_' in f:
            df = pd.read_csv(f'{dir}/{f}', sep='\t', index_col=0).rename(columns={'total sigs': 'count'})
            df = df[df['p-value'] < 0.05]
            df.sort_values(by='p-value', inplace=True, ascending=True)
            df.index.name = 'term'
            df.reset_index(drop=False, inplace=True)
            df['labels'] = [1 if positive_func(x.split()[0].lower()) else 0 for x in df['term']]
            df['scores'] = 1 -  ((df.index.values) / len(df))
            mw_ks_ranking_dict['pvalue']['scores'].extend(list(df['scores']))
            mw_ks_ranking_dict['pvalue']['labels'].extend(list(df['labels']))
    return mw_ks_ranking_dict
#%%

all_counts = pd.read_csv(f"data/dex_l1000_ranker/mw/mw0b4d450290.tsv", sep='\t').rename(columns={'total sigs': 'count', 'Unnamed: 0': 'term'})[['term', 'count']]
all_counts
len(all_counts)
#%%
def plot_ranking_dicts(ranking_dicts, save=None):
    plt.figure(figsize=(10, 8))
    for ranking_dict_name in ranking_dicts:
        ranking_dict = ranking_dicts[ranking_dict_name]
        for m in ranking_dict.keys():  
            fpr, tpr, thresholds = roc_curve(ranking_dict[m]['labels'], ranking_dict[m]['scores'])
            roc_auc = auc(fpr, tpr)
            plt.plot(fpr, tpr, lw=2, label=f'{ranking_dict_name} {m} (AUC = {roc_auc:.2f})')
            plt.xlabel('False Positive Rate')
            plt.ylabel('True Positive Rate')
            plt.legend(loc='lower right')
            plt.grid(alpha=0.3)
    plt.plot([0, 1], [0, 1], color='gray', linestyle='--', label='Random')
    if save:
        plt.savefig(save, dpi=300, bbox_inches='tight')
    plt.show()

#%%        
dex_ranking_dict = get_consensus_ranking_dicts('data/dex_pair_enrichment', lambda x: "dexamethasone" in x)

#%%
dex_mw_ranking_dict = get_mw_ks_ranking_dicts('data/dex_l1000_ranker/mw', lambda x: "dexamethasone" in x)
dex_ks_uniform2t_ranking_dict = get_mw_ks_ranking_dicts('data/dex_l1000_ranker/ks/uniform_2t', lambda x: "dexamethasone" in x)
dex_ks_norm2t_ranking_dict = get_mw_ks_ranking_dicts('data/dex_l1000_ranker/ks/norm_2t', lambda x: "dexamethasone" in x)
#%%
plot_ranking_dicts({'Up-Down Top N': dex_ranking_dict, 'MW': dex_mw_ranking_dict, 'KS Uniform 2T': dex_ks_uniform2t_ranking_dict, 'KS Norm 2T': dex_ks_norm2t_ranking_dict}, save= fig_dir / 'fig4a.pdf')
plot_ranking_dicts({'Up-Down Top N': dex_ranking_dict, 'MW': dex_mw_ranking_dict, 'KS Uniform 2T': dex_ks_uniform2t_ranking_dict, 'KS Norm 2T': dex_ks_norm2t_ranking_dict}, save= fig_dir /'fig4a.png')

# %%
thiazolidinedione_ranking_dict = get_consensus_ranking_dicts('data/thiazolidinedione_pair_enrichment', lambda x:'rosiglitazone' in x or 'pioglitazone' in x)

# %%
thiazolidinedione_mw_ranking_dict = get_mw_ks_ranking_dicts('data/thiazolidinedione_l1000_ranker/mw', lambda x: 'rosiglitazone' in x or 'pioglitazone' in x)
thiazolidinedione_ks_uniform2t_ranking_dict = get_mw_ks_ranking_dicts('data/thiazolidinedione_l1000_ranker/ks/uniform_2t', lambda x: 'rosiglitazone' in x or 'pioglitazone' in x)
thiazolidinedione_ks_norm2t_ranking_dict = get_mw_ks_ranking_dicts('data/thiazolidinedione_l1000_ranker/ks/norm_2t', lambda x: 'rosiglitazone' in x or 'pioglitazone' in x)

#%%
plot_ranking_dicts({'Up-Down Top N': thiazolidinedione_ranking_dict, 'MW': thiazolidinedione_mw_ranking_dict, 'KS Uniform 2T': thiazolidinedione_ks_uniform2t_ranking_dict, 'KS Norm 2T': thiazolidinedione_ks_norm2t_ranking_dict}, save= fig_dir / 'fig4b.pdf')
plot_ranking_dicts({'Up-Down Top N': thiazolidinedione_ranking_dict, 'MW': thiazolidinedione_mw_ranking_dict, 'KS Uniform 2T': thiazolidinedione_ks_uniform2t_ranking_dict, 'KS Norm 2T': thiazolidinedione_ks_norm2t_ranking_dict}, save= fig_dir / 'fig4b.png')
# %%

#%%
tamoxifen_ranking_dict = get_consensus_ranking_dicts('data/tamoxifen_pair_enrichment', lambda x: 'tamoxifen' in x)
# %%
tamoxifen_mw_ranking_dict = get_mw_ks_ranking_dicts('data/tamoxifen_l1000_ranker/mw', lambda x: 'tamoxifen' in x)
tamoxifen_ks_uniform2t_ranking_dict = get_mw_ks_ranking_dicts('data/tamoxifen_l1000_ranker/ks/uniform_2t', lambda x: 'tamoxifen' in x)
tamoxifen_ks_norm2t_ranking_dict = get_mw_ks_ranking_dicts('data/tamoxifen_l1000_ranker/ks/norm_2t', lambda x: 'tamoxifen' in x)
# %%
plot_ranking_dicts({'Up-Down Top N': tamoxifen_ranking_dict, 'MW': tamoxifen_mw_ranking_dict, 'KS Uniform 2T': tamoxifen_ks_uniform2t_ranking_dict, 'KS Norm 2T': tamoxifen_ks_norm2t_ranking_dict}, save= fig_dir / 'fig4c.pdf')
plot_ranking_dicts({'Up-Down Top N': tamoxifen_ranking_dict, 'MW': tamoxifen_mw_ranking_dict, 'KS Uniform 2T': tamoxifen_ks_uniform2t_ranking_dict, 'KS Norm 2T': tamoxifen_ks_norm2t_ranking_dict}, save= fig_dir / 'fig4c.png')
# %%
