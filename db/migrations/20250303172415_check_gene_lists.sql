-- migrate:up

create or replace function app_private_v2.indexed_paired_enrich(
  background app_public_v2.background,
  gene_ids_up uuid[],
  gene_ids_down uuid[],
  filter_term varchar default null,
  overlap_ge int default 1,
  pvalue_le double precision default 0.05,
  adj_pvalue_le double precision default 0.05,
  "offset" int default null,
  "first" int default null,
  filter_fda boolean default false,
  sortby varchar default null,
  filter_ko boolean default false,
  top_n int default 10000
) returns app_public_v2.paginated_paired_enrich_result as $$
  import os, requests
  params = dict(
    overlap_ge=overlap_ge,
    pvalue_le=pvalue_le,
    adj_pvalue_le=adj_pvalue_le,
    filter_fda=filter_fda,
    filter_ko=filter_ko
  )
  if len(gene_ids_up) < 1 or len(gene_ids_down) < 1:
    return dict(nodes=[], consensus=[], total_count=0, consensus_count=0)
  if filter_term: params['filter_term'] = filter_term
  if offset: params['offset'] = offset
  if first: params['limit'] = first
  if sortby: params['sortby'] = sortby
  req = requests.post(
    f"{os.environ.get('ENRICH_URL', 'http://l2s2-enrich:8000')}/pairs/{background['id']}",
    params=params,
    json={"up": gene_ids_up, "down": gene_ids_down},
  )
  total_count = req.headers.get('Content-Range').split('/')[1]
  consensus_count = req.headers.get('Content-Range').split('/')[2]
  return dict(nodes=req.json()['results'],  consensus=req.json()['consensus'], total_count=total_count, consensus_count=consensus_count)
$$ language plpython3u immutable parallel safe;


create or replace function app_private_v2.indexed_enrich(
  background app_public_v2.background,
  gene_ids uuid[],
  filter_term varchar default null,
  overlap_ge int default 1,
  pvalue_le double precision default 0.05,
  adj_pvalue_le double precision default 0.05,
  "offset" int default null,
  "first" int default null,
  filter_fda boolean default false,
  sortby varchar default null,
  filter_ko boolean default false,
  top_n int default 10000
) returns app_public_v2.paginated_enrich_result as $$
  import os, requests
  params = dict(
    overlap_ge=overlap_ge,
    pvalue_le=pvalue_le,
    adj_pvalue_le=adj_pvalue_le,
    filter_fda=filter_fda,
    filter_ko=filter_ko
  )
  if len(gene_ids) < 1:
    return dict(nodes=[], consensus=[], total_count=0, consensus_count=0)
  if filter_term: params['filter_term'] = filter_term
  if offset: params['offset'] = offset
  if first: params['limit'] = first
  if sortby: params['sortby'] = sortby
  req = requests.post(
    f"{os.environ.get('ENRICH_URL', 'http://l2s2-enrich:8000')}/{background['id']}",
    params=params,
    json=gene_ids,
  )
  print(req.headers.keys())
  total_count = req.headers.get('Content-Range').split('/')[1]
  consensus_count = req.headers.get('Content-Range').split('/')[2]
  return dict(nodes=req.json()['results'], consensus=req.json()['consensus'], total_count=total_count, consensus_count=consensus_count)
$$ language plpython3u immutable parallel safe;



-- migrate:down

