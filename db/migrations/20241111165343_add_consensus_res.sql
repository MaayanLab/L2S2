-- migrate:up
drop type if exists app_public_v2.paginated_enrich_result cascade;
drop type if exists app_public_v2.consensus_result cascade;

create type app_public_v2.consensus_result as (
    drug varchar,  
    count_significant int,
    count_insignificant int,
    count_up_significant int,
    pvalue_up double precision,
    adj_pvalue_up double precision,
    odds_ratio_up double precision,
    pvalue_down double precision,
    adj_pvalue_down double precision,
    odds_ratio_down double precision,
    approved boolean,
    odds_ratio double precision,
    pvalue double precision,
    adj_pvalue double precision
);

create type app_public_v2.paginated_enrich_result as (
  nodes app_public_v2.enrich_result[],
  consensus app_public_v2.consensus_result[],
  total_count int,
  consensus_count int
);

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
  filter_ko boolean default false
) returns app_public_v2.paginated_enrich_result as $$
  import os, requests
  params = dict(
    overlap_ge=overlap_ge,
    pvalue_le=pvalue_le,
    adj_pvalue_le=adj_pvalue_le,
    filter_fda=filter_fda,
    filter_ko=filter_ko
  )
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

create or replace function app_public_v2.background_enrich(
  background app_public_v2.background,
  genes varchar[],
  filter_term varchar default null,
  overlap_ge int default 1,
  pvalue_le double precision default 0.05,
  adj_pvalue_le double precision default 0.05,
  "offset" int default null,
  "first" int default null,
  filter_fda boolean default false,
  sortby varchar default null,
  filter_ko boolean default false
) returns app_public_v2.paginated_enrich_result
as $$
  select r.*
  from app_private_v2.indexed_enrich(
    background_enrich.background,
    (select array_agg(gene_id) from app_public_v2.gene_map(genes) gm),
    background_enrich.filter_term,
    background_enrich.overlap_ge,
    background_enrich.pvalue_le,
    background_enrich.adj_pvalue_le,
    background_enrich."offset",
    background_enrich."first",
    background_enrich.filter_fda,
    background_enrich.sortby,
    background_enrich.filter_ko
  ) r;
$$ language sql immutable parallel safe security definer;
grant execute on function app_public_v2.background_enrich to guest, authenticated;



-- migrate:down

drop type if exists app_public_v2.paginated_enrich_result cascade;
drop type if exists app_public_v2.consensus_result cascade;