-- migrate:up

drop materialized view app_public_v2.gene_set_fda_counts cascade;

create materialized view app_public_v2.gene_set_fda_counts as
select gs.id, fda.perturbation, fda.count, fda.approved, fda.moa
from app_public_v2.gene_set gs
inner join app_public_v2.fda_counts fda
on replace(replace(split_part(gs.term, '_', 5), ' up', ' '), ' down', ' ') = fda.perturbation;

create index gene_set_fda_counts_id_idx on app_public_v2.gene_set_fda_counts (id);

grant select on app_public_v2.gene_set_fda_counts to guest;
grant all privileges on app_public_v2.gene_set_fda_counts to authenticated;

comment on materialized view app_public_v2.gene_set_fda_counts is E'@foreignKey (id) references app_public_v2.gene_set (id)';

create or replace function app_public_v2.get_fda_counts_by_id(id uuid)
returns setof app_public_v2.gene_set_fda_counts as
$$
select * from app_public_v2.gene_set_fda_counts where id = $1
$$ language sql immutable strict parallel safe;

grant execute on function app_public_v2.get_fda_counts_by_id to guest, authenticated;

-- migrate:down

drop materialized view app_public_v2.gene_set_fda_counts cascade;