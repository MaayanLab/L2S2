export const singleGeneEnrich = `import pandas as pd
import requests
import json


url = "http://l2s2.maayanlab.cloud/graphql"

def enrich_l2s2_single_set(geneset: list, first=1000):
    query = {
    "operationName": "EnrichmentQuery",
    "variables": {
        "filterTerm": " ",
        "offset": 0,
        "first": first,
        "filterFda": False,
        "sortBy": "pvalue_up",
        "filterKo": False,
        "genes": geneset,
    },
    "query": """query EnrichmentQuery(
                    $genes: [String]!
                    $filterTerm: String = ""
                    $offset: Int = 0
                    $first: Int = 10
                    $filterFda: Boolean = false
                    $sortBy: String = ""
                    $filterKo: Boolean = false
                    ) {
                    currentBackground {
                        enrich(
                        genes: $genes
                        filterTerm: $filterTerm
                        offset: $offset
                        first: $first
                        filterFda: $filterFda
                        sortby: $sortBy
                        filterKo: $filterKo
                        ) {
                        nodes {
                            geneSetHash
                            pvalue
                            adjPvalue
                            oddsRatio
                            nOverlap
                            geneSets {
                            nodes {
                                term
                                id
                                nGeneIds
                                geneSetFdaCountsById {
                                nodes {
                                    approved
                                    count
                                }
                                }
                            }
                            totalCount
                            }
                        }
                        totalCount
                        consensusCount
                        consensus {
                            drug
                            oddsRatio
                            pvalue
                            adjPvalue
                            approved
                            countSignificant
                            countInsignificant
                            countUpSignificant
                            pvalueUp
                            adjPvalueUp
                            oddsRatioUp
                            pvalueDown
                            adjPvalueDown
                            oddsRatioDown
                        }
                        }
                    }
                    }
                    """,
    }

    headers = {
        "Accept": "application/json",
        "Content-Type": "application/json"
    }

    response = requests.post(url, data=json.dumps(query), headers=headers)

    response.raise_for_status()
    res = response.json()
    #consensus = pd.DataFrame(res['data']['currentBackground']['enrich']['consensus'])
    consensus = res['data']['currentBackground']['enrich']['consensus']
    #enrichment = pd.DataFrame(res['data']['currentBackground']['enrich']['nodes'])
    enrichment = res['data']['currentBackground']['enrich']['nodes']# %%
    df_consensus = pd.DataFrame(consensus).rename(columns={'drug': 'perturbation'})

    df_enrichment = pd.json_normalize(
        enrichment, 
        record_path=['geneSets', 'nodes'], 
        meta=['geneSetHash', 'pvalue', 'adjPvalue', 'oddsRatio', 'nOverlap']
    )
    if df_enrichment.empty:
        return pd.DataFrame(), pd.DataFrame()
    df_enrichment["approved"] = df_enrichment["geneSetFdaCountsById.nodes"].map(lambda x: x[0]['approved'] if len(x) > 0 else False)
    df_enrichment["count"] = df_enrichment["geneSetFdaCountsById.nodes"].map(lambda x: x[0]['count'] if len(x) > 0 else 0)
    df_enrichment.drop(columns=['geneSetFdaCountsById.nodes'], inplace=True)
    df_enrichment['batch'] = df_enrichment["term"].map(lambda t: t.split('_')[0])
    df_enrichment["timepoint"] = df_enrichment["term"].map(lambda t: t.split('_')[1])
    df_enrichment["cellLine"] = df_enrichment["term"].map(lambda t: t.split('_')[2])
    df_enrichment["batch2"] = df_enrichment["term"].map(lambda t: t.split('_')[3])
    
    df_enrichment["perturbation"] = df_enrichment["term"].map(lambda t: t.split('_')[4].split(' ')[0] + " KO" if len(t.split('_')[4].split(' ')) == 2 else t.split('_')[4])
    
    df_enrichment['concentration'] = df_enrichment["term"].map(lambda t: t.split('_')[5].split(' ')[0] if len(t.split('_')) > 5 else "N/A")
    df_enrichment['direction'] = df_enrichment["term"].map(lambda t: t.split(' ')[1])

    return df_enrichment, df_consensus
`;

export const overlap = `## Use this function to get the overlap from a user set of genes and a given L2S2 gene set (id)
## gene set ids are returned as a part of the enrichment query show above
def get_overlap(genes, id):
    query = {
    "operationName": "OverlapQuery",
    "variables": {
        "id": id,
        "genes": genes
    },
    "query": """query OverlapQuery($id: UUID!, $genes: [String]!) {geneSet(id: $id) {\n    overlap(genes: $genes) {\n      nodes {\n        symbol\n        ncbiGeneId\n        description\n        summary\n      }   }}}"""
    }
    
    headers = {
        "Accept": "application/json",
        "Content-Type": "application/json"
    }

    response = requests.post(url, data=json.dumps(query), headers=headers)
    
    response.raise_for_status()
    res = response.json()
    return [item['symbol'] for item in res['data']['geneSet']['overlap']['nodes']]
`;

export const upDownGeneSetEnrich = `def enrich_l2s2_up_down(genes_up: list[str], genes_down: list[str], first=100):
  query = {
    "operationName": "PairEnrichmentQuery",
    "variables": {
      "filterTerm": " ",
      "offset": 0,
      "first": first,
      "filterFda": False,
      "sortBy": "pvalue_mimic",
      "filterKo": False,
      "topN": 1000,
      "pvalueLe": 0.05,
      "genesUp": genes_up,
      "genesDown": genes_down
    },
    "query": """query PairEnrichmentQuery($genesUp: [String]!, $genesDown: [String]!, $filterTerm: String = \"\", $offset: Int = 0, $first: Int = 10, $filterFda: Boolean = false, $sortBy: String = \"\", $filterKo: Boolean = false, $topN: Int = 10000, $pvalueLe: Float = 0.05) {
      currentBackground {
        pairedEnrich(
          filterTerm: $filterTerm
          offset: $offset
          first: $first
          filterFda: $filterFda
          sortby: $sortBy
          filterKo: $filterKo
          topN: $topN
          pvalueLe: $pvalueLe
          genesDown: $genesDown
          genesUp: $genesUp
          ) {
            totalCount
            consensusCount
            consensus {
              drug
              oddsRatio
              pvalue
              adjPvalue
              approved
              countSignificant
              countInsignificant
              countUpSignificant
              pvalueUp
              adjPvalueUp
              oddsRatioUp
              pvalueDown
              adjPvalueDown
              oddsRatioDown
              }
              nodes {
                adjPvalueMimic
                adjPvalueReverse
                mimickerOverlap
                oddsRatioMimic
                oddsRatioReverse
                pvalueMimic
                pvalueReverse
                reverserOverlap
                geneSet {
                  nodes {
                    id
                    nGeneIds
                    term
                    geneSetFdaCountsById {
                      nodes {
                        count
                        approved
                        }
                      }
                    }
                  }
                }
              }
            }
          }
    """
  }

  headers = {
        "Accept": "application/json",
        "Content-Type": "application/json"
  }

  response = requests.post(url, data=json.dumps(query), headers=headers)

  response.raise_for_status()
  res = response.json()

  # Assuming you already have the response data loaded as 'res'
  consensus = res['data']['currentBackground']['pairedEnrich']['consensus']
  enrichment = res['data']['currentBackground']['pairedEnrich']['nodes']
  

  df_consensus_pair = pd.DataFrame(consensus).rename(columns={'drug': 'perturbation', 
                                                              'pvalueUp': 'pvalueMimick', 
                                                              'pvalueDown': 'pvalueReverse', 
                                                              'adjPvalueUp': 'adjPvalueMimic', 
                                                              'adjPvalueDown': 'adjPvalueReverse', 
                                                              'oddsRatioUp': 'oddsRatioMimic', 
                                                              'oddsRatioDown': 'oddsRatioReverse'
                                                            })
  df_enrichment_pair = pd.DataFrame(enrichment)
  
  df_enrichment_pair['term'] = df_enrichment_pair['geneSet'].map(lambda t: t['nodes'][0]['term'].split(' ')[0])
  df_enrichment_pair['approved'] = df_enrichment_pair['geneSet'].map(lambda t: t['nodes'][0]['geneSetFdaCountsById']['nodes'][0]['approved'])
  df_enrichment_pair['count'] = df_enrichment_pair['geneSet'].map(lambda t: t['nodes'][0]['geneSetFdaCountsById']['nodes'][0]['count'])
  df_enrichment_pair['nGeneIdsUp'] = df_enrichment_pair['geneSet'].map(lambda t: t['nodes'][0]['nGeneIds'])
  df_enrichment_pair['nGeneIdsDown'] = df_enrichment_pair['geneSet'].map(lambda t: t['nodes'][0]['nGeneIds'])
  df_enrichment_pair["perturbation_id"] = df_enrichment_pair["term"].map(lambda t: t.split('_')[0])
  df_enrichment_pair["timepoint"] = df_enrichment_pair["term"].map(lambda t: t.split('_')[1])
  df_enrichment_pair["cellLine"] = df_enrichment_pair["term"].map(lambda t: t.split('_')[2])
  df_enrichment_pair["batch"] = df_enrichment_pair["term"].map(lambda t: t.split('_')[3])
  # Assuming df_enrichment_pair is your dataframe with a column 'geneSet'
  df_enrichment_pair["geneSetIdUp"] = df_enrichment_pair["geneSet"].map(
      lambda t: next((node['id'] for node in t['nodes'] if ' up' in node['term']), None)
  )

  df_enrichment_pair["geneSetIdDown"] = df_enrichment_pair["geneSet"].map(
      lambda t: next((node['id'] for node in t['nodes'] if ' down' in node['term']), None)
  )

  df_enrichment_pair = df_enrichment_pair.set_index('term')
  df_enrichment_pair = df_enrichment_pair.drop(columns=['geneSet']).reset_index(drop=False)
  df_enrichment_pair

  return df_enrichment_pair, df_consensus_pair
`;

export const upDownOverlap = `
def get_l2s2_up_dn_overlap(genes_up: list[str], genes_down: list[str], id_up: str, id_down: str, overlap_type: str):
    if overlap_type == 'mimicker':
        up_up_overlap = get_l2s2_overlap(genes_up, id_up)
        dn_dn_overlap = get_l2s2_overlap(genes_down, id_down)
        return list(set(up_up_overlap) | set(dn_dn_overlap))
    elif overlap_type == 'reverser':
        up_dn_overlap = get_l2s2_overlap(genes_up, id_down)
        dn_up_overlap = get_l2s2_overlap(genes_down, id_up)
        return list(set(up_dn_overlap) | set(dn_up_overlap))`;

export const validGenes = `
def get_l2s2_valid_genes(genes: list[str]):
    query = {
    "query": """query GenesQuery($genes: [String]!) {
        geneMap2(genes: $genes) {
            nodes {
                gene
                geneInfo {
                    symbol
                    }
                }
            }
        }""",
    "variables": {"genes": genes},
    "operationName": "GenesQuery"
    }
    
    headers = {
        "Accept": "application/json",
        "Content-Type": "application/json"
    }

    response = requests.post(url, data=json.dumps(query), headers=headers)

    response.raise_for_status()
    res = response.json()
    return [g['geneInfo']['symbol'] for g in res['data']['geneMap2']['nodes'] if g['geneInfo'] != None]
`