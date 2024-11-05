import React from 'react'

async function getRummageneLink(genesetName: string, genes: string[]) {
    const RUMMAGENE_URL = 'https://rummagene.com/graphql'
    const json = {
        "operationName": "AddUserGeneSet",
        "variables": { "description": genesetName, "genes": genes },
        "query": "mutation AddUserGeneSet($genes: [String], $description: String = \"\") {\n  addUserGeneSet(input: {genes: $genes, description: $description}) {\n    userGeneSet {\n      id\n      __typename\n    }\n    __typename\n  }\n}\n"
    }
    try {
        const response = await fetch(RUMMAGENE_URL,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(json),
            })

        const responseJSON = await response.json()
        const datasetId = responseJSON["data"]['addUserGeneSet']["userGeneSet"]["id"]
        const link = 'https://rummagene.com/enrich?dataset=' + datasetId
        return link
    } catch {
        await new Promise(r => setTimeout(r, 2000));
        const response = await fetch(RUMMAGENE_URL,
            {
                method: "POST",
                headers: {
                    // "Content-Type": "application/json;charset=UTF-8",
                    "Content-Type": "application/json",
                    "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko)"
                },
                body: JSON.stringify(json),
            })

        const responseJSON = await response.json()
        const datasetId = responseJSON["data"]['addUserGeneSet']["userGeneSet"]["id"]
        const link = 'https://rummagene.com/enrich?dataset=' + datasetId
        return link
    }
}

export default function RummageneButton({ genes, description }: { genes?: string[] | undefined, description?: string | null }) {
    return (
        <button
            className="btn btn-sm btn-outline text-xs"
            type="button"
            onClick={async () => {
                if (genes && genes?.length > 0) {
                    const link = await getRummageneLink(description || '', genes)
                    window.open(link, '_blank')
                }

            }}
            >
            Submit to Rummagene
        </button>

    )
}
