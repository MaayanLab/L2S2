import psycopg2
import typing as t

FileDescriptor = t.Union[int, str]

def copy_from_tsv(conn: 'psycopg2.connection', table: str, columns: list[str], r: FileDescriptor):
  ''' Copy from a file descriptor into a postgres database table through as psycopg2 connection object
  :param con: The psycopg2.connect object
  :param r: An file descriptor to be opened in read mode
  :param table: The table top copy into
  :param columns: The columns being copied
  '''
  import os
  with conn.cursor() as cur:
    with os.fdopen(r, 'rb', buffering=0, closefd=True) as fr:
      columns = fr.readline().strip().split(b'\t')
      cur.copy_expert(
        sql=f'''
        COPY {table} ({",".join(f'"{c.decode()}"' for c in columns)})
        FROM STDIN WITH CSV DELIMITER E'\\t'
        ''',
        file=fr,
      )
    conn.commit()

def copy_from_records(conn: 'psycopg2.connection', table: str, columns: list[str], records: t.Iterable[dict]):
  ''' Copy from records into a postgres database table through as psycopg2 connection object.
  This is done by constructing a unix pipe, writing the records with csv writer
   into the pipe while loading from the pipe into postgres at the same time.
  :param con: The psycopg2.connect object
  :param table: The table to write the pandas dataframe into
  :param columns: The columns being written into the table
  :param records: An iterable of records to write
  '''
  import os, csv, threading
  r, w = os.pipe()
  # we copy_from_tsv with the read end of this pipe in
  #  another thread
  rt = threading.Thread(
    target=copy_from_tsv,
    args=(conn, table, columns, r,),
  )
  rt.start()
  try:
    # we write to the write end of this pipe in this thread
    with os.fdopen(w, 'w', closefd=True) as fw:
      writer = csv.DictWriter(fw, fieldnames=columns, delimiter='\t')
      writer.writeheader()
      writer.writerows(records)
  finally:
    # we wait for the copy_from_tsv thread to finish
    rt.join()
