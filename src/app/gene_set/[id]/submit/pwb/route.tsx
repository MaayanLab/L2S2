import { ViewGeneSetDocument, ViewGeneSetQuery, ViewGeneSetQueryVariables } from "@/graphql"
import { getClient } from "@/lib/apollo/client"
import { redirect } from 'next/navigation'

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const client = getClient()
  const geneSet = await client.query<ViewGeneSetQuery, ViewGeneSetQueryVariables>({
    query: ViewGeneSetDocument,
    variables: {
      id: params.id,
    },
  })
  if (!geneSet.data.geneSet) return new Response(JSON.stringify({error: 'Not Found'}), { status: 404 })
  const req = await fetch('https://playbook-workflow-builder.cloud/api/db/fpl', {
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    },
    method: 'POST',
    body: JSON.stringify({
      data:{
        "gene_set": {
          "type":"Input[Set[Gene]]",
          "value":{"description": `Rummagene Gene Set ${params.id}`,"set": geneSet.data.geneSet.genes.nodes.map(gene => gene.symbol)}
        }
      },
      workflow:[
        {"id": "gene_set_input","type":"Input[Set[Gene]]","data":{"id":"gene_set"}},
      ]
    }),
  })
  const res = await req.json()
  if (!res.shortId) return new Response(JSON.stringify({error: 'Failed to Register Gene Set'}), { status: 500 })
  redirect(`https://playbook-workflow-builder.cloud/graph/${res}`)
}
