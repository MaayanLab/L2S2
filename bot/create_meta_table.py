from tqdm import tqdm
import json
import requests
from xml.dom import minidom
import urllib
import xml.etree.ElementTree as ET
doc = minidom.Document()
import time


def create_counts():
    counts_genes = {}
    with open('./data/l1000_xpr.gmt') as f:
        for line in tqdm(f.readlines()):
            term = line.strip().split('\t')[0]
            gene = term.split('_')[4].split(' ')[0]
            if gene[0:4] != 'BRDN':
                if gene not in counts_genes:
                    counts_genes[gene] = 0
                counts_genes[gene] += 1
                
    with open('data/counts_genes.json', 'w') as fw:
        json.dump(counts_genes, fw)
            
    counts_perts = {}
    with open('./data/l1000_cp.gmt') as f:
        for line in tqdm(f.readlines()):
            term = line.strip().split('\t')[0]
            pert = term.split('_')[4]
            if pert not in counts_perts:
                counts_perts[pert] = 0
            counts_perts[pert] += 1
                
    with open('data/counts_perts.json', 'w') as fw:
        json.dump(counts_perts, fw)

## credit to Daniel in Playbook code
# https://github.com/MaayanLab/Playbook-Workflow-Builder/blob/main/components/service/pubchem/__init__.py

def chunked(it, n=100):
  chunk = []
  for el in it:
    chunk.append(el)
    if len(chunk) >= n:
      yield chunk
      chunk = []
  if chunk:
    yield chunk

def pug(data: str, find: str, n=3, backoff=1.):
  ''' Use the PUG API, and get an XML element from the response or retry n times
  '''
  for _ in range(n):
    time.sleep(backoff)
    with urllib.request.urlopen("https://pubchem.ncbi.nlm.nih.gov/pug/pug.cgi", data=data.encode()) as req:
      root = ET.parse(req)
      node = root.find(find)
      if node is not None:
        return root, node
  raise Exception(f"Failed to find {find} in PubChem PUG request")

def fetch_drug_name_cids(drug_names):
  ''' Given a list of drug names, get a list of CIDs with PubChem's API
  '''
  query_synonyms = doc.createElement('PCT-QueryUids_synonyms')
  for drug in set(drug_names):
    query_synonym = doc.createElement('PCT-QueryUids_synonyms_E')
    query_synonym.appendChild(doc.createTextNode(drug))
    query_synonyms.appendChild(query_synonym)
  _, reqidNode = pug(f'''
  <PCT-Data>
  <PCT-Data_input>
  <PCT-InputData>
  <PCT-InputData_query>
  <PCT-Query>
  <PCT-Query_type>
  <PCT-QueryType>
  <PCT-QueryType_id-exchange>
  <PCT-QueryIDExchange>
  <PCT-QueryIDExchange_input>
  <PCT-QueryUids>
  {query_synonyms.toxml()}
  </PCT-QueryUids>
  </PCT-QueryIDExchange_input>
  <PCT-QueryIDExchange_operation-type value="same"/>
  <PCT-QueryIDExchange_output-type value="cid"/>
  <PCT-QueryIDExchange_output-method value="file-pair"/>
  <PCT-QueryIDExchange_compression value="none"/>
  </PCT-QueryIDExchange>
  </PCT-QueryType_id-exchange>
  </PCT-QueryType>
  </PCT-Query_type>
  </PCT-Query>
  </PCT-InputData_query>
  </PCT-InputData>
  </PCT-Data_input>
  </PCT-Data>
  ''', './/PCT-Waiting_reqid')
  _, downloadNode = pug(f'''
  <PCT-Data>
    <PCT-Data_input>
      <PCT-InputData>
        <PCT-InputData_request>
          <PCT-Request>
            <PCT-Request_reqid>{reqidNode.text}</PCT-Request_reqid>
            <PCT-Request_type value="status"/>
          </PCT-Request>
        </PCT-InputData_request>
      </PCT-InputData>
    </PCT-Data_input>
  </PCT-Data>
  ''', './/PCT-Download-URL_url')
  with urllib.request.urlopen(downloadNode.text.replace('ftp://', 'https://')) as req:
    drug_name_cids = {
      drugname: cid
      for line in req
      for drugname, _, cid in (line.decode().strip().partition('\t'),)
      if cid
    }
  return drug_name_cids

def fetch_fda_approvals(cids):
  ''' Use pubchem's sdq API to query for fdadrugs associated with compound ids
  '''
  for chunk_cids in chunked(cids):
    time.sleep(0.5)
    query = {
      'download':'*',
      'collection':'fdadrug',
      'where':{
        'ors': [
          {'cid':cid}
          for cid in chunk_cids
        ]
      },
      'order':['status,desc'],
      'start':1,
      'limit':10000000,
    }
    req = requests.post(
      'https://pubchem.ncbi.nlm.nih.gov/sdq/sdqagent.cgi',
      params=dict(
        infmt='json',
        outfmt='json',
      ),
      files=dict(
        query=(None, json.dumps(query)),
      ),
    )
    try:
      yield from req.json()
    except requests.exceptions.JSONDecodeError:
      import sys
      print('warning, lost information because pubchems response is not valid json', file=sys.stderr)

def filter_fda_set(drugs):
  drug_name_cids = fetch_drug_name_cids(drugs)
  fda_approvals = fetch_fda_approvals(set(drug_name_cids.values()))
  fda_cids = {str(cid) for fda_approval in fda_approvals for cid in fda_approval['cids']}
  fda_drugs = [drug_name for drug_name, cid in drug_name_cids.items() if cid in fda_cids]
  return fda_drugs


def create_fda_dict():
    with open('./data/counts_perts.json') as f:
        counts_perts = json.load(f)
    drugs = list(counts_perts.keys())
    fda_drugs = []
    for i in tqdm(range(0, len(drugs), 1000)):    
        fda_drugs_set = filter_fda_set(drugs[i:i+1000])
        fda_drugs.extend(fda_drugs_set)
    fda_drugs = set(fda_drugs)
    fda_dict = {}
    for drug in drugs:
        fda_dict[drug] = drug in fda_drugs
    with open('data/fda_drugs.json', 'w') as fw:
        json.dump(fda_dict, fw)

#https://minio.dev.maayanlab.cloud/sigcom-ks/fda_approved.json
#create_fda_dict()

        

    
    
        