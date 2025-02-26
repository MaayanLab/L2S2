#%%
import requests
import json
import pandas as pd

url = "https://l2s2.maayanlab.cloud/graphql"

def enrich_l2s2_single_set(geneset: list, first=10):
    query = {
    "operationName": "EnrichmentQuery",
    "variables": {
        "filterTerm": " ",
        "offset": 0,
        "first": first,
        "filterFda": False,
        "sortBy": "pvalue",
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
    df_enrichment["approved"] = df_enrichment["geneSetFdaCountsById.nodes"].map(lambda x: x[0]['approved'])
    df_enrichment["count"] = df_enrichment["geneSetFdaCountsById.nodes"].map(lambda x: x[0]['count'])
    df_enrichment.drop(columns=['geneSetFdaCountsById.nodes'], inplace=True)
    df_enrichment['batch'] = df_enrichment["term"].map(lambda t: t.split('_')[0])
    df_enrichment["timepoint"] = df_enrichment["term"].map(lambda t: t.split('_')[1])
    df_enrichment["cellLine"] = df_enrichment["term"].map(lambda t: t.split('_')[2])
    df_enrichment["batch2"] = df_enrichment["term"].map(lambda t: t.split('_')[3])
    
    df_enrichment["perturbation"] = df_enrichment["term"].map(lambda t: t.split('_')[4].split(' ')[0] + " KO" if len(t.split('_')[4].split(' ')) == 2 else t.split('_')[4])
    
    df_enrichment['concentration'] = df_enrichment["term"].map(lambda t: t.split('_')[5].split(' ')[0] if len(t.split('_')) > 5 else "N/A")
    df_enrichment['direction'] = df_enrichment["term"].map(lambda t: t.split(' ')[1])

    return df_enrichment, df_consensus

# %%


def get_overlap(genes, id):
    query = {
    "operationName": "OverlapQuery",
    "variables": {
        "id": id,
        "genes": genes
    },
    "query": "query OverlapQuery($id: UUID!, $genes: [String]!) {geneSet(id: $id) {\n    overlap(genes: $genes) {\n      nodes {\n        symbol\n        ncbiGeneId\n        description\n        summary\n      }   }}}"
    }
    
    headers = {
        "Accept": "application/json",
        "Content-Type": "application/json"
    }

    response = requests.post(url, data=json.dumps(query), headers=headers)
    
    response.raise_for_status()
    res = response.json()
    return [item['symbol'] for item in res['data']['geneSet']['overlap']['nodes']]
# %%

def enrichr_add_list(genes, description):
    ENRICHR_URL = 'https://maayanlab.cloud/Enrichr/addList'
    
    genes_str = '\n'.join(genes)
    description = description
    payload = {
        'list': (None, genes_str),
        'description': (None, description)
    }

    response = requests.post(ENRICHR_URL, files=payload)
    response.raise_for_status()

    data = json.loads(response.text)
    return data['userListId'], data['shortId']

# %%
