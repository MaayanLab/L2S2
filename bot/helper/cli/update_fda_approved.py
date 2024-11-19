from tqdm import tqdm
from helper.cli import cli


def update_count_fda_info(plpy):
    import json
    with open("data/counts_perts.json") as f:
        counts_perts = json.load(f)
    with open("data/fda_approved_new.json") as f:
        fda_drugs = json.load(f)

    # Construct SQL query
    sql_query = """
        INSERT INTO app_public_v2.fda_counts (perturbation, count, approved)
        VALUES (%s, %s, %s)
        ON CONFLICT (perturbation)
        DO UPDATE SET
            count = EXCLUDED.count,
            approved = EXCLUDED.approved;
    """

    # Prepare data as a list of tuples
    data = [
        (pert, int(counts_perts[pert]), pert.upper() in fda_drugs)
        for pert in counts_perts
    ]

    # Execute in chunks if necessary
    with plpy.conn.cursor() as cursor:
        for row in tqdm(data, desc="Inserting chemical perturbation info.."):
            cursor.execute(sql_query, row)
        
        
@cli.command()
def update_counts_fda():
    from helper.plpy import plpy
    try:
        update_count_fda_info(plpy)
    except:
        plpy.conn.rollback()
        raise
    else:
        plpy.conn.commit()
