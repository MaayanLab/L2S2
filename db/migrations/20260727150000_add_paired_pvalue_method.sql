-- migrate:up

drop function app_public_v2.background_paired_enrich(
  app_public_v2.background,
  varchar[],
  varchar[],
  varchar,
  int,
  double precision,
  double precision,
  int,
  int,
  boolean,
  varchar,
  boolean,
  int
);

drop function app_private_v2.indexed_paired_enrich(
  app_public_v2.background,
  uuid[],
  uuid[],
  varchar,
  int,
  double precision,
  double precision,
  int,
  int,
  boolean,
  varchar,
  boolean,
  int
);

create function app_private_v2.indexed_paired_enrich(
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
  import os, requests
  params = dict(
    overlap_ge=overlap_ge,
    pvalue_le=pvalue_le,
    adj_pvalue_le=adj_pvalue_le,
    filter_fda=filter_fda,
    filter_ko=filter_ko,
    top_n=top_n
  )
  if len(gene_ids_up) < 1 or len(gene_ids_down) < 1:
    return dict(nodes=[], consensus=[], total_count=0, consensus_count=0)
  if filter_term: params['filter_term'] = filter_term
  if offset: params['offset'] = offset
  if first: params['limit'] = first
  if sortby: params['sortby'] = sortby
  if pvalue_method: params['pvalue_method'] = pvalue_method
  req = requests.post(
    f"{os.environ.get('ENRICH_URL', 'http://l2s2-enrich:8000')}/pairs/{background['id']}",
    params=params,
    json={"up": gene_ids_up, "down": gene_ids_down},
  )
  total_count = req.headers.get('Content-Range').split('/')[1]
  consensus_count = req.headers.get('Content-Range').split('/')[2]
  moas_count = req.headers.get('Content-Range').split('/')[3]

  return dict(nodes=req.json()['results'], consensus=req.json()['consensus'], moas=req.json()['moas'], total_count=total_count, consensus_count=consensus_count, moas_count=moas_count)
$$ language plpython3u immutable parallel safe;

create function app_public_v2.background_paired_enrich(
  background app_public_v2.background,
  genes_up varchar[],
  genes_down varchar[],
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
) returns app_public_v2.paginated_paired_enrich_result
as $$
  select r.*
  from app_private_v2.indexed_paired_enrich(
    background_paired_enrich.background,
    (select array_agg(gene_id) from app_public_v2.gene_map(genes_up) gm),
    (select array_agg(gene_id) from app_public_v2.gene_map(genes_down) gm),
    background_paired_enrich.filter_term,
    background_paired_enrich.overlap_ge,
    background_paired_enrich.pvalue_le,
    background_paired_enrich.adj_pvalue_le,
    background_paired_enrich."offset",
    background_paired_enrich."first",
    background_paired_enrich.filter_fda,
    background_paired_enrich.sortby,
    background_paired_enrich.filter_ko,
    background_paired_enrich.top_n,
    background_paired_enrich.pvalue_method
  ) r;
$$ language sql immutable parallel safe security definer;

grant execute on function app_public_v2.background_paired_enrich to guest, authenticated;

-- migrate:down

drop function app_public_v2.background_paired_enrich(
  app_public_v2.background,
  varchar[],
  varchar[],
  varchar,
  int,
  double precision,
  double precision,
  int,
  int,
  boolean,
  varchar,
  boolean,
  int,
  varchar
);

drop function app_private_v2.indexed_paired_enrich(
  app_public_v2.background,
  uuid[],
  uuid[],
  varchar,
  int,
  double precision,
  double precision,
  int,
  int,
  boolean,
  varchar,
  boolean,
  int,
  varchar
);

create function app_private_v2.indexed_paired_enrich(
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
    filter_ko=filter_ko,
    top_n=top_n
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
  moas_count = req.headers.get('Content-Range').split('/')[3]

  return dict(nodes=req.json()['results'], consensus=req.json()['consensus'], moas=req.json()['moas'], total_count=total_count, consensus_count=consensus_count, moas_count=moas_count)
$$ language plpython3u immutable parallel safe;

create function app_public_v2.background_paired_enrich(
  background app_public_v2.background,
  genes_up varchar[],
  genes_down varchar[],
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
) returns app_public_v2.paginated_paired_enrich_result
as $$
  select r.*
  from app_private_v2.indexed_paired_enrich(
    background_paired_enrich.background,
    (select array_agg(gene_id) from app_public_v2.gene_map(genes_up) gm),
    (select array_agg(gene_id) from app_public_v2.gene_map(genes_down) gm),
    background_paired_enrich.filter_term,
    background_paired_enrich.overlap_ge,
    background_paired_enrich.pvalue_le,
    background_paired_enrich.adj_pvalue_le,
    background_paired_enrich."offset",
    background_paired_enrich."first",
    background_paired_enrich.filter_fda,
    background_paired_enrich.sortby,
    background_paired_enrich.filter_ko,
    background_paired_enrich.top_n
  ) r;
$$ language sql immutable parallel safe security definer;

grant execute on function app_public_v2.background_paired_enrich to guest, authenticated;
