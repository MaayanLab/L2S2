import {
    EnrichmentQuerySingleDocument,
    EnrichmentQuerySingleQuery,
    EnrichmentQueryConsensusQuery,
    EnrichmentQueryConsensusDocument,
    EnrichmentQueryMoAsQuery,
    EnrichmentQueryMoAsDocument,
    PairEnrichmentQuerySingleQuery,
    PairEnrichmentQuerySingleDocument,
    PairEnrichmentQueryConsensusDocument,
    PairEnrichmentQueryConsensusQuery,
    PairEnrichmentQueryMoAsDocument,
    PairEnrichmentQueryMoAsQuery,
  } from "@/graphql";
  import { getClient } from "@/lib/apollo/client";
  

export async function* paginatedNodeGenerator(genes: string[], term: string, filterFda: boolean, filterKo: boolean, topN: number = 1000, sort: string, maxTotal: number = 100000) {
    const pageSize = 500;
    let offset = 0;
  
    while (true) {
      const { data, error } = await getClient().query<EnrichmentQuerySingleQuery>({
        query: EnrichmentQuerySingleDocument,
        variables: {
          genes,
          filterTerm: term,
          filterFda,
          sort,
          filterKo,
          offset,
          first: pageSize,
          topN,
        },
      });
  
      if (error) throw new Error(error.message);
  
      const nodes = data.currentBackground?.enrich?.nodes;
      if (!nodes || nodes.length === 0) break;
  
      for (const node of nodes) {
        if (!node) continue;
        for (const geneSet of node.geneSets.nodes) {
          if (!geneSet) continue;
          const fdaInfo = geneSet.geneSetFdaCountsById.nodes[0];
          const perturbationId =
            geneSet.term.split("_")[0];
          const cellLine =
            geneSet.term.split("_")[1];
          const timepoint =
            geneSet.term.split("_")[2];
          const batch =
            geneSet.term.split("_")[3];
          var perturbation =
            geneSet.term.split("_")[4];
          if (perturbation?.split(" ").length == 2)
            perturbation = perturbation?.split(" ")[0] + " KO";

          const concentration =
            geneSet.term
              .split("_")[5]
              ?.split(" ")[0] ?? "N/A";
          const direction =
            geneSet.term.split(" ")[1];

          yield {
            drug: perturbation,
            perturbationId,
            concentration,
            cellLine,
            timepoint,
            batch,
            direction,
            geneSetSize: geneSet.nGeneIds,
            moa: geneSet.geneSetFdaCountsById.nodes[0]?.moa,
            nOverlap: node.nOverlap,
            oddsRatio: node.oddsRatio,
            pvalue: node.pvalue,
            adjPvalue: node.adjPvalue,
            count: fdaInfo?.count || 1,
            approved: fdaInfo?.approved?.toString() || "",
            geneSetHash: node.geneSetHash,
          };
        }
      }
  
      if (nodes.length < pageSize) break;
      offset += pageSize;

      if (offset >= maxTotal) break;
    }
}
  

export async function* paginatedConsensusGenerator(
    genes: string[],
    term: string,
    filterFda: boolean,
    filterKo: boolean,
    topN: number = 1000,
    sort: string
  ) {
    const pageSize = 500;
    let offset = 0;
    let totalCount: number | null = null;
  
    while (true) {
      const { data, error } = await getClient().query<EnrichmentQueryConsensusQuery>({
        query: EnrichmentQueryConsensusDocument,
        variables: {
          genes,
          filterTerm: term,
          filterFda,
          filterKo,
          sort,
          offset,
          first: pageSize,
          topN,
        },
      });
  
      if (error) throw new Error(error.message);
  
      const enrich = data.currentBackground?.enrich;
      const nodes = enrich?.consensus ?? [];
      if (totalCount === null) totalCount = enrich?.consensusCount ?? 0;
  
      console.log(`Fetched ${nodes.length} at offset ${offset} / total: ${totalCount}`);
  
      if (nodes.length === 0) break;
  
      for (const res of nodes) {
        if (!res) continue;
        yield {
          drug: res.drug,
          countSig: res.countSignificant,
          countInsig: res.countInsignificant,
          countUpSig: res.countUpSignificant,
          countDownSig: (res.countSignificant || 0) - (res.countUpSignificant || 0),
          oddsRatio: res.oddsRatio,
          pvalueUp: res.pvalueUp,
          adjPvalueUp: res.adjPvalueUp,
          oddsRatioUp: res.oddsRatioUp,
          pvalueDown: res.pvalueDown,
          adjPvalueDown: res.adjPvalueDown,
          oddsRatioDown: res.oddsRatioDown,
        };
      }
  
      offset += nodes.length;
  
      if (offset >= totalCount) break;
    }
  }
  

export async function* paginatedMoAsGenerator(
    genes: string[],
    term: string,
    filterFda: boolean,
    filterKo: boolean,
    topN: number = 1000,
    sort: string
  ) {
    const pageSize = 500;
    let offset = 0;
    let totalCount: number | null = null;
  
    while (true) {
      const { data, error } = await getClient().query<EnrichmentQueryMoAsQuery>({
        query: EnrichmentQueryMoAsDocument,
        variables: {
          genes,
          filterTerm: term,
          filterFda,
          filterKo,
          sort,
          offset,
          first: pageSize,
          topN,
        },
      });
  
      if (error) throw new Error(error.message);
  
      const enrich = data.currentBackground?.enrich;
      const nodes = enrich?.moas ?? [];
      if (totalCount === null) totalCount = enrich?.moasCount ?? 0;
  
      console.log(`Fetched ${nodes.length} at offset ${offset} / total: ${totalCount}`);
  
      if (nodes.length === 0) break;
  
      for (const res of nodes) {
        if (!res) continue;
        yield {
          drug: res.drug,
          countSig: res.countSignificant,
          countInsig: res.countInsignificant,
          countUpSig: res.countUpSignificant,
          countDownSig:
            (res.countSignificant || 0) - (res.countUpSignificant || 0),
          oddsRatio: res.oddsRatio,
          pvalueUp: res.pvalueUp,
          adjPvalueUp: res.adjPvalueUp,
          oddsRatioUp: res.oddsRatioUp,
          pvalueDown: res.pvalueDown,
          adjPvalueDown: res.adjPvalueDown,
          oddsRatioDown: res.oddsRatioDown,
        };
      }
  
      offset += nodes.length;
  
      if (offset >= totalCount) break;
    }
}


export async function* paginatedPairNodeGenerator(genesUp: string[], genesDown: string[], term: string, filterFda: boolean, filterKo: boolean, topN: number = 1000, sort: string, maxTotal: number = 100000) {
    const pageSize = 500;
    let offset = 0;
  
    while (true) {
      const { data, error } = await getClient().query<PairEnrichmentQuerySingleQuery>({
        query: PairEnrichmentQuerySingleDocument,
        variables: {
          genesUp,
          genesDown,
          filterTerm: term,
          filterFda,
          sort,
          filterKo,
          offset,
          first: pageSize,
          topN,
        },
      });
  
      if (error) throw new Error(error.message);
  
      const nodes = data.currentBackground?.pairedEnrich?.nodes;
      if (!nodes || nodes.length === 0) break;
  
      for (const node of nodes) {
        if (!node) continue;
        const geneSet = node.geneSet.nodes[0];
          if (!geneSet) continue;
          const fdaInfo = geneSet.geneSetFdaCountsById.nodes[0];
          const term = geneSet.term.split(" ")[0]
          const perturbationId =
          term.split("_")[0];
          const cellLine =
          term.split("_")[1];
          const timepoint =
            term.split("_")[2];
          const batch =
            term.split("_")[3];
          var perturbation =
            term.split("_")[4];
          if (perturbation?.split(" ").length == 2)
            perturbation = perturbation?.split(" ")[0] + " KO";

          const concentration =
            geneSet.term
              .split("_")[5]
              ?.split(" ")[0] ?? "N/A";
          yield {
            perturbation,
            cellLine,
            timepoint,
            concentration,
            batch,
            perturbationId,
            nMimicOverlap: node.mimickerOverlap,
            pvalueMimic: node.pvalueMimic,
            adjPvalueMimic: node.adjPvalueMimic,
            nReverseOverlap: node.reverserOverlap,
            pvalueReverse: node.pvalueReverse,
            adjPvalueReverse: node.adjPvalueReverse,
            geneSetSizeUp: geneSet.nGeneIds,
            geneSetSizeDown: geneSet.nGeneIds,
            moa: geneSet.geneSetFdaCountsById.nodes[0]?.moa,
            fdaApproved: fdaInfo?.approved?.toString() || "",
            signatureCount: geneSet.geneSetFdaCountsById.nodes[0]?.count || 0,
          };
      }
  
      if (nodes.length < pageSize) break;
      offset += pageSize;

      if (offset >= maxTotal) break;
    }
}

export async function* paginatedPairConsensusGenerator(
    genesUp: string[],
    genesDown: string[],
    term: string,
    filterFda: boolean,
    filterKo: boolean,
    topN: number = 1000,
    sort: string
  ) {
    const pageSize = 500;
    let offset = 0;
    let totalCount: number | null = null;
  
    while (true) {
      const { data, error } = await getClient().query<PairEnrichmentQueryConsensusQuery>({
        query: PairEnrichmentQueryConsensusDocument,
        variables: {
          genesUp,
          genesDown,
          filterTerm: term,
          filterFda,
          filterKo,
          sort,
          offset,
          first: pageSize,
          topN,
        },
      });
  
      if (error) throw new Error(error.message);
  
      const enrich = data.currentBackground?.pairedEnrich;
      const nodes = enrich?.consensus ?? [];
      if (totalCount === null) totalCount = enrich?.consensusCount ?? 0;
  
      console.log(`Fetched ${nodes.length} at offset ${offset} / total: ${totalCount}`);
  
      if (nodes.length === 0) break;
  
      for (const res of nodes) {
        if (!res) continue;
        yield {
          drug: res.drug,
          countSig: res.countSignificant,
          countInsig: res.countInsignificant,
          countUpSig: res.countUpSignificant,
          countDownSig: (res.countSignificant || 0) - (res.countUpSignificant || 0),
          oddsRatio: res.oddsRatio,
          pvalueUp: res.pvalueUp,
          adjPvalueUp: res.adjPvalueUp,
          oddsRatioUp: res.oddsRatioUp,
          pvalueDown: res.pvalueDown,
          adjPvalueDown: res.adjPvalueDown,
          oddsRatioDown: res.oddsRatioDown,
        };
      }
  
      offset += nodes.length;
  
      if (offset >= totalCount) break;
    }
  }
  

export async function* paginatedPairMoAsGenerator(
    genesUp: string[],
    genesDown: string[],
    term: string,
    filterFda: boolean,
    filterKo: boolean,
    topN: number = 1000,
    sort: string
  ) {
    const pageSize = 500;
    let offset = 0;
    let totalCount: number | null = null;
  
    while (true) {
      const { data, error } = await getClient().query<PairEnrichmentQueryMoAsQuery>({
        query: PairEnrichmentQueryMoAsDocument,
        variables: {
          genesUp,
          genesDown,
          filterTerm: term,
          filterFda,
          filterKo,
          sort,
          offset,
          first: pageSize,
          topN,
        },
      });
  
      if (error) throw new Error(error.message);
  
      const enrich = data.currentBackground?.pairedEnrich;
      const nodes = enrich?.moas ?? [];
      if (totalCount === null) totalCount = enrich?.moasCount ?? 0;
  
      console.log(`Fetched ${nodes.length} at offset ${offset} / total: ${totalCount}`);
  
      if (nodes.length === 0) break;
  
      for (const res of nodes) {
        if (!res) continue;
        yield {
          drug: res.drug,
          countSig: res.countSignificant,
          countInsig: res.countInsignificant,
          countUpSig: res.countUpSignificant,
          countDownSig:
            (res.countSignificant || 0) - (res.countUpSignificant || 0),
          oddsRatio: res.oddsRatio,
          pvalueUp: res.pvalueUp,
          adjPvalueUp: res.adjPvalueUp,
          oddsRatioUp: res.oddsRatioUp,
          pvalueDown: res.pvalueDown,
          adjPvalueDown: res.adjPvalueDown,
          oddsRatioDown: res.oddsRatioDown,
        };
      }
  
      offset += nodes.length;
  
      if (offset >= totalCount) break;
    }
}
  