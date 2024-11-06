import traceback
from tqdm import tqdm
from helper.cli import cli
from helper.utils import copy_from_records


def import_count_fda_info(plpy):
    import json

    with open("data/counts_genes.json") as f:
        counts_genes = json.load(f)
    with open("data/counts_perts.json") as f:
        counts_perts = json.load(f)
    with open("data/fda_approved.json") as f:
        fda_drugs = json.load(f)

    copy_from_records(
        plpy.conn,
        "app_public_v2.fda_counts",
        ("perturbation", "count", "approved"),
        tqdm(
            (
                dict(
                    perturbation=g + ' ', # there are overlapping gene names + drug names so the space is the differentiator, not ideal but its already baked into the term
                    count=int(counts_genes[g]),
                    approved=False,
                )
                for g in counts_genes
            ),
            total=len(counts_genes),
            desc="Inserting gene KO info..",
        ),
    )
    
    copy_from_records(
        plpy.conn,
        "app_public_v2.fda_counts",
        ("perturbation", "count", "approved"),
        tqdm(
            (
                dict(
                    perturbation=pert,
                    count=int(counts_perts[pert]),
                    approved=pert.upper() in fda_drugs,
                )
                for pert in counts_perts
            ),
            total=len(counts_perts),
            desc="Inserting chemical perturbation info..",
        ),
    )
    

@cli.command()
def ingest_counts_fda():
    from helper.plpy import plpy
    try:
        import_count_fda_info(plpy)
    except:
        plpy.conn.rollback()
        raise
    else:
        plpy.conn.commit()
