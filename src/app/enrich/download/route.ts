import {
  EnrichmentQueryDocument,
  EnrichmentQueryQuery,
  FetchUserGeneSetDocument,
  FetchUserGeneSetQuery,
} from "@/graphql";
import { getClient } from "@/lib/apollo/client";
import ensureArray from "@/utils/ensureArray";
import partition from "@/utils/partition";
import streamTsv from "@/utils/streamTsv";

export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const dataset = searchParams.get("dataset");
  const term = searchParams.get("q") || "";
  const consensusFilter = searchParams.get("consensus") || "false";
  const filterKo = searchParams.get("ko") || "false";
  const filterFda = searchParams.get("fda") || "false";
  const dir = searchParams.get("dir") || "";

  const { data: userGeneSet, error: userGeneSetError } =
    await getClient().query<FetchUserGeneSetQuery>({
      query: FetchUserGeneSetDocument,
      variables: { id: dataset },
    });
  if (userGeneSetError) throw new Error(userGeneSetError.message);
  const genes = ensureArray(userGeneSet.userGeneSet?.genes)
    .filter((gene): gene is string => !!gene)
    .map((gene) => gene.toUpperCase());
  const { data: enrichmentResults, error: enrichmentResultsError } =
    await getClient().query<EnrichmentQueryQuery>({
      query: EnrichmentQueryDocument,
      variables: {
        genes,
        filterTerm: term + " " + dir,
        filterFda: filterFda === "true",
        filterKo: filterKo === "true",
        offset: 0,
        first: null,
      },
    });
  if (enrichmentResultsError) throw new Error(enrichmentResultsError.message);
  const nodes = enrichmentResults.currentBackground?.enrich?.nodes;
  const consensus = enrichmentResults.currentBackground?.enrich?.consensus;
  if (!nodes) throw new Error("No results");
  if (!consensus) throw new Error("No consensus");
  if (consensusFilter === "true") {
    return new Response(
      streamTsv(
        [
          "drug",
          "countSig",
          "countInsig",
          "countUpSig",
          "oddsRatio",
          "pvalue",
          "adjPvalue",
          "pvalueUp",
          "adjPvalueUp",
          "oddsRatioUp",
          "pvalueDown",
          "adjPvalueDown",
          "oddsRatioDown",
        ],
        consensus?.map((res) => {
          return {
            drug: res?.drug,
            countSig: res?.countSignificant,
            countInsig: res?.countInsignificant,
            countUpSig: res?.countUpSignificant,
            countDownSig:
              (res?.countSignificant || 0) - (res?.countUpSignificant || 0),
            oddsRatio: res?.oddsRatio,
            pvalue: res?.pvalue,
            adjPvalue: res?.adjPvalue,
            pvalueUp: res?.pvalueUp,
            adjPvalueUp: res?.adjPvalueUp,
            oddsRatioUp: res?.oddsRatioUp,
            pvalueDown: res?.pvalueDown,
            adjPvalueDown: res?.adjPvalueDown,
            oddsRatioDown: res?.oddsRatioDown,
          };
        }),
        (item) => {
          if (!item?.drug) return;
          return {
            drug: item.drug,
            countSig: item.countSig,
            countInsig: item.countInsig,
            countUpSig: item.countUpSig,
            countDownSig: item.countDownSig,
            oddsRatio: item.oddsRatio,
            pvalue: item.pvalue,
            adjPvalue: item.adjPvalue,
            pvalueUp: item.pvalueUp,
            adjPvalueUp: item.adjPvalueUp,
            oddsRatioUp: item.oddsRatioUp,
            pvalueDown: item.pvalueDown,
            adjPvalueDown: item.adjPvalueDown,
            oddsRatioDown: item.oddsRatioDown,
          };
        }),
        {
          headers: {
            "Content-Type": "text/tab-separated-values",
          },
        }
    );
  } else {
    
    return new Response(
      streamTsv(
        [
          "term",
          "geneSetSize",
          "nOverlap",
          "oddsRatio",
          "pvalue",
          "adjPvalue",
          "count",
          "approved",
          "geneSetHash",
        ],
        nodes.flatMap((node) =>
          node?.geneSets.nodes.map((geneSet) => ({
            geneSetHash: node.geneSetHash,
            geneSet,
            pvalue: node.pvalue,
            adjPvalue: node.adjPvalue,
            oddsRatio: node.oddsRatio,
            count: node.geneSets.nodes[0].geneSetFdaCountsById.nodes[0]?.count || 1,
            approved:
              node.geneSets.nodes[0].geneSetFdaCountsById.nodes[0].approved?.toString() ||
              "",
            nOverlap: node.nOverlap,
          }))
        ),
        (item) => {
          if (!item?.geneSet) return;
          return {
            term: item.geneSet.term,
            geneSetSize: item.geneSet.nGeneIds,
            nOverlap: item.nOverlap,
            oddsRatio: item.oddsRatio,
            pvalue: item.pvalue,
            adjPvalue: item.adjPvalue,
            count: item.count,
            approved: item.approved,
            geneSetHash: item.geneSetHash,
          };
        }
      ),
      {
        headers: {
          "Content-Type": "text/tab-separated-values",
        },
      }
    );
  }
  
}
