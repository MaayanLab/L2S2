# %%
import os
import json
import pandas as pd
from tqdm import tqdm
import pyenrichr as pye
import matplotlib.pyplot as plt
from sklearn.metrics import roc_curve, auc
import numpy as np
from numba import njit, prange
import pathlib

fig_dir = pathlib.Path('figures')/'fig3'
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

def map_term_to_count(term):
    if term in counts:
        return counts[term]
    elif term.upper() in counts:
        return counts[term.upper()]
    elif term.lower() in counts:
        return counts[term.lower()]
    elif term.capitalize() in counts:
        return counts[term.capitalize()]
    else:
        0


fisher = pye.enrichment.FastFisher(44000)
def compute_consensus_stats(enrich_df):
    # Ensure 'is_up' and 'is_down' columns exist
    enrich_df = enrich_df.assign(
        is_up=enrich_df['term'].str.contains(" up"),
        is_down=enrich_df['term'].str.contains(" down")
    )

    # Filter for 'pert' values in counts
    enrich_df = enrich_df[enrich_df['pert'].isin(counts)]
    
    # Precompute total_n
    enrich_df['total_n'] = enrich_df['pert'].map(counts)

    # Group by 'pert' and compute aggregates
    grouped = enrich_df.groupby('pert').agg(
        a_up=('is_up', 'sum'),
        b_up=('is_down', 'sum'),
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
    grouped['pvalue_up'] = p_values_up
    grouped['pvalue_dn'] = p_values_down

    # Return the final DataFrame
    return grouped[['pert', 'pvalue_up', 'pvalue_dn']]

        

def compute_consensus_dir(dir, positive):
    curr_files = os.listdir(dir)
    ranking_dict_up = {
        "pvalue_up_500": {"scores": [], "labels": []},
        "pvalue_up_1000": {"scores": [], "labels": []},
        "pvalue_up_5000": {"scores": [], "labels": []},
        "pvalue_up_10000": {"scores": [], "labels": []},
        "pvalue_up_20000": {"scores": [], "labels": []},
        "pvalue_up_40000": {"scores": [], "labels": []},
        "pvalue_up_50000": {"scores": [], "labels": []},
        "pvalue_up_75000": {"scores": [], "labels": []},
    }

    ranking_dict_dn = {
        "pvalue_dn_500": {"scores": [], "labels": []},
        "pvalue_dn_1000": {"scores": [], "labels": []},
        "pvalue_dn_5000": {"scores": [], "labels": []},
        "pvalue_dn_10000": {"scores": [], "labels": []},
        "pvalue_dn_20000": {"scores": [], "labels": []},
        "pvalue_dn_40000": {"scores": [], "labels": []},
        "pvalue_dn_50000": {"scores": [], "labels": []},
        "pvalue_dn_75000": {"scores": [], "labels": []},
    }


    for file in tqdm(curr_files): 
        enrich_df = pd.read_csv(f'{dir}/{file}', sep='\t', index_col=0)
        enrich_df['pert'] = enrich_df['term'].map(lambda term: term.split('_')[4].replace(' up', '').replace(' down', ''))
        enrich_df = enrich_df[~enrich_df['term'].str.contains('BRDN')]
        for topn in [int(k.split('_')[-1]) for k in ranking_dict_up.keys()]:
            consensus_table = compute_consensus_stats(enrich_df[:topn])
            consensus_table['hit'] = consensus_table['pert'].map(positive)
            if '_up' in file:
                consensus_table.sort_values('pvalue_up', inplace=True)
                consensus_table.reset_index(inplace=True, drop=True)
                consensus_table['scores'] = 1 -  ((consensus_table.index.values + 1) / len(consensus_table))
                ranking_dict_up[f'pvalue_up_{topn}']["labels"].extend(consensus_table['hit'].values)
                ranking_dict_up[f'pvalue_up_{topn}']["scores"].extend(consensus_table['scores'].values)
                
            if '_down' in file:
                consensus_table.sort_values('pvalue_dn', inplace=True)
                consensus_table.reset_index(inplace=True, drop=True)
                consensus_table['scores'] = 1 -  ((consensus_table.index.values + 1) / len(consensus_table))
                ranking_dict_dn[f'pvalue_dn_{topn}']["labels"].extend(list(consensus_table['hit'].values))
                ranking_dict_dn[f'pvalue_dn_{topn}']["scores"].extend(list(consensus_table['scores'].values))
            
    return ranking_dict_up, ranking_dict_dn

# load a gene set library
mean_sig_crispr = {}
mean_sig_chem = {}
with open('data/LINCS_L1000_Chem_Pert_Consensus_Sigs.txt') as f:
    lines = f.readlines()
    for line in lines:
        line = line.strip().split('\t')
        mean_sig_chem[line[0]] = set(line[2:])

with open('data/LINCS_L1000_CRISPR_KO_Consensus_Sigs.txt') as f:
    lines = f.readlines()
    for line in lines:
        line = line.strip().split('\t')
        mean_sig_chem[line[0]] = set(line[2:])


def compute_mean_sig_raninking(gmt_path, positive):
    ranking_dict_mean_sigs_up = {
        'p-value': {'scores': [], 'labels': []},
    }

    ranking_dict_mean_sigs_dn = {
        'p-value': {'scores': [], 'labels': []},
    }

    sigs = {}

    with open(gmt_path) as f:
        lines = f.readlines()
        for line in lines:
            line = line.strip().split('\t')
            sigs[('_').join(line[0].split())] = line[2:]
        
    for sig in tqdm(sigs):
        rank_df = pye.enrichment.fisher([g.upper() for g in sigs[sig]], mean_sig_chem, fisher=fisher)
        rank_df = rank_df[(rank_df['p-value'] < 0.01)]
        rank_df['count'] = rank_df['term'].map(lambda x: map_term_to_count(x.split()[0]))
        for metric in ranking_dict_mean_sigs_up.keys():
            if 'p-value' in metric:
                rank_df.sort_values(by=metric, inplace=True, ascending=True)
            else:
                rank_df.sort_values(by=metric, inplace=True, ascending=False)
            rank_df.reset_index(drop=True, inplace=True)
            if "up" in sig:
                rank_df['labels'] = [1 if positive(x.split()[0].lower()) and x.split()[1].upper() == "UP" else 0 for x in rank_df['term']]
                rank_df['scores'] = 1 -  ((rank_df.index.values) / len(rank_df))
                ranking_dict_mean_sigs_up[metric]['scores'].extend(list(rank_df['scores']))
                ranking_dict_mean_sigs_up[metric]['labels'].extend(list(rank_df['labels']))
            elif "down" in sig:
                rank_df['labels'] = [1 if positive(x.split()[0].lower()) and x.split()[1].upper() == "DOWN" else 0 for x in rank_df['term']]
                rank_df['scores'] = 1 -  ((rank_df.index.values) / len(rank_df))
                ranking_dict_mean_sigs_dn[metric]['scores'].extend(list(rank_df['scores']))
                ranking_dict_mean_sigs_dn[metric]['labels'].extend(list(rank_df['labels']))
    return ranking_dict_mean_sigs_up, ranking_dict_mean_sigs_dn

def plot_ranking_dicts(ranking_dicts, save=None, show=True):
    plt.figure(figsize=(10, 8))
    for ranking_dict_name in ranking_dicts:
        ranking_dict = ranking_dicts[ranking_dict_name]
        for m in ranking_dict.keys():  
            fpr, tpr, thresholds = roc_curve(ranking_dict[m]['labels'], ranking_dict[m]['scores'])
            roc_auc = auc(fpr, tpr)
            plt.plot(fpr, tpr, lw=2, label=f'{ranking_dict_name} {m.replace("pvalue_up_", "pvalue up (n=").replace("pvalue_dn_", "pvalue down (n=")}) (AUC = {roc_auc:.2f})')
    plt.xlabel('False Positive Rate', fontsize=16)
    plt.ylabel('True Positive Rate', fontsize=16)
    plt.xticks(fontsize=14)
    plt.yticks(fontsize=14)
    plt.legend(loc='lower right')
    plt.grid(alpha=0.3)
    plt.plot([0, 1], [0, 1], color='gray', linestyle='--', label='Random')
    if save:
        plt.savefig(save, dpi=300, bbox_inches='tight')
    if show:
        plt.show()
    plt.clf()
    
def plot_n_auc(ranking_dicts, save=None, show=True):
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

    plt.figure(figsize=(10, 8))
    for drug in drug_aucs_n:
        plt.plot(
            drug_aucs_n[drug]["ns"], 
            drug_aucs_n[drug]["aucs"], 
            lw=1,  
            marker='o',
            markersize=5,
            label=f'{drug}'
        )

    plt.xlabel("N")
    plt.ylabel("AUC")
    plt.legend()
    
    if save:
        plt.savefig(save, dpi=300, bbox_inches='tight')
    if show:
        plt.show()
    
    plt.clf()

#%%

dex_ranking_dict_up, dex_ranking_dict_dn = compute_consensus_dir('data/dex_out_enrich', lambda term: 'dexamethasone' in term)
#%%
dex_mean_sig_ranking_up, dex_mean_sig_ranking_dn = compute_mean_sig_raninking('data/dex_gen3va.gmt', lambda x: 'dexamethasone' in x)
# %%

## A & B (Dexamethasone)
plot_ranking_dicts({'Top-N Up': dex_ranking_dict_up,  'Mean CD Sigs Up': dex_mean_sig_ranking_up}, fig_dir / 'fig3a.pdf')
plot_ranking_dicts({'Top-N Up': dex_ranking_dict_up,  'Mean CD Sigs Up': dex_mean_sig_ranking_up}, fig_dir / 'fig3a.png')

plot_ranking_dicts({'Top-N Down': dex_ranking_dict_dn,  'Mean CD Sigs Down': dex_mean_sig_ranking_dn}, fig_dir / 'fig3b.png')
plot_ranking_dicts({'Top-N Down': dex_ranking_dict_dn,  'Mean CD Sigs Down': dex_mean_sig_ranking_dn}, fig_dir / 'fig3b.pdf')

# %%
thiazolidinedione_ranking_dict_up, thiazolidinedione_ranking_dict_dn = compute_consensus_dir('data/thiazolidinedione_out_enrich', lambda x:'rosiglitazone' in x or 'pioglitazone' in x)
# %%
thiazolidinedione_mean_sig_ranking_up, thiazolidinedione_mean_sig_ranking_dn = compute_mean_sig_raninking('data/thiazolidinedione_gen3va.gmt', lambda x:'rosiglitazone' in x or 'pioglitazone' in x)

#%%
## C & D (Thiazolidinedione)
plot_ranking_dicts({'Top-N Up': thiazolidinedione_ranking_dict_up,  'Mean CD Sigs Up': thiazolidinedione_mean_sig_ranking_up}, fig_dir / 'fig3c.pdf')
plot_ranking_dicts({'Top-N Up': thiazolidinedione_ranking_dict_up,  'Mean CD Sigs Up': thiazolidinedione_mean_sig_ranking_up}, fig_dir / 'fig3c.png')

plot_ranking_dicts({'Top-N Down': thiazolidinedione_ranking_dict_dn,  'Mean CD Sigs Down': thiazolidinedione_mean_sig_ranking_dn}, fig_dir / 'fig3d.png')
plot_ranking_dicts({'Top-N Down': thiazolidinedione_ranking_dict_dn,  'Mean CD Sigs Down': thiazolidinedione_mean_sig_ranking_dn}, fig_dir / 'fig3d.pdf')
# %%

tamoxifen_ranking_dict_up, tamoxifen_ranking_dict_dn = compute_consensus_dir('data/tamoxifen_out_enrich', lambda term: 'tamoxifen' in term)
# %%
tamoxifen_mean_sig_ranking_up, tamoxifen_mean_sig_ranking_dn = compute_mean_sig_raninking('data/tamoxifen_gen3va.gmt', lambda x: 'tamoxifen' in x)

#%%
## E & F (Tamoxifen)
plot_ranking_dicts({'Top-N Up': tamoxifen_ranking_dict_up,  'Mean CD Sigs Up': tamoxifen_mean_sig_ranking_up}, fig_dir / 'fig3e.pdf')
plot_ranking_dicts({'Top-N Up': tamoxifen_ranking_dict_up,  'Mean CD Sigs Up': tamoxifen_mean_sig_ranking_up}, fig_dir / 'fig3e.png')

plot_ranking_dicts({'Top-N Down': tamoxifen_ranking_dict_dn,  'Mean CD Sigs Down': tamoxifen_mean_sig_ranking_dn}, fig_dir / 'fig3f.png')
plot_ranking_dicts({'Top-N Down': tamoxifen_ranking_dict_dn,  'Mean CD Sigs Down': tamoxifen_mean_sig_ranking_dn}, fig_dir / 'fig3f.pdf')
# %%

plot_n_auc({"dexamethasone up": dex_ranking_dict_up, "thiazolidinedione up": thiazolidinedione_ranking_dict_up, "tamoxifen up": tamoxifen_ranking_dict_up, "dexamethasone down": dex_ranking_dict_dn, "thiazolidinedione down": thiazolidinedione_ranking_dict_dn, "tamoxifen down": tamoxifen_ranking_dict_dn}, fig_dir / 'fig3g.pdf')
# %%