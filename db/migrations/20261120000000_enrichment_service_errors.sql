-- migrate:up

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
  import os, plpy, requests

  params = dict(
    overlap_ge=overlap_ge,
    pvalue_le=pvalue_le,
    adj_pvalue_le=adj_pvalue_le,
    filter_fda=filter_fda,
    filter_ko=filter_ko,
    top_n=top_n
  )
  if len(gene_ids) < 1:
    return dict(nodes=[], consensus=[], moas=[], total_count=0, consensus_count=0, moas_count=0)
  if filter_term: params['filter_term'] = filter_term
  if offset: params['offset'] = offset
  if first: params['limit'] = first
  if sortby: params['sortby'] = sortby

  try:
    req = requests.post(
      f"{os.environ.get('ENRICH_URL', 'http://l2s2-enrich:8000')}/{background['id']}",
      params=params,
      json=gene_ids,
      timeout=(1, 5),
    )
  except requests.exceptions.Timeout:
    plpy.error('Enrichment service request timed out.', sqlstate='L2S02')
  except requests.exceptions.RequestException as error:
    plpy.error(f'Enrichment service request failed: {error}', sqlstate='L2S03')

  if req.status_code == 503:
    plpy.error('Enrichment index is initializing; please retry shortly.', sqlstate='L2S01')
  try:
    req.raise_for_status()
  except requests.exceptions.RequestException as error:
    plpy.error(f'Enrichment service request failed: {error}', sqlstate='L2S03')

  content_range = req.headers.get('Content-Range')
  if not content_range:
    plpy.error('Enrichment service returned an invalid response.', sqlstate='L2S03')
  counts = content_range.split('/')
  if len(counts) < 4:
    plpy.error('Enrichment service returned an invalid response.', sqlstate='L2S03')

  body = req.json()
  return dict(
    nodes=body['results'],
    consensus=body['consensus'],
    moas=body['moas'],
    total_count=counts[1],
    consensus_count=counts[2],
    moas_count=counts[3]
  )
$$ language plpython3u immutable parallel safe;

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
  top_n int default 10000,
  pvalue_method varchar default null
) returns app_public_v2.paginated_paired_enrich_result as $$
  import os, plpy, requests

  params = dict(
    overlap_ge=overlap_ge,
    pvalue_le=pvalue_le,
    adj_pvalue_le=adj_pvalue_le,
    filter_fda=filter_fda,
    filter_ko=filter_ko,
    top_n=top_n
  )
  if len(gene_ids_up) < 1 or len(gene_ids_down) < 1:
    return dict(nodes=[], consensus=[], moas=[], total_count=0, consensus_count=0, moas_count=0)
  if filter_term: params['filter_term'] = filter_term
  if offset: params['offset'] = offset
  if first: params['limit'] = first
  if sortby: params['sortby'] = sortby
  if pvalue_method: params['pvalue_method'] = pvalue_method

  try:
    req = requests.post(
      f"{os.environ.get('ENRICH_URL', 'http://l2s2-enrich:8000')}/pairs/{background['id']}",
      params=params,
      json={"up": gene_ids_up, "down": gene_ids_down},
      timeout=(1, 5),
    )
  except requests.exceptions.Timeout:
    plpy.error('Enrichment service request timed out.', sqlstate='L2S02')
  except requests.exceptions.RequestException as error:
    plpy.error(f'Enrichment service request failed: {error}', sqlstate='L2S03')

  if req.status_code == 503:
    plpy.error('Enrichment index is initializing; please retry shortly.', sqlstate='L2S01')
  try:
    req.raise_for_status()
  except requests.exceptions.RequestException as error:
    plpy.error(f'Enrichment service request failed: {error}', sqlstate='L2S03')

  content_range = req.headers.get('Content-Range')
  if not content_range:
    plpy.error('Enrichment service returned an invalid response.', sqlstate='L2S03')
  counts = content_range.split('/')
  if len(counts) < 4:
    plpy.error('Enrichment service returned an invalid response.', sqlstate='L2S03')

  body = req.json()
  return dict(
    nodes=body['results'],
    consensus=body['consensus'],
    moas=body['moas'],
    total_count=counts[1],
    consensus_count=counts[2],
    moas_count=counts[3]
  )
$$ language plpython3u immutable parallel safe;

-- migrate:down

-- These error contracts are consumed by the UI and intentionally have no
-- automatic downgrade. Restore the previous function bodies if rollback is
-- required.
