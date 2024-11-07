-- migrate:up

create table app_public_v2.fda_counts (
    perturbation varchar primary key,
    count int,
    approved boolean
);

grant select on app_public_v2.fda_counts to guest;
grant all privileges on app_public_v2.fda_counts to authenticated;

create materialized view app_public_v2.gene_set_fda_counts as
select gs.id, fda.perturbation, fda.count, fda.approved
from app_public_v2.gene_set gs
inner join app_public_v2.fda_counts fda
on replace(replace(split_part(gs.term, '_', 5), ' up', ' '), ' down', ' ') = fda.perturbation;

create index gene_set_fda_counts_id_idx on app_public_v2.gene_set_fda_counts (id);

grant select on app_public_v2.gene_set_fda_counts to guest;
grant all privileges on app_public_v2.gene_set_fda_counts to authenticated;

comment on materialized view app_public_v2.gene_set_fda_counts is E'@foreignKey (id) references app_public_v2.gene_set (id)';

create function app_public_v2.get_fda_counts_by_id(id uuid)
returns setof app_public_v2.gene_set_fda_counts as
$$
select * from app_public_v2.gene_set_fda_counts where id = $1
$$ language sql immutable strict parallel safe;

grant execute on function app_public_v2.get_fda_counts_by_id to guest, authenticated;

-- migrate:down

drop table app_public_v2.fda_counts cascade;