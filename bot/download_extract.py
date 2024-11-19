
#%%
import numpy as np
from tqdm import tqdm
import pandas as pd
import json
#%%

with open('../data/fda_approved.json') as f:
  fda_approved = json.load(f)
  
#%%

df = pd.read_csv('../data/Products.txt', sep='\t', index_col=0, on_bad_lines='warn')
  
# %%
with open('../data/counts_perts.json') as f:
  counts_perts = json.load(f)
# %%
perts = list(counts_perts.keys())
# %%


counter = 0
pair_list = []
for p in tqdm(perts):
  for value in set(df['DrugName'].values):
    if p.lower() in value.lower():
      counter += 1
      pair_list.append((p, value))
      break
# %%
l1000_approved = set([x[0].upper() for x in pair_list])

print('intersection', len(l1000_approved.intersection(fda_approved)))
print('new', len(l1000_approved))
print('og', len(fda_approved))
print('diff', len(l1000_approved.difference(fda_approved)))
union = l1000_approved.union(fda_approved)
print('union', len(union))
with open('../data/fda_approved_new.json', 'w') as fw:
  json.dump(list(union), fw)
#%%