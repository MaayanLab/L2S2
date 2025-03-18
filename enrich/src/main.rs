mod async_rwlockhashmap;
mod fastfisher;
mod bitvec;

#[macro_use] extern crate rocket;
use async_lock::RwLock;
use futures::StreamExt;
use num::Integer;
use rocket::http::ContentType;
use std::future;
use std::io::Cursor;
use std::collections::HashMap;
use rocket::request::Request;
use rocket::response::{self, Response, Responder, stream::TextStream};
use rocket_db_pools::{Database, Connection};
use rocket_db_pools::sqlx::{self, Row};
use rayon::prelude::*;
use uuid::Uuid;
use adjustp::{adjust, Procedure};
use rocket::{State, response::status::Custom, http::Status};
use rocket::serde::{json::{json, Json, Value}, Serialize, Deserialize};
use std::sync::Arc;
use retainer::Cache;
use std::time::Instant;

use fastfisher::FastFisher;
use async_rwlockhashmap::RwLockHashMap;
use bitvec::{SparseBitVec,DenseBitVec,compute_overlap};

/**
 * Without this alternative allocator, very large chunks of memory do not get released back to the OS causing a large memory footprint over time.
 */
#[global_allocator]
static GLOBAL: tikv_jemallocator::Jemalloc = tikv_jemallocator::Jemalloc;

#[derive(Database)]
#[database("postgres")]
struct Postgres(sqlx::PgPool);

#[derive(Deserialize)]
struct InputGeneSets {
    up: Vec<String>,
    down: Vec<String>,
}


struct Bitmap<B: Integer + Copy + Into<usize>> {
    columns: HashMap<Uuid, B>,
    columns_str: Vec<String>,
    values: Vec<(Uuid, SparseBitVec<B>)>,
    terms: HashMap<Uuid, Vec<(Uuid, String, String, bool, i32, String)>>,
    signature_pairs: SignaturePairs, // Store pairs persistently
}

struct SignaturePairs {
    pairs: Vec<(usize, usize)>, // Stores index pairs for "up" and "down" signatures
}

impl<B: Integer + Copy + Into<usize>> Bitmap<B> {
    fn new() -> Self {
        Bitmap {
            columns: HashMap::new(),
            columns_str: Vec::new(),
            values: Vec::new(),
            terms: HashMap::new(),
            signature_pairs: SignaturePairs { pairs: Vec::new() }, // Empty initially
        }
    }

    /// Call this after inserting all terms to compute signature pairs
    fn finalize(&mut self) {
        self.signature_pairs = self.get_signature_pairs();
    }

    fn get_signature_pairs(&self) -> SignaturePairs {
        let mut name_to_indices: HashMap<String, (Option<usize>, Option<usize>)> = HashMap::new();
    
        // Iterate over values to ensure indices align with `values`
        for (idx, (uuid, _)) in self.values.iter().enumerate() {
            if let Some(term_vec) = self.terms.get(uuid) {
                for (_term_id, full_name, _, _, _, _) in term_vec {
                    if let Some(base_name) = full_name.strip_suffix(" up") {
                        name_to_indices.entry(base_name.to_string()).or_insert((None, None)).0 = Some(idx);
                    } else if let Some(base_name) = full_name.strip_suffix(" down") {
                        name_to_indices.entry(base_name.to_string()).or_insert((None, None)).1 = Some(idx);
                    }
                }
            }
        }
    
        // Extract valid pairs
        let pairs = name_to_indices
            .into_iter()
            .filter_map(|(_base_name, (up_idx, down_idx))| Some((up_idx?, down_idx?)))
            .collect();
    
        SignaturePairs { pairs }
    }
    
}

#[derive(Eq, PartialEq, PartialOrd, Ord)]
struct BackgroundQuery {
    background_id: Uuid,
    input_gene_set: DenseBitVec,
}

#[derive(Eq, PartialEq, PartialOrd, Ord)]
struct BackgroundQueryPair {
    background_id: Uuid,
    input_gene_set_up: DenseBitVec,
    input_gene_set_down: DenseBitVec,
}

// This structure stores a persistent many-reader single-writer hashmap containing cached indexes for a given background id
struct PersistentState { 
    fisher: RwLock<FastFisher>,
    // NOTE: Bitmap<u16> limits the number of genes to 65K -- to support more than that, use u32/u64 at the cost of more memory
    bitmaps: RwLockHashMap<Uuid, Bitmap<u16>>,
    latest: RwLock<Option<Uuid>>,
    cache: Cache<Arc<BackgroundQuery>, Arc<Vec<PartialQueryResult>>>,
    cachepair: Cache<Arc<BackgroundQueryPair>, Arc<Vec<PartialPairResult>>>,
}

// The response data, containing the ids, and relevant metrics
struct PartialQueryResult {
    index: usize,
    n_overlap: u32,
    odds_ratio: f64,
    pvalue: f64,
    adj_pvalue: f64,
}

struct PartialPairResult {
    index: usize,
    index_up: usize,      
    index_down: usize,    
    mimicker_overlap: u32, 
    reverser_overlap: u32, 
    odds_ratio_mimic: f64,
    odds_ratio_reverse: f64, 
    pvalue_mimic: f64, 
    adj_pvalue_mimic: f64, 
    pvalue_reverse: f64,
    adj_pvalue_reverse: f64,
}

#[derive(Serialize, Debug)]
struct QueryResult {
    gene_set_hash: String,
    n_overlap: u32,
    odds_ratio: f64,
    pvalue: f64,
    adj_pvalue: f64,
}

#[derive(Serialize, Debug)]
struct PairedQueryResult {
    gene_set_hash_up: String,
    gene_set_hash_down: String,      
    mimicker_overlap: u32, 
    reverser_overlap: u32, 
    odds_ratio_mimic: f64,
    odds_ratio_reverse: f64, 
    pvalue_mimic: f64, 
    adj_pvalue_mimic: f64, 
    pvalue_reverse: f64,
    adj_pvalue_reverse: f64,
}

#[derive(Serialize, Debug)]
struct DrugConsensusResult {
    drug: String,
    count_significant: usize,
    count_insignificant: usize,
    count_up_significant: usize,
    pvalue_up: f64,
    adj_pvalue_up: f64,
    odds_ratio_up: f64,
    pvalue_down: f64,
    adj_pvalue_down: f64,
    odds_ratio_down: f64,
    approved: bool,
    odds_ratio: f64,
    pvalue: f64,
    adj_pvalue: f64,
}

struct QueryResponse {
    results: Vec<QueryResult>,
    consensus: Vec<DrugConsensusResult>,
    content_range: (usize, usize, usize, usize),
}

struct PairedQueryResponse {
    results: Vec<PairedQueryResult>,
    consensus: Vec<DrugConsensusResult>,
    content_range: (usize, usize, usize, usize),
}


#[rocket::async_trait]
impl<'r> Responder<'r, 'static> for QueryResponse {
    fn respond_to(self, _: &'r Request<'_>) -> response::Result<'static> {
        let json = rocket::serde::json::serde_json::json!({
            "results": &self.results,
            "consensus": &self.consensus
        });
        let json_str = rocket::serde::json::serde_json::to_string(&json).unwrap();
        Response::build()
            .header(ContentType::JSON)
            .raw_header("Range-Unit", "items")
            .raw_header("Content-Range", format!("{}-{}/{}/{}", self.content_range.0, self.content_range.1, self.content_range.2, self.content_range.3))
            .sized_body(json_str.len(), Cursor::new(json_str))
            .ok()
    }
}

#[rocket::async_trait]
impl<'r> Responder<'r, 'static> for PairedQueryResponse {
    fn respond_to(self, _: &'r Request<'_>) -> response::Result<'static> {
        let json = rocket::serde::json::serde_json::json!({
            "results": &self.results,
            "consensus": &self.consensus
        });
        let json_str = rocket::serde::json::serde_json::to_string(&json).unwrap();
        Response::build()
            .header(ContentType::JSON)
            .raw_header("Range-Unit", "items")
            .raw_header("Content-Range", format!("{}-{}/{}/{}", self.content_range.0, self.content_range.1, self.content_range.2, self.content_range.3))
            .sized_body(json_str.len(), Cursor::new(json_str))
            .ok()
    }
}


// Ensure the specific background_id exists in state, resolving it if necessary
async fn ensure_index(db: &mut Connection<Postgres>, state: &State<PersistentState>, background_id: Uuid) -> Result<(), String> {
    if state.bitmaps.contains_key(&background_id).await {
        return Ok(())
    }

    println!("[{}] initializing", background_id);
    let start = Instant::now();
    {
        // this lets us write a new bitmap by only blocking the whole hashmap for a short period to register the new bitmap
        // after which we block the new empty bitmap for writing
        let mut bitmap = state.bitmaps.insert_write(background_id, Bitmap::new()).await;

        let background_info = sqlx::query("select id, (select jsonb_object_agg(g.id, g.symbol) from jsonb_each(gene_ids) bg(gene_id, nil) inner join app_public_v2.gene g on bg.gene_id::uuid = g.id) as genes from app_public_v2.background b where id = $1::uuid;")
            .bind(background_id.to_string())
            .fetch_one(&mut **db).await.map_err(|e| e.to_string())?;

        let background_genes: sqlx::types::Json<HashMap<String, String>> = background_info.try_get("genes").map_err(|e| e.to_string())?;
        let mut background_genes = background_genes.iter().map(|(id, symbol)| Ok((Uuid::parse_str(id).map_err(|e| e.to_string())?, symbol.clone()))).collect::<Result<Vec<_>, String>>()?;
        background_genes.sort_unstable();
        {
            let mut fisher = state.fisher.write().await;
            fisher.extend_to(background_genes.len()*4);
        };
        bitmap.columns.reserve(background_genes.len());
        bitmap.columns_str.reserve(background_genes.len());
        for (i, (gene_id, gene)) in background_genes.into_iter().enumerate() {
            bitmap.columns.insert(gene_id, i as u16);
            bitmap.columns_str.push(gene);
        }

        // compute the index in memory
        sqlx::query("select gs.id, gs.term, coalesce(gs.description, '') as description, gs.hash, gs.gene_ids, fda.approved as fda_approved, fda.count as count, fda.perturbation as pert from  app_public_v2.gene_set gs left join app_public_v2.gene_set_fda_counts fda on gs.id = fda.id;")
            .fetch(&mut **db)
            .for_each(|row| {
                let row = row.unwrap();
                let gene_set_id: uuid::Uuid = row.try_get("id").unwrap();
                let term: String = row.try_get("term").unwrap();
                let description: String = row.try_get("description").unwrap();
                let gene_set_hash: Result<uuid::Uuid, _> = row.try_get("hash");
                let fda_approved: bool = row.try_get::<bool, &str>("fda_approved").unwrap_or(false);
                let count: i32 = row.try_get("count").unwrap_or(0);
                let pert: String = row.try_get("pert").unwrap_or("").to_string();
                if let Ok(gene_set_hash) = gene_set_hash {
                    if !bitmap.terms.contains_key(&gene_set_hash) {
                        let gene_ids: sqlx::types::Json<HashMap<String, sqlx::types::JsonValue>> = row.try_get("gene_ids").unwrap();
                        let gene_ids = gene_ids.keys().map(|gene_id| Uuid::parse_str(gene_id).unwrap()).collect::<Vec<Uuid>>();
                        let bitset = SparseBitVec::new(&bitmap.columns, &gene_ids);
                        bitmap.values.push((gene_set_hash, bitset));
                    }
                    bitmap.terms.entry(gene_set_hash).or_default().push((gene_set_id, term, description, fda_approved, count, pert));
                }
                future::ready(())
            })
            .await;
        // compute and store pairs
        bitmap.finalize();
    }
    
    let duration = start.elapsed();
    println!("[{}] initialized in {:?}", background_id, duration);
    {
        let mut latest = state.latest.write().await;
        latest.replace(background_id);
    }
    Ok(())
}

#[get("/<background_id>")]
async fn ensure(
    mut db: Connection<Postgres>,
    state: &State<PersistentState>,
    background_id: &str,
) -> Result<Value, Custom<String>> {
    let background_id = Uuid::parse_str(background_id).map_err(|e| Custom(Status::BadRequest, e.to_string()))?;
    ensure_index(&mut db, &state, background_id).await.map_err(|e| Custom(Status::InternalServerError, e.to_string()))?;
    let bitmap = state.bitmaps.get_read(&background_id).await.ok_or(Custom(Status::NotFound, String::from("Can't find background")))?;
    Ok(json!({
        "columns": bitmap.columns.len(),
        "index": bitmap.values.len(),
    }))
}

/**
 * This is a helper for building a GMT file on the fly, it's much cheaper to do this here
 *  than fetch it from the database, it's also nice since we won't need to save raw files.
 */
#[get("/<background_id>/gmt")]
async fn get_gmt(
    mut db: Connection<Postgres>,
    state: &State<PersistentState>,
    background_id: String,
) -> Result<TextStream![String + '_], Custom<String>> {
    let background_id = {
        if background_id == "latest" {
            let latest = state.latest.read().await;
            latest.clone().ok_or(Custom(Status::NotFound, String::from("Nothing loaded")))?
        } else {
            Uuid::parse_str(&background_id).map_err(|e| Custom(Status::BadRequest, e.to_string()))?
        }
    };
    ensure_index(&mut db, &state, background_id).await.map_err(|e| Custom(Status::InternalServerError, e.to_string()))?;
    let bitmap = state.bitmaps.get_read(&background_id).await.ok_or(Custom(Status::InternalServerError, String::from("Can't find background")))?;
    Ok(TextStream! {
        for (gene_set_hash, gene_set) in bitmap.values.iter() {
            if let Some(terms) = bitmap.terms.get(gene_set_hash) {
                for (_row_id, term, description, _fda_approved, _count, _pert) in terms.iter() {
                    let mut line = String::new();
                    line.push_str(term);
                    line.push_str("\t");
                    line.push_str(description);
                    for col_ind in gene_set.v.iter() {
                        line.push_str("\t");
                        line.push_str(&bitmap.columns_str[*col_ind as usize]);
                    }
                    line.push_str("\n");
                    yield line
                }
            }
        }
    })
}

#[delete("/<background_id>")]
async fn delete(
    state: &State<PersistentState>,
    background_id: &str,
) -> Result<(), Custom<String>> {
    let background_id = {
        if background_id == "latest" {
            let latest = state.latest.read().await;
            latest.clone().ok_or(Custom(Status::NotFound, String::from("Nothing loaded")))?
        } else {
            Uuid::parse_str(&background_id).map_err(|e| Custom(Status::BadRequest, e.to_string()))?
        }
    };
    if !state.bitmaps.contains_key(&background_id).await {
        return Err(Custom(Status::NotFound, String::from("Not Found")));
    }
    if state.bitmaps.remove(&background_id).await {
        println!("[{}] deleted", background_id);
    }
    Ok(())
}

// query a specific background_id, providing the bitset vector as input
//  the result are the gene_set_ids & relevant metrics
// this can be pretty fast since the index is saved in memory and the overlaps can be computed in parallel
#[post("/<background_id>?<filter_term>&<overlap_ge>&<pvalue_le>&<adj_pvalue_le>&<offset>&<limit>&<filter_fda>&<sortby>&<filter_ko>&<top_n>", data = "<input_gene_set>")]
async fn query(
    mut db: Connection<Postgres>,
    state: &State<PersistentState>,
    input_gene_set: Json<Vec<String>>,
    background_id: &str,
    filter_term: Option<String>,
    overlap_ge: Option<u32>,
    pvalue_le: Option<f64>,
    adj_pvalue_le: Option<f64>,
    offset: Option<usize>,
    limit: Option<usize>,
    filter_fda: Option<bool>,
    sortby: Option<String>,
    filter_ko: Option<bool>,
    top_n: Option<usize>,
) -> Result<QueryResponse, Custom<String>> {
    let background_id = {
        if background_id == "latest" {
            let latest = state.latest.read().await;
            latest.clone().ok_or(Custom(Status::NotFound, String::from("Nothing loaded")))?
        } else {
            Uuid::parse_str(&background_id).map_err(|e| Custom(Status::BadRequest, e.to_string()))?
        }
    };
    ensure_index(&mut db, &state, background_id).await.map_err(|e| Custom(Status::InternalServerError, e.to_string()))?;
    let start = Instant::now();
    let input_gene_set = input_gene_set.0.into_iter().map(|gene| Uuid::parse_str(&gene)).collect::<Result<Vec<_>, _>>().map_err(|e| Custom(Status::BadRequest, e.to_string()))?;
    let bitmap = state.bitmaps.get_read(&background_id).await.ok_or(Custom(Status::NotFound, String::from("Can't find background")))?;
    let input_gene_set = DenseBitVec::new(&bitmap.columns, &input_gene_set);
    let filter_term = filter_term.and_then(|filter_term| Some(filter_term.to_lowercase()));
    let overlap_ge = overlap_ge.unwrap_or(1);
    let pvalue_le =  pvalue_le.unwrap_or(1.0);
    let adj_pvalue_le =  adj_pvalue_le.unwrap_or(1.0);
    let sortby = sortby.and_then(|sortby| Some(sortby));
    let top_n = top_n.unwrap_or(1000);
    let background_query = Arc::new(BackgroundQuery { background_id, input_gene_set });
    let results = {
        let results = state.cache.get(&background_query).await;
        if let Some(results) = results {
            results.value().clone()
        } else {
            // parallel overlap computation
            let n_background = bitmap.columns.len() as u32;
            let n_user_gene_id = background_query.input_gene_set.n as u32;
            let fisher = state.fisher.read().await;
            let mut results: Vec<_> = bitmap.values.par_iter()
                .enumerate()
                .filter_map(|(index, (_gene_set_hash, gene_set))| {
                    let n_overlap = compute_overlap(&background_query.input_gene_set, &gene_set) as u32;
                    if n_overlap < overlap_ge {
                        return None
                    }
                    let n_gs_gene_id = gene_set.v.len() as u32;
                    let a = n_overlap;
                    let b = n_user_gene_id - a;
                    let c = n_gs_gene_id - a;
                    let d = n_background - b - c + a;
                    let pvalue = fisher.get_p_value(a as usize, b as usize, c as usize, d as usize);
                    if pvalue > pvalue_le {
                        return None
                    }
                    let odds_ratio = ((n_overlap as f64) / (n_user_gene_id as f64)) / ((n_gs_gene_id as f64) / (n_background as f64));
                    Some(PartialQueryResult { index, n_overlap, odds_ratio, pvalue, adj_pvalue: 1.0 })
                })
                .collect();
            // extract pvalues from results and compute adj_pvalues
            let mut pvalues = vec![1.0; bitmap.values.len()];
            for result in &results {
                pvalues[result.index] = result.pvalue;
            }
            // add adj_pvalues to results
            let adj_pvalues = adjust(&pvalues, Procedure::BenjaminiHochberg);
            results.retain_mut(|result| {
                if let Some(adj_pvalue) = adj_pvalues.get(result.index) {
                    result.adj_pvalue = *adj_pvalue;
                }
                result.adj_pvalue <= adj_pvalue_le
            });
            results.sort_unstable_by(|a, b| a.pvalue.partial_cmp(&b.pvalue).unwrap_or(std::cmp::Ordering::Equal));
            let results = Arc::new(results);
            state.cache.insert(background_query, results.clone(), 30000).await;
            let duration = start.elapsed();
            println!("[{}] {} genes enriched in {:?}", background_id, n_user_gene_id, duration);
            results
        }
    };

    let mut drug_significance_counts: HashMap<String, (usize, usize, usize, bool)> = HashMap::new();
    let mut drug_counts: HashMap<String, (usize, bool)> = HashMap::new();

    for result in (*results).iter().take(top_n) {
        if let Some((gene_set_hash, _gene_set)) = bitmap.values.get(result.index) {
            if let Some(terms) = bitmap.terms.get(gene_set_hash) {
                // Iterate over the terms for the current gene set
                for (_gene_set_id, gene_set_term, _description, fda_approved, count, pert) in terms {
                    // Ensure `pert` is not empty before proceeding
                    if !pert.is_empty() {
                        // Increment the count for significant results
                        let entry = drug_significance_counts.entry(pert.clone()).or_insert((0, 0, 0, false));
                        entry.0 += 1; // Increment significant count
                        if gene_set_term.contains(" up") {
                            entry.2 += 1;
                        }
    
                        // Insert the drug's total count into `drug_counts` if it's not already present
                        if !drug_counts.contains_key(pert) {
                            // `count` is of type `i32`, so cast it to `usize`
                            drug_counts.insert(pert.clone(), (*count as usize, *fda_approved));
                        }
                    }
                }
            }
        }
    }

    for (pert, (count_significant, count_insignificant, _sig_up, approved)) in &mut drug_significance_counts {
        if let Some(&(total_count, is_approved)) = drug_counts.get(pert) {
            *count_insignificant = total_count - *count_significant;
            *approved = is_approved;
        }
    }

    let total_terms = bitmap.terms.values().len();

    let n_significant_drugs = results.len();
    let n_insignificant_drugs = total_terms - n_significant_drugs;

    let mut fisher = state.fisher.write().await; // Acquire write lock to mutate the data
    *fisher = FastFisher::with_capacity(total_terms * 2); 

    let mut consensus_results: Vec<DrugConsensusResult> = drug_significance_counts
        .par_iter() // Use Rayon parallel iterator
        .map(|(drug, (count_sig, count_insig, sig_up, approved))| {
            // Construct the 2x2 contingency table
            let a = *count_sig; // Drug appears in significant results
            let b = *count_insig; // Drug appears in insignificant results
            let c = n_significant_drugs - *count_sig; // Drug does not appear in significant results
            let d = n_insignificant_drugs - *count_insig; // Drug does not appear in insignificant results
            let total_terms_by_dir = (*count_sig + *count_insig) / 2;

            if a < 5 {
                return DrugConsensusResult {
                    drug: drug.clone(),
                    count_significant: *count_sig,
                    count_insignificant: *count_insig,
                    count_up_significant: *sig_up,
                    pvalue_up: 1.0,
                    adj_pvalue_up: 1.0,
                    odds_ratio_up: 0.0,
                    pvalue_down: 1.0,
                    adj_pvalue_down: 1.0,
                    odds_ratio_down: 0.0,
                    approved: *approved,
                    odds_ratio: 0.0,
                    pvalue: 1.0,
                    adj_pvalue: 1.0, // Placeholder for now
                }
            }

            let odds_ratio = ((a as f64 + 0.5)  * (d as f64 + 0.5)) / ((b as f64 + 0.5) * (c as f64 + 0.5));

            let p_value = fisher.get_p_value(a as usize, b as usize, c as usize, d as usize); // Calculate p-value using FastFisher, b, c, d)
            // Store the result with Fisher's Exact Test p-value

            // Construct the second 2x2 table for directionality analysis
            let a_up = *sig_up; // Upregulated and significant
            let b_up = a - *sig_up; // Downregulated and significant
            let a_down = total_terms_by_dir as usize - *sig_up; // Upregulated and insignificant
            let b_down = *count_insig - a_down; // Downregulated and insignificant

            let odds_ratio_up = ((a_up as f64 + 0.5) / (b_up as f64 + 0.5)) / ((a_down as f64 + 0.5) / (b_down as f64 + 0.5));
            let odds_ratio_down = ((b_up as f64 + 0.5) / (a_up as f64 + 0.5)) / ((b_down as f64 + 0.5) / (a_down as f64 + 0.5));

            let p_value_up = fisher.get_p_value(a_up as usize, b_up as usize, a_down as usize, b_down as usize);

            let p_value_down = fisher.get_p_value(b_up as usize, a_up as usize, b_down as usize, a_down as usize);

            if p_value.is_nan() || p_value.is_infinite() || p_value_up.is_nan() || p_value_up.is_infinite() || p_value_down.is_nan() || p_value_down.is_infinite() {
                return DrugConsensusResult {
                    drug: drug.clone(),
                    count_significant: *count_sig,
                    count_insignificant: *count_insig,
                    count_up_significant: *sig_up,
                    pvalue_up: 1.0,
                    adj_pvalue_up: 1.0,
                    odds_ratio_up: 0.0,
                    pvalue_down: 1.0,
                    adj_pvalue_down: 1.0,
                    odds_ratio_down: 0.0,
                    approved: *approved,
                    odds_ratio: 0.0,
                    pvalue: 1.0,
                    adj_pvalue: 1.0, // Placeholder for now
                }
            }
            
            DrugConsensusResult {
                drug: drug.clone(),
                count_significant: *count_sig,
                count_insignificant: *count_insig,
                count_up_significant: *sig_up,
                pvalue_up: p_value_up,
                adj_pvalue_up: 1.0,
                odds_ratio_up: odds_ratio_up,
                pvalue_down: p_value_down,
                adj_pvalue_down: 1.0,
                odds_ratio_down: odds_ratio_down,
                approved: *approved,
                odds_ratio: odds_ratio,
                pvalue: p_value,
                adj_pvalue: 1.0, // Placeholder for now
            }
        })
    .collect(); // Collect the results into a vector

    let mut pvalues = vec![1.0; consensus_results.len()]; // Initialize the pvalues vector to match the length of consensus_results

    let mut pvalues_up = vec![1.0; consensus_results.len()];

    let mut pvalues_down = vec![1.0; consensus_results.len()];
    // Populate pvalues with pvalues from consensus_results
    consensus_results.iter().enumerate().for_each(|(i, res)| {
        pvalues[i] = res.pvalue;
        pvalues_up[i] = res.pvalue_up;
        pvalues_down[i] = res.pvalue_down;
    });

    // Adjust p-values using Benjamini-Hochberg procedure
    let adj_pvalues = adjust(&pvalues, Procedure::BenjaminiHochberg);
    let adj_pvalues_up = adjust(&pvalues_up, Procedure::BenjaminiHochberg);
    let adj_pvalues_down = adjust(&pvalues_down, Procedure::BenjaminiHochberg);


    // Apply adjusted p-values to consensus_results
    for (i, res) in consensus_results.iter_mut().enumerate() {
        res.adj_pvalue = adj_pvalues[i];
        res.adj_pvalue_up = adj_pvalues_up[i];
        res.adj_pvalue_down = adj_pvalues_down[i];
    }

    //consensus_results.retain(|res| res.pvalue < pvalue_le);

    if let Some(filter_fda) = filter_fda {
        if filter_fda {
            consensus_results.retain(|result| result.approved);
        }
    }

    if let Some(filter_term) = &filter_term {
        let is_up = filter_term.contains(" up");
        let is_down = filter_term.contains(" down");
        let filter_term_clean = filter_term.replace(" up", "").replace(" down", "").trim().to_lowercase();
        consensus_results.retain(|result| result.drug.contains(&filter_term_clean));

        if is_up {
            consensus_results.retain(|result| result.pvalue_up < result.pvalue_down);
        } else if is_down {
            consensus_results.retain(|result| result.pvalue_down < result.pvalue_up);
        }
    }

    if let Some(filter_ko) = filter_ko {
        if filter_ko {
            consensus_results.retain(|result| result.drug.contains(" "));
        }
    }
    
    // Sort results by adjusted p-value
    consensus_results.sort_unstable_by(|a, b| a.pvalue.partial_cmp(&b.pvalue).unwrap_or(std::cmp::Ordering::Equal));

    let consensus_len = consensus_results.len();

    println!("Consensus results computed for {} perturbations", consensus_len);

    let mut results: Vec<_> = results
        .iter()
        .filter_map(|result| {
            let (gene_set_hash, _gene_set) = bitmap.values.get(result.index)?;
            if let Some(filter_term) = &filter_term {
                let is_up = filter_term.contains(" up");
                let is_down = filter_term.contains(" down");
                let filter_term_clean = filter_term.replace(" up", "").replace(" down", "").trim().to_lowercase();
                if let Some(terms) = bitmap.terms.get(gene_set_hash) {
                    if is_up && !terms.iter().any(|(_gene_set_id, gene_set_term, _gene_set_description, _fda_approved, _count, _pert)|  gene_set_term.to_lowercase().contains(" up")) {
                        return None
                    }
                    else if is_down && !terms.iter().any(|(_gene_set_id, gene_set_term, _gene_set_description, _fda_approved, _count, _pert)|  gene_set_term.to_lowercase().contains(" down")) {
                        return None
                    }
                    else if !terms.iter().any(|(_gene_set_id, gene_set_term, _gene_set_description, _fda_approved, _count, _pert)| gene_set_term.to_lowercase().contains(&filter_term_clean)) {
                        return None
                    }
                }
            }
            if let Some(filter_fda) = filter_fda {
                if filter_fda {
                    if let Some(terms) = bitmap.terms.get(gene_set_hash) {
                        if terms.iter().any(|(_gene_set_id, _gene_set_term, _gene_set_description, fda_approved, _count, _pert)| !*fda_approved) {
                            return None
                        }
                    }
                }
            }
            if let Some(filter_ko) = filter_ko {
                if filter_ko {
                    if let Some(terms) = bitmap.terms.get(gene_set_hash) {
                        if terms.iter().any(|(_gene_set_id, _gene_set_term, _gene_set_description, _fda_approved, _count, pert)| !pert.contains(" ") ) {
                            return None
                        }
                    }
                }
            }

            Some(QueryResult {
                gene_set_hash: gene_set_hash.to_string(),
                n_overlap: result.n_overlap,
                odds_ratio: result.odds_ratio,
                pvalue: result.pvalue,
                adj_pvalue: result.adj_pvalue,
            })
        })
        .collect();

    if let Some(sortby) = sortby {
        match sortby.as_str() {
            "pvalue" => {
                consensus_results.sort_unstable_by(|a, b| a.pvalue.partial_cmp(&b.pvalue).unwrap_or(std::cmp::Ordering::Equal));
                results.sort_unstable_by(|a, b| a.pvalue.partial_cmp(&b.pvalue).unwrap_or(std::cmp::Ordering::Equal));
            },
            "odds_ratio" => {
                consensus_results.sort_unstable_by(|a, b| b.odds_ratio.partial_cmp(&a.odds_ratio).unwrap_or(std::cmp::Ordering::Equal));
                results.sort_unstable_by(|a, b| b.odds_ratio.partial_cmp(&a.odds_ratio).unwrap_or(std::cmp::Ordering::Equal));
            },
            "odds_ratio_up" => {
                consensus_results.sort_unstable_by(|a, b| b.odds_ratio_up.partial_cmp(&a.odds_ratio_up).unwrap_or(std::cmp::Ordering::Equal));
            },
            "odds_ratio_down" => {
                consensus_results.sort_unstable_by(|a, b| b.odds_ratio_down.partial_cmp(&a.odds_ratio_down).unwrap_or(std::cmp::Ordering::Equal));
            },
            "pvalue_up" => {
                consensus_results.sort_unstable_by(|a, b| a.pvalue_up.partial_cmp(&b.pvalue_up).unwrap_or(std::cmp::Ordering::Equal));
            },
            "pvalue_down" => {
                consensus_results.sort_unstable_by(|a, b| a.pvalue_down.partial_cmp(&b.pvalue_down).unwrap_or(std::cmp::Ordering::Equal));
            },
            "overlap" => {
                results.sort_unstable_by(|a, b| b.n_overlap.partial_cmp(&a.n_overlap).unwrap_or(std::cmp::Ordering::Equal));
            },
            _ => println!("Invalid sortby parameter. Defaulting to pvalue."),
        }
    }
    
    let range_total = results.len();
    let (range_start, range_end) = match (offset.unwrap_or(0), limit) {
        (0, None) => (0, range_total),
        (offset, None) => {
            if offset < results.len() {
                results.drain(..offset);
            };
            (offset, range_total)
        },
        (offset, Some(limit)) => {
            if offset < results.len() {
                results.drain(..offset);
                if limit < results.len() {
                    results.drain(limit..);
                }
            };
            (offset, offset + results.len())
        },
    };

    let (_consensus_range_start, _consensus_range_end) = match (offset.unwrap_or(0), limit) {
        (0, None) => (0, consensus_results.len()),
        (offset, None) => {
            if offset < consensus_results.len() {
                consensus_results.drain(..offset);
            };
            (offset, consensus_results.len())
        },
        (offset, Some(limit)) => {
            if offset < consensus_results.len() {
                consensus_results.drain(..offset);
                if limit < consensus_results.len() {
                    consensus_results.drain(limit..);
                }
            };
            (offset, offset + consensus_results.len())
        },
    };
    
    Ok(QueryResponse {
        results,
        consensus: consensus_results,
        content_range: (range_start, range_end, range_total, consensus_len),
    })
}

#[post("/pairs/<background_id>?<filter_term>&<overlap_ge>&<pvalue_le>&<adj_pvalue_le>&<offset>&<limit>&<filter_fda>&<sortby>&<filter_ko>&<top_n>", data = "<input_gene_sets>")]
async fn query_pairs(
    mut db: Connection<Postgres>,
    state: &State<PersistentState>,
    input_gene_sets: Json<InputGeneSets>,  // Expecting { "up": [...], "down": [...] }
    background_id: &str,
    filter_term: Option<String>,
    overlap_ge: Option<u32>,
    pvalue_le: Option<f64>,
    adj_pvalue_le: Option<f64>,
    offset: Option<usize>,
    limit: Option<usize>,
    filter_fda: Option<bool>,
    sortby: Option<String>,
    filter_ko: Option<bool>,
    top_n: Option<usize>,
) -> Result<PairedQueryResponse, Custom<String>> {

    let background_id = {
        if background_id == "latest" {
            let latest = state.latest.read().await;
            latest.clone().ok_or(Custom(Status::NotFound, String::from("Nothing loaded")))?
        } else {
            Uuid::parse_str(&background_id).map_err(|e| Custom(Status::BadRequest, e.to_string()))?
        }
    };
    ensure_index(&mut db, &state, background_id).await.map_err(|e| Custom(Status::InternalServerError, e.to_string()))?;
    let start = Instant::now();
    let bitmap = state.bitmaps.get_read(&background_id).await.ok_or(Custom(Status::NotFound, String::from("Can't find background")))?;

    let input_gene_set_up = input_gene_sets.up
    .iter()
    .map(|gene| Uuid::parse_str(gene))
    .collect::<Result<Vec<_>, _>>()
    .map_err(|e| Custom(Status::BadRequest, e.to_string()))?;

    let input_gene_set_down = input_gene_sets.down
        .iter()
        .map(|gene| Uuid::parse_str(gene))
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| Custom(Status::BadRequest, e.to_string()))?;

    let input_gene_set_up = DenseBitVec::new(&bitmap.columns, &input_gene_set_up);
    let input_gene_set_down = DenseBitVec::new(&bitmap.columns, &input_gene_set_down);


    let filter_term = filter_term.and_then(|filter_term| Some(filter_term.to_lowercase()));
    let adj_pvalue_le =  adj_pvalue_le.unwrap_or(1.0);
    let top_n = top_n.unwrap_or(1000);

    let fisher = state.fisher.read().await;

    let n_background = bitmap.columns.len() as u32;
    let n_user_gene_id = input_gene_set_up.n as u32 + input_gene_set_down.n as u32;

    println!("[{}] Computing mimickers and reversers", background_id);
    let start = Instant::now();
    let background_query = Arc::new(BackgroundQueryPair { background_id, input_gene_set_up, input_gene_set_down });
    let mut results = {
        let results = state.cachepair.get(&background_query).await;
        if let Some(results) = results {
            results.value().clone()
        } else {
            let mut results: Vec<_> = bitmap.signature_pairs.pairs.par_iter().enumerate()
            .filter_map(|(index, (up_idx, down_idx))| {
                let gene_set_up = &bitmap.values[*up_idx].1;
                let gene_set_down = &bitmap.values[*down_idx].1;

                // Compute four different overlaps
                let overlap_up_up = compute_overlap(&background_query.input_gene_set_up, &gene_set_up) as u32;
                let overlap_down_down = compute_overlap(&background_query.input_gene_set_down, &gene_set_down) as u32;
                let overlap_up_down = compute_overlap(&background_query.input_gene_set_up, &gene_set_down) as u32;
                let overlap_down_up = compute_overlap(&background_query.input_gene_set_down, &gene_set_up) as u32;

                // Compute mimicker and reverser scores
                let mimicker_overlap = overlap_up_up + overlap_down_down;
                let reverser_overlap = overlap_up_down + overlap_down_up;

                // Apply overlap filters
                if mimicker_overlap < overlap_ge.unwrap_or(1) && reverser_overlap < overlap_ge.unwrap_or(1) {
                    return None;
                }

                // Compute Fisher test for mimicker
                let a_mimic = mimicker_overlap;
                let b_mimic = n_user_gene_id - a_mimic;
                let c_mimic = (gene_set_up.v.len() + gene_set_down.v.len()) as u32 - a_mimic;
                let d_mimic = n_background - b_mimic - c_mimic + a_mimic;

                
                let pvalue_mimic = fisher.get_p_value(a_mimic as usize, b_mimic as usize, c_mimic as usize, d_mimic as usize);
                
                // Compute Fisher test for reverser
                let a_reverse = reverser_overlap;
                let b_reverse = n_user_gene_id - a_reverse;
                let c_reverse = (gene_set_up.v.len() + gene_set_down.v.len()) as u32 - a_reverse;
                let d_reverse = n_background - b_reverse - c_reverse + a_reverse;

                let pvalue_reverse = fisher.get_p_value(a_reverse as usize, b_reverse as usize, c_reverse as usize, d_reverse as usize);

                if pvalue_mimic > pvalue_le.unwrap_or(1.0) && pvalue_reverse > pvalue_le.unwrap_or(1.0) {
                    return None;
                }

                let odds_ratio_mimic = ((a_mimic as f64) / (n_user_gene_id as f64)) / ((c_mimic as f64) / (n_background as f64));
                let odds_ratio_reverse = ((a_reverse as f64) / (n_user_gene_id as f64)) / ((c_reverse as f64) / (n_background as f64));

                Some(PartialPairResult {
                    index,
                    index_up: *up_idx,
                    index_down: *down_idx,
                    mimicker_overlap,
                    reverser_overlap,
                    odds_ratio_mimic,
                    odds_ratio_reverse,
                    pvalue_mimic,
                    pvalue_reverse,
                    adj_pvalue_mimic: 1.0,
                    adj_pvalue_reverse: 1.0,
                })
            })
            .collect();

            // extract pvalues from results and compute adj_pvalues
            let mut pvalues_mimic = vec![1.0; bitmap.values.len()];
            let mut pvalues_reverse = vec![1.0; bitmap.values.len()];
            for result in &results {
                pvalues_mimic[result.index] = result.pvalue_mimic;
                pvalues_reverse[result.index] = result.pvalue_reverse;
            }
            // add adj_pvalues to results
            let adj_pvalues_mimic = adjust(&pvalues_mimic, Procedure::BenjaminiHochberg);
            let adj_pvalues_reverse = adjust(&pvalues_reverse, Procedure::BenjaminiHochberg);
            results.retain_mut(|result| {
                if let Some(adj_pvalue_mimic) = adj_pvalues_mimic.get(result.index) {
                    result.adj_pvalue_mimic = *adj_pvalue_mimic;
                }
                if let Some(adj_pvalue_reverse) = adj_pvalues_reverse.get(result.index) {
                    result.adj_pvalue_reverse = *adj_pvalue_reverse;
                }
                result.adj_pvalue_mimic <= adj_pvalue_le || result.adj_pvalue_reverse <= adj_pvalue_le
            });
            results.sort_unstable_by(|a, b| a.pvalue_mimic.partial_cmp(&b.pvalue_mimic).unwrap_or(std::cmp::Ordering::Equal));

            let results = Arc::new(results);
            state.cachepair.insert(background_query, results.clone(), 30000).await;
            let duration = start.elapsed();
            println!("[{}] {} up and down genes enriched in {:?}", background_id, n_user_gene_id, duration);
            results
        }
    };

    let mut drug_significance_counts: HashMap<String, (usize, usize, usize, bool)> = HashMap::new();
    let mut drug_counts: HashMap<String, (usize, bool)> = HashMap::new();

    for result in (*results).iter().take(top_n) {
        if let Some((gene_set_hash, _gene_set)) = bitmap.values.get(result.index_up) {
            if let Some(terms) = bitmap.terms.get(gene_set_hash) {
                // Iterate over the terms for the current gene set
                for (_gene_set_id, gene_set_term, _description, fda_approved, count, pert) in terms {
                    // Ensure `pert` is not empty before proceeding
                    if !pert.is_empty() {
                        // Increment the count for significant results
                        let entry = drug_significance_counts.entry(pert.clone()).or_insert((0, 0, 0, false));
                        entry.0 += 1; // Increment significant count
                        if result.pvalue_mimic <  result.pvalue_reverse {
                            entry.2 += 1;
                        }
                        // Insert the drug's total count into `drug_counts` if it's not already present
                        if !drug_counts.contains_key(pert) {
                            // `count` is of type `i32`, so cast it to `usize`
                            drug_counts.insert(pert.clone(), (*count as usize, *fda_approved));
                        }
                    }
                }
            }
        }
    }

    for (pert, (count_significant, count_insignificant, _sig_up, approved)) in &mut drug_significance_counts {
        if let Some(&(total_count, is_approved)) = drug_counts.get(pert) {
            *count_insignificant = total_count - *count_significant;
            *approved = is_approved;
        }
    }

    let total_terms = bitmap.terms.values().len() / 2 as usize;

    let n_significant_drugs = results.len() / 2 as usize;

    let n_insignificant_drugs = total_terms - n_significant_drugs;

    let mut consensus_results: Vec<DrugConsensusResult> = drug_significance_counts
        .iter() // Use Rayon parallel iterator
        .map(|(drug, (count_sig, count_insig, sig_up, approved))| {
            // Construct the 2x2 contingency table
            let a = *count_sig; // Drug appears in significant results
            let b = *count_insig; // Drug appears in insignificant results
            let c = n_significant_drugs - *count_sig; // Drug does not appear in significant results
            let d = n_insignificant_drugs - *count_insig; // Drug does not appear in insignificant results
            let total_terms_by_dir = (*count_sig + *count_insig) / 2;

            if (a < 5 || (*count_insig > n_insignificant_drugs)|| (*count_sig > n_significant_drugs)) {
                return DrugConsensusResult {
                    drug: drug.clone(),
                    count_significant: *count_sig,
                    count_insignificant: *count_insig,
                    count_up_significant: *sig_up,
                    pvalue_up: 1.0,
                    adj_pvalue_up: 1.0,
                    odds_ratio_up: 0.0,
                    pvalue_down: 1.0,
                    adj_pvalue_down: 1.0,
                    odds_ratio_down: 0.0,
                    approved: *approved,
                    odds_ratio: 0.0,
                    pvalue: 1.0,
                    adj_pvalue: 1.0, // Placeholder for now
                }
            }

            let odds_ratio = ((a as f64 + 0.5)  * (d as f64 + 0.5)) / ((b as f64 + 0.5) * (c as f64 + 0.5));

            let p_value = fisher.get_p_value(a as usize, b as usize, c as usize, d as usize); // Calculate p-value using FastFisher, b, c, d)
            // Store the result with Fisher's Exact Test p-value

            // Construct the second 2x2 table for directionality analysis
            let a_up = *sig_up; // Upregulated and significant
            let b_up = a - *sig_up; // Downregulated and significant
            let a_down = total_terms_by_dir as usize - *sig_up; // Upregulated and insignificant
            let b_down = *count_insig - a_down; // Downregulated and insignificant

            let odds_ratio_up = ((a_up as f64 + 0.5) / (b_up as f64 + 0.5)) / ((a_down as f64 + 0.5) / (b_down as f64 + 0.5));
            let odds_ratio_down = ((b_up as f64 + 0.5) / (a_up as f64 + 0.5)) / ((b_down as f64 + 0.5) / (a_down as f64 + 0.5));

            let p_value_up = fisher.get_p_value(a_up as usize, b_up as usize, a_down as usize, b_down as usize);

            let p_value_down = fisher.get_p_value(b_up as usize, a_up as usize, b_down as usize, a_down as usize);

            if p_value.is_nan() || p_value.is_infinite() || p_value_up.is_nan() || p_value_up.is_infinite() || p_value_down.is_nan() || p_value_down.is_infinite() {
                return DrugConsensusResult {
                    drug: drug.clone(),
                    count_significant: *count_sig,
                    count_insignificant: *count_insig,
                    count_up_significant: *sig_up,
                    pvalue_up: 1.0,
                    adj_pvalue_up: 1.0,
                    odds_ratio_up: 0.0,
                    pvalue_down: 1.0,
                    adj_pvalue_down: 1.0,
                    odds_ratio_down: 0.0,
                    approved: *approved,
                    odds_ratio: 0.0,
                    pvalue: 1.0,
                    adj_pvalue: 1.0, // Placeholder for now
                }
            }
            
            DrugConsensusResult {
                drug: drug.clone(),
                count_significant: *count_sig,
                count_insignificant: *count_insig,
                count_up_significant: *sig_up,
                pvalue_up: p_value_up,
                adj_pvalue_up: 1.0,
                odds_ratio_up: odds_ratio_up,
                pvalue_down: p_value_down,
                adj_pvalue_down: 1.0,
                odds_ratio_down: odds_ratio_down,
                approved: *approved,
                odds_ratio: odds_ratio,
                pvalue: p_value,
                adj_pvalue: 1.0, // Placeholder for now
            }
        })
    .collect(); // Collect the results into a vector

    let mut pvalues = vec![1.0; consensus_results.len()]; // Initialize the pvalues vector to match the length of consensus_results

    let mut pvalues_up = vec![1.0; consensus_results.len()];

    let mut pvalues_down = vec![1.0; consensus_results.len()];
    // Populate pvalues with pvalues from consensus_results
    consensus_results.iter().enumerate().for_each(|(i, res)| {
        pvalues[i] = res.pvalue;
        pvalues_up[i] = res.pvalue_up;
        pvalues_down[i] = res.pvalue_down;
    });

    // Adjust p-values using Benjamini-Hochberg procedure
    let adj_pvalues = adjust(&pvalues, Procedure::BenjaminiHochberg);
    let adj_pvalues_up = adjust(&pvalues_up, Procedure::BenjaminiHochberg);
    let adj_pvalues_down = adjust(&pvalues_down, Procedure::BenjaminiHochberg);


    // Apply adjusted p-values to consensus_results
    for (i, res) in consensus_results.iter_mut().enumerate() {
        res.adj_pvalue = adj_pvalues[i];
        res.adj_pvalue_up = adj_pvalues_up[i];
        res.adj_pvalue_down = adj_pvalues_down[i];
    }

    //consensus_results.retain(|res| res.pvalue < pvalue_le);

    if let Some(filter_fda) = filter_fda {
        if filter_fda {
            consensus_results.retain(|result| result.approved);
        }
    }

    if let Some(filter_term) = &filter_term {
        let is_up = filter_term.contains(" up");
        let is_down = filter_term.contains(" down");
        let filter_term_clean = filter_term.replace(" up", "").replace(" down", "").trim().to_lowercase();
        consensus_results.retain(|result| result.drug.contains(&filter_term_clean));

        if is_up {
            consensus_results.retain(|result| result.pvalue_up < result.pvalue_down);
        } else if is_down {
            consensus_results.retain(|result| result.pvalue_down < result.pvalue_up);
        }
    }

    if let Some(filter_ko) = filter_ko {
        if filter_ko {
            consensus_results.retain(|result| result.drug.contains(" "));
        }
    }
    
    // Sort results by adjusted p-value
    consensus_results.sort_unstable_by(|a, b| a.pvalue.partial_cmp(&b.pvalue).unwrap_or(std::cmp::Ordering::Equal));

    let consensus_len = consensus_results.len();

    println!("Consensus results computed for {} perturbations", consensus_len);


    let mut results: Vec<_> = results
        .iter()
        .filter_map(|result| {
            let (gene_set_hash, _gene_set) = bitmap.values.get(result.index_up)?;
            if let Some(filter_term) = &filter_term {
                let filter_term_clean = filter_term.replace(" up", "").replace(" down", "").trim().to_lowercase();
                let is_up = filter_term.contains(" up");
                let is_down = filter_term.contains(" down");
                if let Some(terms) = bitmap.terms.get(gene_set_hash) {
                    if !terms.iter().any(|(_gene_set_id, gene_set_term, _gene_set_description, _fda_approved, _count, _pert)| gene_set_term.to_lowercase().contains(&filter_term_clean)) {
                        return None
                    }
                } else if is_up && (result.pvalue_mimic > result.pvalue_reverse) {
                    return None
                } else if is_down && (result.pvalue_mimic < result.pvalue_reverse) {
                    return None
                }     
            }
            if let Some(filter_fda) = filter_fda {
                if filter_fda {
                    if let Some(terms) = bitmap.terms.get(gene_set_hash) {
                        if terms.iter().any(|(_gene_set_id, _gene_set_term, _gene_set_description, fda_approved, _count, _pert)| !*fda_approved) {
                            return None
                        }
                    }
                }
            }
            if let Some(filter_ko) = filter_ko {
                if filter_ko {
                    if let Some(terms) = bitmap.terms.get(gene_set_hash) {
                        if terms.iter().any(|(_gene_set_id, _gene_set_term, _gene_set_description, _fda_approved, _count, pert)| !pert.contains(" ") ) {
                            return None
                        }
                    }
                }
            }
            Some(PairedQueryResult {
                gene_set_hash_up: bitmap.values[result.index_up].0.to_string(),
                gene_set_hash_down: bitmap.values[result.index_down].0.to_string(),
                mimicker_overlap: result.mimicker_overlap,
                reverser_overlap: result.reverser_overlap,
                odds_ratio_mimic: result.odds_ratio_mimic,
                odds_ratio_reverse: result.odds_ratio_reverse,
                pvalue_mimic: result.pvalue_mimic,
                adj_pvalue_mimic: result.adj_pvalue_mimic,
                pvalue_reverse: result.pvalue_reverse,
                adj_pvalue_reverse: result.adj_pvalue_reverse,
            })
        })
        .collect();


    if let Some(sortby) = sortby {
        match sortby.as_str() {
            "pvalue" => {
                consensus_results.sort_unstable_by(|a, b| a.pvalue.partial_cmp(&b.pvalue).unwrap_or(std::cmp::Ordering::Equal));
            },
            "odds_ratio" => {
                consensus_results.sort_unstable_by(|a, b| b.odds_ratio.partial_cmp(&a.odds_ratio).unwrap_or(std::cmp::Ordering::Equal));
            },
            "odds_ratio_up" => {
                consensus_results.sort_unstable_by(|a, b| b.odds_ratio_up.partial_cmp(&a.odds_ratio_up).unwrap_or(std::cmp::Ordering::Equal));
            },
            "odds_ratio_down" => {
                consensus_results.sort_unstable_by(|a, b| b.odds_ratio_down.partial_cmp(&a.odds_ratio_down).unwrap_or(std::cmp::Ordering::Equal));
            },
            "pvalue_up" => {
                consensus_results.sort_unstable_by(|a, b| a.pvalue_up.partial_cmp(&b.pvalue_up).unwrap_or(std::cmp::Ordering::Equal));
            },
            "pvalue_down" => {
                consensus_results.sort_unstable_by(|a, b| a.pvalue_down.partial_cmp(&b.pvalue_down).unwrap_or(std::cmp::Ordering::Equal));
            },
            "pvalue_mimic" => {
                results.sort_unstable_by(|a, b| a.pvalue_mimic.partial_cmp(&b.pvalue_mimic).unwrap());
                consensus_results.sort_unstable_by(|a, b| a.pvalue_up.partial_cmp(&b.pvalue_up).unwrap_or(std::cmp::Ordering::Equal));
            },
            "pvalue_reverse" => {
                results.sort_unstable_by(|a, b| a.pvalue_reverse.partial_cmp(&b.pvalue_reverse).unwrap());
                consensus_results.sort_unstable_by(|a, b| a.pvalue_down.partial_cmp(&b.pvalue_down).unwrap_or(std::cmp::Ordering::Equal));
            },
            "odds_ratio_mimic" => {
                results.sort_unstable_by(|a, b| b.odds_ratio_mimic.partial_cmp(&a.odds_ratio_mimic).unwrap());
                consensus_results.sort_unstable_by(|a, b| b.odds_ratio_up.partial_cmp(&a.odds_ratio_up).unwrap_or(std::cmp::Ordering::Equal));
            },
            "odds_ratio_reverse" => {
                results.sort_unstable_by(|a, b| b.odds_ratio_reverse.partial_cmp(&a.odds_ratio_reverse).unwrap());
                consensus_results.sort_unstable_by(|a, b| b.odds_ratio_down.partial_cmp(&a.odds_ratio_down).unwrap_or(std::cmp::Ordering::Equal));
            },
            _ => println!("Invalid sortby parameter. Defaulting to pvalue."),
        }
    }
    
    let range_total = results.len();
    let (range_start, range_end) = match (offset.unwrap_or(0), limit) {
        (0, None) => (0, range_total),
        (offset, None) => {
            if offset < results.len() {
                results.drain(..offset);
            };
            (offset, range_total)
        },
        (offset, Some(limit)) => {
            if offset < results.len() {
                results.drain(..offset);
                if limit < results.len() {
                    results.drain(limit..);
                }
            };
            (offset, offset + results.len())
        },
    };

    let (_consensus_range_start, _consensus_range_end) = match (offset.unwrap_or(0), limit) {
        (0, None) => (0, consensus_results.len()),
        (offset, None) => {
            if offset < consensus_results.len() {
                consensus_results.drain(..offset);
            };
            (offset, consensus_results.len())
        },
        (offset, Some(limit)) => {
            if offset < consensus_results.len() {
                consensus_results.drain(..offset);
                if limit < consensus_results.len() {
                    consensus_results.drain(limit..);
                }
            };
            (offset, offset + consensus_results.len())
        },
    };

    Ok(PairedQueryResponse {
        results,
        consensus: consensus_results,
        content_range: (range_start, range_end, range_total, consensus_len),
    })
}


#[launch]
fn rocket() -> _ {
    rocket::build()
        .manage(PersistentState {
            fisher: RwLock::new(FastFisher::new()),
            bitmaps: RwLockHashMap::new(),
            latest: RwLock::new(None),
            cache: Cache::new(),
            cachepair: Cache::new()
        })
        .attach(Postgres::init())
        .mount("/", routes![ensure, get_gmt, query, query_pairs, delete])
}
