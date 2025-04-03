#%%
import re
import pathlib
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
from matplotlib.lines import Line2D
from maayanlab_bioinformatics.dge import limma_voom_differential_expression
from maayanlab_bioinformatics.harmonization import ncbi_genes_lookup
from maayanlab_bioinformatics.api import enrichr_get_top_results
from common import *

lookup = ncbi_genes_lookup()

#%%
fig_dir = pathlib.Path('figures')/'fig4'
fig_dir.mkdir(parents=True, exist_ok=True)

#%%

CYTOR_df = pd.read_csv('data/GSE285084_CYTOR_KD_Gene_Counts.csv', index_col=0)
print(len(CYTOR_df))
KD_samples = [col for col in CYTOR_df.columns if 'CYTOR' in col]
CTRL_samples = [col for col in CYTOR_df.columns if 'NC' in col]
dge = limma_voom_differential_expression(CYTOR_df[CTRL_samples], CYTOR_df[KD_samples], CYTOR_df)
dge

# %%

dge[dge['adj.P.Val'] < 0.01].sort_values('logFC', ascending=False)
CYTOR_up = dge[(dge['adj.P.Val'] < 0.01) & (dge['logFC'] > 0)].index
CYTOR_down = dge[(dge['adj.P.Val'] < 0.05) & (dge['logFC'] < 0)].index
# %%

CYTOR_up_genes = [lookup(gene.split('.')[0]) for gene in CYTOR_up if lookup(gene.split('.')[0])]
CYTOR_down_genes = [lookup(gene.split('.')[0]) for gene in CYTOR_down if lookup(gene.split('.')[0])]


print("CYTOR KD DGE (Adj. P-value < 0.01) up genes:", len(CYTOR_up_genes), "down genes:", len(CYTOR_down_genes))

# %%
enrichment_df, consensus_df = enrich_l2s2_single_set(CYTOR_up_genes, first=12)
consensus_df.sort_values('pvalueDown', inplace=True)
import matplotlib.pyplot as plt
consensus_df.set_index('perturbation', inplace=True, drop=True)
consensus_df['log10(-adj. down p-value)'] = -np.log10(consensus_df['adjPvalueDown'])
consensus_df[:3][::-1].plot.barh( y='log10(-adj. down p-value)', color='black', legend=False, figsize=(10, 5), fontsize=16)
#plt.legend(False)
plt.xlabel('log10(-Adj. P-Value Down)', fontsize=16)
plt.ylabel('Consensus Compound', fontsize=16)
plt.savefig(fig_dir /'fig4a.pdf', dpi=300, bbox_inches='tight')
plt.savefig(fig_dir /'fig4a.png', dpi=300, bbox_inches='tight')
# %%
camptothecin_row = enrichment_df[enrichment_df['perturbation'] == 'camptothecin']
camptothecin_id = camptothecin_row['id'].values[0]
n_camptothecin = camptothecin_row['nGeneIds'].values[0]
camptothecin_term = ' '.join(camptothecin_row['term'].values[0].split('_')[:4]) + "\n" + ' '.join(camptothecin_row['term'].values[0].split('_')[4:])

cytor_camptothecin_overlap = get_overlap(CYTOR_up_genes, camptothecin_id)
# %%

import matplotlib_venn as venn
plt.clf()
venn.venn2(subsets=(len(CYTOR_up_genes), n_camptothecin, len(cytor_camptothecin_overlap)), set_labels=('CYTOR KD Up Genes', camptothecin_term))
plt.savefig(fig_dir /'fig4b.pdf', dpi=300, bbox_inches='tight')
plt.savefig(fig_dir /'fig4b.png', dpi=300, bbox_inches='tight')

# %%
cytor_camptothecin_overlap_userListId, shortId = enrichr_add_list(cytor_camptothecin_overlap, f'CYTOR KD Up Genes Overlap {camptothecin_term}')
cytor_camptothecin_nature_nci = enrichr_get_top_results(cytor_camptothecin_overlap_userListId, 'NCI-Nature_2016', sleep=1)
# %%
cytor_camptothecin_nature_nci_plot = cytor_camptothecin_nature_nci[0:5]
import seaborn as sns
cytor_camptothecin_nature_nci_plot['-log10(adjusted_pvalue)'] = -np.log10(cytor_camptothecin_nature_nci_plot['adjusted_pvalue'])

# Plot
plt.figure(figsize=(11, 3))
sns.barplot(data=cytor_camptothecin_nature_nci_plot, x='-log10(adjusted_pvalue)', y='term', color='lightblue', width=.8)

# Add the term text inside the bars
for index, row in cytor_camptothecin_nature_nci_plot.iterrows():
    plt.text( 0.1, index, row['term'], color='black', ha='left', va='center')
plt.yticks([])
plt.xlabel("-log10(Adjusted P-value)")
plt.ylabel("Term")
plt.savefig(fig_dir /'fig4c.pdf', dpi=300, bbox_inches='tight')
plt.savefig(fig_dir /'fig4c.png', dpi=300, bbox_inches='tight')
# %%

cytor_camptothecin_bioplanet = enrichr_get_top_results(cytor_camptothecin_overlap_userListId, 'BioPlanet_2019', sleep=1)
# %%
cytor_camptothecin_bioplanet_plot = cytor_camptothecin_bioplanet[0:5]
cytor_camptothecin_bioplanet_plot['-log10(adjusted_pvalue)'] = -np.log10(cytor_camptothecin_bioplanet_plot['adjusted_pvalue'])

# Plot
plt.figure(figsize=(11, 3))
sns.barplot(data=cytor_camptothecin_bioplanet_plot, x='-log10(adjusted_pvalue)', y='term', color='lightblue', width=.8)

# Add the term text inside the bars
for index, row in cytor_camptothecin_bioplanet_plot.iterrows():
    plt.text( 0.1, index, row['term'], color='black', ha='left', va='center')
plt.yticks([])
plt.xlabel("-log10(Adjusted P-value)")
plt.ylabel("Term")
plt.savefig(fig_dir /'fig4d.pdf', dpi=300, bbox_inches='tight')
plt.savefig(fig_dir /'fig4d.png', dpi=300, bbox_inches='tight')

# %%
