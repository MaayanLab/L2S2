-- migrate:up

create or replace function app_public_v2.paired_enrich_result_gene_set(paired_enrich_result app_public_v2.paired_enrich_result) returns setof app_public_v2.gene_set
as $$
  select gs.*
  from app_public_v2.gene_set gs
  where gs.hash = paired_enrich_result.gene_set_hash_up or gs.hash = paired_enrich_result.gene_set_hash_down;
$$ language sql immutable strict;
grant execute on function app_public_v2.paired_enrich_result_gene_set to guest, authenticated;

-- migrate:down

drop function app_public_v2.paired_enrich_result_gene_set;