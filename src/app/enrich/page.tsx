'use client'
import React from 'react'
import {
  FetchUserGeneSetQuery,
  useEnrichmentQueryQuery,
  useFetchUserGeneSetQuery,
  useOverlapQueryQuery,
  useViewGeneSetQuery
} from '@/graphql'
import ensureArray from "@/utils/ensureArray"
import LinkedTerm from '@/components/linkedTerm'
import Loading from '@/components/loading'
import Pagination from '@/components/pagination'
import { useQsState } from '@/utils/useQsState'
import Stats from '../stats'
import Image from 'next/image'
import GeneSetModal from '@/components/geneSetModal'

const pageSize = 10

type GeneSetModalT = {
  type: 'UserGeneSet',
  description: string,
  genes: string[],
} | {
  type: 'GeneSetOverlap',
  id: string,
  description: string,
  genes: string[]
} | {
  type: 'GeneSet',
  id: string,
  description: string,
} | undefined

function EnrichmentResults({ userGeneSet, setModalGeneSet }: { userGeneSet?: FetchUserGeneSetQuery, setModalGeneSet: React.Dispatch<React.SetStateAction<GeneSetModalT>> }) {
  const genes = React.useMemo(() =>
    ensureArray(userGeneSet?.userGeneSet?.genes).filter((gene): gene is string => !!gene).map(gene => gene.toUpperCase()),
    [userGeneSet]
  )
  const [page, setPage] = useQsState('page', 1)
  const { data: enrichmentResults } = useEnrichmentQueryQuery({
    skip: genes.length === 0,
    variables: { genes, offset: (page-1)*pageSize, first: pageSize },
  })
  return (
    <div className="flex flex-col gap-2 my-2">
      <h2 className="text-md font-bold">
        {!enrichmentResults?.currentBackground?.enrich ?
          <>Rummaging through <Stats show_gene_sets />.</>
          : <>After rummaging through <Stats show_gene_sets />. Rummagene <Image className="inline-block rounded" src="/images/rummagene_logo.png" width={50} height={100} alt="Rummagene"></Image> found {Intl.NumberFormat("en-US", {}).format(enrichmentResults?.currentBackground?.enrich?.totalCount || 0)} statistically significant matches.</>}
      </h2>
      <div className="overflow-x-auto">
        <table className="table table-xs">
          <thead>
            <tr>
              <th>Supporting tables containing matching gene sets</th>
              <th>Gene Set Size</th>
              <th>Overlap</th>
              <th>Odds</th>
              <th>PValue</th>
              <th>AdjPValue</th>
            </tr>
          </thead>
          <tbody>
            {!enrichmentResults?.currentBackground?.enrich ? [0,1,2,3,4,5,6,7,8,9].map((_, j) => (
              <tr key={j}>
                <th className={`h-4 bg-gray-${j%2==0?2:3}00 m-6 rounded`}>&nbsp;</th>
                <td className={`h-4 bg-gray-${j%2==0?2:3}00 m-6 rounded`}>&nbsp;</td>
                <td className={`h-4 bg-gray-${j%2==0?2:3}00 m-6 rounded`}>&nbsp;</td>
                <td className={`h-4 bg-gray-${j%2==0?2:3}00 m-6 rounded`}>&nbsp;</td>
                <td className={`h-4 bg-gray-${j%2==0?2:3}00 m-6 rounded`}>&nbsp;</td>
                <td className={`h-4 bg-gray-${j%2==0?2:3}00 m-6 rounded`}>&nbsp;</td>
              </tr>
            )) : null}
            {enrichmentResults?.currentBackground?.enrich?.nodes?.map((enrichmentResult, j) => (
              <tr key={j}>
                <th><LinkedTerm term={enrichmentResult?.geneSet?.term} /></th>
                <td className="whitespace-nowrap text-underline cursor-pointer">
                  <label
                    htmlFor="geneSetModal"
                    className="prose underline cursor-pointer"
                    onClick={evt => {
                      setModalGeneSet({
                        type: 'GeneSet',
                        id: enrichmentResult?.geneSet?.id,
                        description: enrichmentResult?.geneSet?.term ?? '',
                      })
                    }}
                  >{enrichmentResult?.geneSet?.nGeneIds}</label>
                </td>
                <td className="whitespace-nowrap text-underline cursor-pointer">
                  <label
                    htmlFor="geneSetModal"
                    className="prose underline cursor-pointer"
                    onClick={evt => {
                      setModalGeneSet({
                        type: 'GeneSetOverlap',
                        id: enrichmentResult?.geneSet?.id,
                        description: enrichmentResult?.geneSet?.term ?? '',
                        genes,
                      })
                    }}
                  >{enrichmentResult?.nOverlap}</label>
                </td>
                <td className="whitespace-nowrap">{enrichmentResult?.oddsRatio?.toPrecision(3)}</td>
                <td className="whitespace-nowrap">{enrichmentResult?.pvalue?.toPrecision(3)}</td>
                <td className="whitespace-nowrap">{enrichmentResult?.adjPvalue?.toPrecision(3)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="w-full flex flex-col items-center">
        <Pagination
          page={page}
          totalCount={enrichmentResults?.currentBackground?.enrich?.totalCount ? enrichmentResults?.currentBackground.enrich?.totalCount : undefined}
          pageSize={pageSize}
          onChange={page => setPage(page)}
        />
      </div>
    </div>
  )
}

function GeneSetModalWrapper(props: { modalGeneSet: GeneSetModalT, setModalGeneSet: React.Dispatch<React.SetStateAction<GeneSetModalT>> }) {
  const { data: geneSet } = useViewGeneSetQuery({
    skip: props.modalGeneSet?.type !== 'GeneSet',
    variables: props.modalGeneSet?.type === 'GeneSet' ? {
      id: props.modalGeneSet.id,
    } : undefined
  })
  const { data: overlap } = useOverlapQueryQuery({
    skip: props.modalGeneSet?.type !== 'GeneSetOverlap',
    variables: props.modalGeneSet?.type === 'GeneSetOverlap' ?  {
      id: props.modalGeneSet.id,
      genes: props.modalGeneSet?.genes,
    } : undefined,
  })
  return (
    <GeneSetModal
      showModal={props.modalGeneSet !== undefined}
      term={props.modalGeneSet?.description}
      geneset={
        props.modalGeneSet?.type === 'GeneSet' ? geneSet?.geneSet?.genes.nodes.map(gene => gene.symbol)
        : props.modalGeneSet?.type === 'GeneSetOverlap' ? overlap?.geneSet?.overlap.nodes.map(gene => gene.symbol)
        : props.modalGeneSet?.type === 'UserGeneSet' ? props.modalGeneSet.genes
        : undefined
      }
      setShowModal={show => {
        if (!show) props.setModalGeneSet(undefined)
      }}
    />
  )
}

export default function Enrich({
  searchParams
}: {
  searchParams: {
    dataset: string | string[] | undefined
  },
}) {
  const dataset = ensureArray(searchParams.dataset)[0]
  const { data: userGeneSet } = useFetchUserGeneSetQuery({
    skip: !dataset,
    variables: { id: dataset },
  })
  const [modalGeneSet, setModalGeneSet] = React.useState<GeneSetModalT>()
  return (
    <>
      <div className="flex flex-row gap-2 alert">
        <span className="prose">Input:</span>
        <label
          htmlFor="geneSetModal"
          className="prose underline cursor-pointer"
          onClick={evt => {
            setModalGeneSet({
              type: 'UserGeneSet',
              genes: (userGeneSet?.userGeneSet?.genes ?? []).filter((gene): gene is string => !!gene),
              description: userGeneSet?.userGeneSet?.description || 'Gene set',
            })
          }}
        >{userGeneSet?.userGeneSet?.description || 'Gene set'}{userGeneSet ? <> ({userGeneSet?.userGeneSet?.genes?.length ?? '?'} genes)</> : null}</label>
      </div>
      <div className="container mx-auto">
        <EnrichmentResults userGeneSet={userGeneSet} setModalGeneSet={setModalGeneSet} />
      </div>
      <GeneSetModalWrapper modalGeneSet={modalGeneSet} setModalGeneSet={setModalGeneSet} />
    </>
  )
}
