import React from 'react'

async function getRummageoLink(genesetName: string, genes: string[]) {
    const RUMMAGEO_URL = 'https://rummageo.com/graphql'
    const json = {
        "operationName": "AddUserGeneSet",
        "variables": { "description": genesetName, "genes": genes },
        "query": "mutation AddUserGeneSet($genes: [String], $description: String = \"\") {\n  addUserGeneSet(input: {genes: $genes, description: $description}) {\n    userGeneSet {\n      id\n      __typename\n    }\n    __typename\n  }\n}\n"
    }
    try {
        const response = await fetch(RUMMAGEO_URL,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(json),
            })

        const responseJSON = await response.json()
        const datasetId = responseJSON["data"]['addUserGeneSet']["userGeneSet"]["id"]
        const link = 'https://rummageo.com/enrich?dataset=' + datasetId + '&_rsc=3hhhm'
        return link
    } catch {
        await new Promise(r => setTimeout(r, 2000));
        const response = await fetch(RUMMAGEO_URL,
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
        const link = 'https://rummageo.com/enrich?dataset=' + datasetId + '&_rsc=3hhhm'
        return link
    }
}

export default function RummageoButton({ genes, description }: { genes?: string[] | undefined, description?: string | null }) {
    return (
        <button
            className="btn btn-sm btn-outline text-xs"
            type="button"
            onClick={async () => {
                if (genes && genes?.length > 0) {
                    const link = await getRummageoLink(description || '', genes)
                    window.open(link, '_blank')
                }

            }}
            >
            Submit to RummaGEO
        </button>

    )
}
