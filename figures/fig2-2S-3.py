
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

fig_dir = pathlib.Path('figures')/'fig2'
fig_dir.mkdir(parents=True, exist_ok=True)



@njit(parallel=True)
def get_p_value_list(fisher, contingency_tables):
    num_tests = contingency_tables.shape[0]
    results = np.empty(num_tests, dtype=np.float64)
    for i in prange(num_tests):
        a, b, c, d = contingency_tables[i]
        p_value = fisher.get_p_value(a, b, c, d)
        results[i] = p_value
    return results


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
        "pvalue_mimicker_500": {"scores": [], "labels": []},
        "pvalue_mimicker_1000": {"scores": [], "labels": []},
        "pvalue_mimicker_5000": {"scores": [], "labels": []},    
        "pvalue_mimicker_10000": {"scores": [], "labels": []},
        "pvalue_mimicker_20000": {"scores": [], "labels": []},
        "pvalue_mimicker_40000": {"scores": [], "labels": []},
        "pvalue_mimicker_50000": {"scores": [], "labels": []},
        "pvalue_mimicker_75000": {"scores": [], "labels": []},
    }

    for file in tqdm(os.listdir(dir)): 
        enrich_df = pd.read_csv(f'{dir}/{file}', sep='\t', index_col=0)
        enrich_df['pert'] = enrich_df['sig'].map(lambda term: term.split('_')[4])
        enrich_df = enrich_df[enrich_df['pvalue_mimic'] < 0.05]
        enrich_df.sort_values('pvalue_mimic', inplace=True)
        enrich_df.reset_index(inplace=True, drop=True)
        for topn in [int(k.split('_')[-1]) for k in ranking_dict.keys()]:
            consensus_table = compute_consensus_stats_up_dn(enrich_df[:topn])
            consensus_table['hit'] = consensus_table['pert'].map(positive_func)
            consensus_table.sort_values('pvalue_mimicker', inplace=True)
            consensus_table.reset_index(inplace=True, drop=True)
            consensus_table['scores'] = 1 -  ((consensus_table.index.values + 1) / len(consensus_table))
           
            ranking_dict[f'pvalue_mimicker_{topn}']["labels"].extend(consensus_table['hit'].values)
            ranking_dict[f'pvalue_mimicker_{topn}']["scores"].extend(consensus_table['scores'].values)
    return ranking_dict

def get_mw_ks_ranking_dicts(dir, positive_func, normalize_ranks=False):
    
    mw_ks_ranking_dict = {
        "pvalue": {"scores": [], "labels": []}
    }
    
    for f in tqdm(os.listdir(dir)):
        if 'mimickers_' in f:
            df = pd.read_csv(f'{dir}/{f}', sep='\t', index_col=0).rename(columns={'total sigs': 'count'})
            df = df[df['p-value'] < 0.05]
            if normalize_ranks:
                df['combined_scored'] = -np.log(df['p-value']) + np.log(1/np.square(df['count']))
                print(df['combined_scored'])
                df.sort_values(by='combined_scored', inplace=True, ascending=False)
            else:
                df.sort_values(by='p-value', inplace=True, ascending=True)
            df.index.name = 'term'
            df.reset_index(drop=False, inplace=True)
            df['labels'] = [1 if positive_func(x.split()[0].lower()) else 0 for x in df['term']]
            df['scores'] = 1 -  ((df.index.values) / len(df))
            mw_ks_ranking_dict['pvalue']['scores'].extend(list(df['scores']))
            mw_ks_ranking_dict['pvalue']['labels'].extend(list(df['labels']))
    return mw_ks_ranking_dict

all_counts = pd.DataFrame(counts.items(), columns=['pert', 'count'])

def get_count_ranking_dict(positive_func):
    count_ranking_dict = { "Count": {"scores": [], "labels": []}}
    all_counts['hit'] = all_counts['pert'].map(positive_func)
    all_counts.sort_values('count', ascending=False, inplace=True)
    all_counts.reset_index(drop=True, inplace=True)
    all_counts['scores'] = 1 -  ((all_counts.index.values + 1) / len(all_counts))
    count_ranking_dict['Count']["labels"].extend(all_counts['hit'].values)
    count_ranking_dict['Count']["scores"].extend(all_counts['scores'].values)
    return count_ranking_dict

def plot_ranking_dicts(ranking_dicts, save=None):
    plt.figure(figsize=(10, 8))
    for ranking_dict_name in ranking_dicts:
        ranking_dict = ranking_dicts[ranking_dict_name]
        for m in ranking_dict.keys():  
            fpr, tpr, thresholds = roc_curve(ranking_dict[m]['labels'], ranking_dict[m]['scores'])
            roc_auc = auc(fpr, tpr)
            plt.plot(fpr, tpr, lw=2, label=f'{ranking_dict_name} {m.replace("pvalue_mimicker_", "pvalue n=")} (AUC = {roc_auc:.2f})')
    plt.xlabel('False Positive Rate', fontsize=18)
    plt.ylabel('True Positive Rate', fontsize=18)
    plt.legend(loc='lower right', fontsize=11)
    plt.xticks(fontsize=15)
    plt.yticks(fontsize=15)
    plt.grid(alpha=0.3)
    plt.plot([0, 1], [0, 1], color='gray', linestyle='--', label='Random')
    if save:
        plt.savefig(save, dpi=300, bbox_inches='tight')
    plt.show()

import matplotlib as mp
def plot_n_auc(ranking_dicts, save=None, show=True):
    plt.rcParams.update(mp.rcParamsDefault)
    drug_aucs_n = {}

    for ranking_dict_name in ranking_dicts:
        ranking_dict = ranking_dicts[ranking_dict_name]

        if ranking_dict_name not in drug_aucs_n:
            drug_aucs_n[ranking_dict_name] = {"aucs": [], "ns": []}

        for m in ranking_dict.keys():  
            fpr, tpr, thresholds = roc_curve(ranking_dict[m]['labels'], ranking_dict[m]['scores'])
            roc_auc = auc(fpr, tpr)
            drug_aucs_n[ranking_dict_name]["aucs"].append(roc_auc)
            drug_aucs_n[ranking_dict_name]["ns"].append(int(m.split('_')[-1]))

    plt.figure(figsize=(12, 8))
    for drug in drug_aucs_n:
        plt.plot(
            drug_aucs_n[drug]["ns"], 
            drug_aucs_n[drug]["aucs"], 
            lw=1,  
            marker='o',
            markersize=5,
            label=f'{drug}'
        )

    plt.xlabel("N Signatures", fontsize=18)
    plt.ylabel("AUC", fontsize=18)
    plt.xticks(fontsize=15)
    plt.yticks(fontsize=15)
    plt.grid(True, alpha=0.3)
    plt.legend(bbox_to_anchor=(1.05, 0.5), loc="center left", borderaxespad=0, fontsize=15)
    plt.tight_layout()
    if save:
        plt.savefig(save, dpi=300, bbox_inches='tight')
    if show:
        plt.show()
    
    plt.clf()

#%%        
dex_ranking_dict = get_consensus_ranking_dicts('data/dex_pair_enrichment', lambda x: "dexamethasone" in x)

#%%
dex_mw_ranking_dict = get_mw_ks_ranking_dicts('data/dex_l1000_ranker/mw', lambda x: "dexamethasone" in x)
dex_ks_uniform2t_ranking_dict = get_mw_ks_ranking_dicts('data/dex_l1000_ranker/ks/uniform_2t', lambda x: "dexamethasone" in x)
dex_ks_norm2t_ranking_dict = get_mw_ks_ranking_dicts('data/dex_l1000_ranker/ks/norm_2t', lambda x: "dexamethasone" in x, normalize_ranks=True)

#dex_count_ranking_dict = get_count_ranking_dict(lambda x: "dexamethasone" in x)
#%%
plot_ranking_dicts({'Up-Down Top-N': dex_ranking_dict, 'MW': dex_mw_ranking_dict, 'KS Uniform 2T': dex_ks_uniform2t_ranking_dict, 'KS Norm 2T': dex_ks_norm2t_ranking_dict}, save= fig_dir / 'fig4a.pdf')
plot_ranking_dicts({'Up-Down Top-N': dex_ranking_dict, 'MW': dex_mw_ranking_dict, 'KS Uniform 2T': dex_ks_uniform2t_ranking_dict, 'KS Norm 2T': dex_ks_norm2t_ranking_dict}, save= fig_dir /'fig4a.png')

# %%
thiazolidinedione_ranking_dict = get_consensus_ranking_dicts('data/thiazolidinedione_pair_enrichment', lambda x:'rosiglitazone' in x or 'pioglitazone' in x)

# %%
thiazolidinedione_mw_ranking_dict = get_mw_ks_ranking_dicts('data/thiazolidinedione_l1000_ranker/mw', lambda x: 'rosiglitazone' in x or 'pioglitazone' in x)
thiazolidinedione_ks_uniform2t_ranking_dict = get_mw_ks_ranking_dicts('data/thiazolidinedione_l1000_ranker/ks/uniform_2t', lambda x: 'rosiglitazone' in x or 'pioglitazone' in x)
thiazolidinedione_ks_norm2t_ranking_dict = get_mw_ks_ranking_dicts('data/thiazolidinedione_l1000_ranker/ks/norm_2t', lambda x: 'rosiglitazone' in x or 'pioglitazone' in x, normalize_ranks=True)

#thiazolidinedione_count_ranking_dict = get_count_ranking_dict(lambda x: 'rosiglitazone' in x or 'pioglitazone' in x)
# %%
plot_ranking_dicts({'Up-Down Top-N': thiazolidinedione_ranking_dict, 'MW': thiazolidinedione_mw_ranking_dict, 'KS Uniform 2T': thiazolidinedione_ks_uniform2t_ranking_dict, 'KS Norm 2T': thiazolidinedione_ks_norm2t_ranking_dict}, save= fig_dir / 'fig4b.pdf')
plot_ranking_dicts({'Up-Down Top-N': thiazolidinedione_ranking_dict, 'MW': thiazolidinedione_mw_ranking_dict, 'KS Uniform 2T': thiazolidinedione_ks_uniform2t_ranking_dict, 'KS Norm 2T': thiazolidinedione_ks_norm2t_ranking_dict}, save= fig_dir / 'fig4b.png')

#%%
tamoxifen_ranking_dict = get_consensus_ranking_dicts('data/tamoxifen_pair_enrichment', lambda x: 'tamoxifen' in x)
# %%
tamoxifen_mw_ranking_dict = get_mw_ks_ranking_dicts('data/tamoxifen_l1000_ranker/mw', lambda x: 'tamoxifen' in x)
tamoxifen_ks_uniform2t_ranking_dict = get_mw_ks_ranking_dicts('data/tamoxifen_l1000_ranker/ks/uniform_2t', lambda x: 'tamoxifen' in x)
tamoxifen_ks_norm2t_ranking_dict = get_mw_ks_ranking_dicts('data/tamoxifen_l1000_ranker/ks/norm_2t', lambda x: 'tamoxifen' in x, normalize_ranks=True)
#tamoxifen_count_ranking_dict = get_count_ranking_dict(lambda x: 'tamoxifen' in x)
# %%
plot_ranking_dicts({'Up-Down Top-N': tamoxifen_ranking_dict, 'MW': tamoxifen_mw_ranking_dict, 'KS Uniform 2T': tamoxifen_ks_uniform2t_ranking_dict, 'KS Norm 2T': tamoxifen_ks_norm2t_ranking_dict}, save= fig_dir / 'fig4c.pdf')
plot_ranking_dicts({'Up-Down Top-N': tamoxifen_ranking_dict, 'MW': tamoxifen_mw_ranking_dict, 'KS Uniform 2T': tamoxifen_ks_uniform2t_ranking_dict, 'KS Norm 2T': tamoxifen_ks_norm2t_ranking_dict}, save= fig_dir / 'fig4c.png')
# %%
fig_dir = pathlib.Path('figures')/'fig3'
fig_dir.mkdir(parents=True, exist_ok=True)
plot_n_auc({"dexamethasone up-down": dex_ranking_dict, "thiazolidinedione up-down": thiazolidinedione_ranking_dict, "tamoxifen up-down": tamoxifen_ranking_dict, "dexamethasone up": dex_ranking_dict_up, "thiazolidinedione up": thiazolidinedione_ranking_dict_up, "tamoxifen up": tamoxifen_ranking_dict_up, "dexamethasone down": dex_ranking_dict_dn, "thiazolidinedione down": thiazolidinedione_ranking_dict_dn, "tamoxifen down": tamoxifen_ranking_dict_dn}, save= fig_dir / 'fig3.pdf')
plot_n_auc({"dexamethasone up-down": dex_ranking_dict, "thiazolidinedione up-down": thiazolidinedione_ranking_dict, "tamoxifen up-down": tamoxifen_ranking_dict, "dexamethasone up": dex_ranking_dict_up, "thiazolidinedione up": thiazolidinedione_ranking_dict_up, "tamoxifen up": tamoxifen_ranking_dict_up, "dexamethasone down": dex_ranking_dict_dn, "thiazolidinedione down": thiazolidinedione_ranking_dict_dn, "tamoxifen down": tamoxifen_ranking_dict_dn}, save= fig_dir / 'fig3.png')

# %%

