import {
  FetchUserGeneSetDocument,
  FetchUserGeneSetQuery,
} from "@/graphql";
import { getClient } from "@/lib/apollo/client";
import ensureArray from "@/utils/ensureArray";
import streamTsv from "@/utils/streamTsv";
import {paginatedNodeGenerator, paginatedConsensusGenerator, paginatedMoAsGenerator} from "@/utils/paginatedGenerators";

export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const dataset = searchParams.get("dataset");
  const term = searchParams.get("q") || "";
  const consensusFilter = searchParams.get("consensus") || "false";
  const MoAsFilter = searchParams.get("moas") || "false";
  const filterKo = searchParams.get("ko") || "false";
  const sort = searchParams.get("sort") || "pvalue";
  const filterFda = searchParams.get("fda") || "false";
  const dir = searchParams.get("dir") || "";
  const topN = searchParams.get("topn") || "1000";
  const maxTotal = searchParams.get("maxTotal") || "100000";

  const { data: userGeneSet, error: userGeneSetError } =
    await getClient().query<FetchUserGeneSetQuery>({
      query: FetchUserGeneSetDocument,
      variables: { id: dataset },
    });
  if (userGeneSetError) throw new Error(userGeneSetError.message);
  const genes = ensureArray(userGeneSet.userGeneSet?.genes)
    .filter((gene): gene is string => !!gene)
    .map((gene) => gene.toUpperCase());
  if (genes.length === 0) {
    return new Response("No genes found", { status: 400 });
  } else if (consensusFilter === "true") {
    return new Response(
      streamTsv(
        [
            "drug",
            "countSig",
            "countInsig",
            "countUpSig",
            "countDownSig",
            "oddsRatio",
            "pvalueUp",
            "adjPvalueUp",
            "oddsRatioUp",
            "pvalueDown",
            "adjPvalueDown",
            "oddsRatioDown",
        ],
        paginatedConsensusGenerator(
          genes,
          term + " " + dir,
          filterFda === "true",
          filterKo === "true",
          parseInt(topN),
          sort
        ),
        (item) => item
      ),
      {
        headers: {
          "Content-Type": "text/tab-separated-values",
        },
      }
    );
  } else if (MoAsFilter === "true") {
    return new Response(
      streamTsv(
        [
            "drug",
            "countSig",
            "countInsig",
            "countUpSig",
            "countDownSig",
            "oddsRatio",
            "pvalueUp",
            "adjPvalueUp",
            "oddsRatioUp",
            "pvalueDown",
            "adjPvalueDown",
            "oddsRatioDown",
        ],
        paginatedMoAsGenerator(
          genes,
          term + " " + dir,
          filterFda === "true",
          filterKo === "true",
          parseInt(topN),
          sort
        ),
        (item) => item
      ),
      {
        headers: {
          "Content-Type": "text/tab-separated-values",
        },
      }
    );
  }
  else {
      return new Response(
        streamTsv(
          [
            "term",
            "geneSetSize",
            "moa",
            "nOverlap",
            "oddsRatio",
            "pvalue",
            "adjPvalue",
            "count",
            "approved",
            "geneSetHash",
          ],
          paginatedNodeGenerator(
            genes,
            term + " " + dir,
            filterFda === "true",
            filterKo === "true",
            parseInt(topN),
            sort,
            parseInt(maxTotal)
          ),
          (item) => item
        ),
        {
          headers: {
            "Content-Type": "text/tab-separated-values",
          },
        }
      );
    }
  
}
