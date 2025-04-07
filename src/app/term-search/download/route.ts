import {
  TermSearchGeneSetsDocument,
  TermSearchGeneSetsQuery,
} from "@/graphql";
import { getClient } from "@/lib/apollo/client";
import ensureArray from "@/utils/ensureArray";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const term = ensureArray(decodeURIComponent(searchParams.get("term") || ""));

  if (!term) {
    return new Response("Missing 'term' query parameter", { status: 400 });
  }

  const client = getClient();
  const pageSize = 10;
  let hasMore = true;
  let cursor: string | null = null;

  const encoder = new TextEncoder();
  console.log(term)

  const stream = new ReadableStream({
    async start(controller) {
      while (hasMore) {
        const { data } = await client.query<TermSearchGeneSetsQuery>({
          query: TermSearchGeneSetsDocument,
          variables: { filterTerm: term, first: pageSize, after: cursor },
        });

        if (data?.geneSetTermSearch?.nodes.length) {
          for (const node of data.geneSetTermSearch.nodes) {
            const row = `${node.term}\t\t${node.genes.nodes
              .map((g) => g.symbol)
              .join("\t")}\n`;
            controller.enqueue(encoder.encode(row));
          }
          cursor = data.geneSetTermSearch.pageInfo.endCursor;
          hasMore = data.geneSetTermSearch.pageInfo.hasNextPage;
        } else {
          hasMore = false;
        }
      }
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/tab-separated-values",
      "Content-Disposition": `attachment; filename="${term.join("_")}_genesets.tsv"`,
    },
  });
}
