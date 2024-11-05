'use server'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
    console.log(request)
    var { cellLine } = await request.json()
    if (cellLine.includes('.')) {
        cellLine = cellLine.split('.')[0]
    }

    const res = await fetch(`https://depmap.org/portal/search/${cellLine}`)
    const resJson = await res.json()

    return NextResponse.json(resJson)
}
