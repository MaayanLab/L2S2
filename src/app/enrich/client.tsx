'use client'
import React from 'react'
import {
  FetchUserGeneSetQuery,
  useEnrichmentQueryQuery,
  useFetchGeneInfoQuery,
  useFetchUserGeneSetQuery,
  useOverlapQueryQuery,
  useViewGeneSetQuery
} from '@/graphql'
import ensureArray from "@/utils/ensureArray"
import Loading from '@/components/loading'
import Pagination from '@/components/pagination'
import useQsState from '@/utils/useQsState'
import Stats from '../stats'
import Image from 'next/image'
import GeneSetModal from '@/components/geneSetModal'

const pageSize = 12

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
  const [queryString, setQueryString] = useQsState({ page:  '1', q: '', dir: '', fda: 'false', consensus: 'false' })
  const [rawTerm, setRawTerm] = React.useState('')
  const [showTerm, setShowTerm] = React.useState(false)
  //const [fdaFilter, setFdaFilter] = React.useState(false)
  const { page, term, fda, consensus } = React.useMemo(() => ({ 
    page: queryString.page ? +queryString.page : 1, 
    term: queryString.q ?? '',
    fda: queryString.fda === 'true',
    consensus: queryString.consensus === 'true'
  }), [queryString]);
  const { data: enrichmentResults } = useEnrichmentQueryQuery({
    skip: genes.length === 0,
    variables: { genes, filterTerm: term + ' ' + queryString.dir, offset: (page-1)*pageSize, first: pageSize, filterFda: fda },
  })

  console.log(enrichmentResults)

  React.useEffect(() => {
    console.log(term)
    setRawTerm(term)
  }, [term])

  return (
    <div className="flex flex-col gap-2 my-2">
      <h2 className="text-md font-bold">
        {!enrichmentResults?.currentBackground?.enrich ?
          <>Rummaging through <Stats show_gene_sets />.</>
          : <>After rummaging through <Stats show_gene_sets />. L2S2 <Image className="inline-block rounded" src="/images/LINCSearch_logo.png" width={50} height={100} alt="LINCSearch"></Image> found {Intl.NumberFormat("en-US", {}).format(enrichmentResults?.currentBackground?.enrich?.totalCount || 0)} statistically significant matches.</>}
      </h2>
      <div className='row'>
        {consensus ? <></> : <button className='button btn btn-sm float-left' onClick={() => setShowTerm(prev => !prev)}>{showTerm ? 'Hide Full' : 'Show Full'} terms</button>}
        <button className='button btn btn-sm float-left mx-4' onClick={() => {
          if (queryString.fda === 'false') setQueryString({ page: '1', q: rawTerm, fda: 'true', dir: queryString.dir }) 
          else setQueryString({ page: '1', q: rawTerm, fda: 'false', dir: queryString.dir })}}>{queryString.fda === 'true' ? 'Show All Drugs' : 'Show FDA Approved Drugs'}</button>
          <button className='button btn btn-sm float-left mr-4' onClick={() => {
          if (queryString.consensus === 'false') setQueryString({ page: '1', q: rawTerm, fda: queryString.fda, consensus: 'true', dir: queryString.dir }) 
          else setQueryString({ page: '1', q: rawTerm, fda: queryString.fda, consensus: 'false', dir: queryString.dir })}}>{queryString.consensus === 'true' ? 'Show Individual Signatures' : 'Show Consensus Perturbations'}</button>
         {consensus ? <></> : <div id="dir-select" className='join flex flex-row place-content-start place-items-center' >
          <div className={queryString.dir == '' ? "join-item px-3 py-1.5 text-sm bg-gray-200 dark:bg-gray-700 font-bold cursor-pointer": 
            "join-item px-3 py-1.5 bg-gray-100 cursor-pointer hover:font-bold text-sm dark:bg-gray-900"} onClick={(evt) => {
              evt.preventDefault()
              setQueryString({ page: '1', q: rawTerm, dir: '' })
              }}>BOTH</div>
          <div className={queryString.dir == 'up' ? "join-item px-3 py-1.5 text-sm bg-gray-200 dark:bg-gray-700 font-bold cursor-pointer": 
            "join-item px-3 py-1.5  bg-gray-100 cursor-pointer hover:font-bold text-sm dark:bg-gray-900"} onClick={(evt) => {
              evt.preventDefault()
              setQueryString({ page: '1', q: rawTerm, dir: 'up' })
            }
            }>UP</div>
          <div className={queryString.dir == 'down' ? "join-item px-3 py-1.5 text-sm bg-gray-200 dark:bg-gray-700 font-bold cursor-pointer": 
            "join-item px-3 py-1.5 bg-gray-100 cursor-pointer hover:font-bold text-sm dark:bg-gray-900"} onClick={(evt) => {
              evt.preventDefault()
              setQueryString({ page: '1', q: rawTerm, dir: 'down' })
            }}>DOWN</div>
        </div>}
      <form
        id="search-form"
        className="join flex flex-row place-content-end place-items-center mt-10"
        onSubmit={evt => {
          evt.preventDefault()
          setQueryString({ page: '1', q: rawTerm })
        }}
      >
        <input
          type="text"
          className="input input-bordered join-item"
          value={rawTerm}
          onChange={evt => {setRawTerm(evt.currentTarget.value)}}
        />
        <div className="tooltip" data-tip="Search results">
          <button
            type="submit"
            className="btn join-item"
          >&#x1F50D;</button>
        </div>
        <div className="tooltip" data-tip="Clear search">
          <button
            type="reset"
            className="btn join-item"
            onClick={evt => {
              setQueryString({ page: '1', q: '' })
            }}
          >&#x232B;</button>
        </div>
        <a href={`/enrich/download?dataset=${queryString.dataset}&q=${queryString.q}`} download="results.tsv">
          <div className="tooltip" data-tip="Download results">
            <button
              type="button"
              className="btn join-item font-bold text-2xl pb-1"
            >&#x21E9;</button>
          </div>
        </a>
      </form>
      </div>
      <div className="overflow-x-auto">
        {consensus ? 
        <>
        <table className="table table-xs">
          <thead>
            <tr>
              <th className={showTerm ? '' : 'hidden'}>Term</th>
              <th>Perturbation</th>
              <th>Significant Signatures</th>
              <th>Insignificant Signatures</th>
              <th>FDA Approved</th>
              <th>Odds Ratio</th>
              <th>PValue</th>
              <th>AdjPValue</th>
            </tr>
          </thead>
          <tbody>
            {!enrichmentResults?.currentBackground?.enrich ?
              <tr>
                <td colSpan={7}><Loading /></td>
              </tr>
            : null}
            {enrichmentResults?.currentBackground?.enrich?.consensus?.flatMap((enrichmentResult, genesetIndex) => {
              return (
                <tr key={genesetIndex}>
                  <td>{enrichmentResult?.drug}
                  <a className='underline cursor-pointer mx-2' href={`https://pubchem.ncbi.nlm.nih.gov/#query=${enrichmentResult?.drug}`} target='_blank'>
                  <Image className="inline-block rounded" src="/images/drug_vector_art.png" width={20} height={20} alt="PubChem"/>
                  </a>
                  </td>
                  <td>{enrichmentResult?.countSignificant}</td>
                  <td>{enrichmentResult?.countInsignificant}</td>
                  <td>{enrichmentResult?.approved ? 'Yes' : 'No'}</td>
                  <td>{enrichmentResult?.oddsRatio?.toPrecision(3)}</td>
                  <td>{enrichmentResult?.pvalue?.toPrecision(3)}</td>
                  <td>{enrichmentResult?.adjPvalue?.toPrecision(3)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
        </> : 
        <table className="table table-xs">
          <thead>
            <tr>
              <th className={showTerm ? '' : 'hidden'}>Term</th>
              <th>Perturbation</th>
              <th>Cell Line</th>
              <th>Timepoint</th>
              <th>Concentration</th>
              <th>Direction</th>
              <th>Signature Count</th>
              <th>FDA Approved</th>
              <th>Gene Set Size</th>
              <th>Overlap</th>
              <th>Odds</th>
              <th>PValue</th>
              <th>AdjPValue</th>
            </tr>
          </thead>
          <tbody>
            {!enrichmentResults?.currentBackground?.enrich ?
              <tr>
                <td colSpan={7}><Loading /></td>
              </tr>
            : null}
            {enrichmentResults?.currentBackground?.enrich?.nodes?.flatMap((enrichmentResult, genesetIndex) => {
              const term = enrichmentResult?.geneSets.nodes[0].term
              const batch = enrichmentResult?.geneSets.nodes[0].term.split('_')[0]
              const cellLine = enrichmentResult?.geneSets.nodes[0].term.split('_')[1]
              const timepoint = enrichmentResult?.geneSets.nodes[0].term.split('_')[2] 
              const batch2 = enrichmentResult?.geneSets.nodes[0].term.split('_')[3]
              var perturbation = enrichmentResult?.geneSets.nodes[0].term.split('_')[4]
              if (perturbation?.split(' ').length == 2) perturbation = perturbation?.split(' ')[0] + ' KO'

              const count = enrichmentResult?.geneSets.nodes[0].geneSetFdaCountsById.nodes[0].count
              const approved = enrichmentResult?.geneSets.nodes[0].geneSetFdaCountsById.nodes[0].approved

              const direction = enrichmentResult?.geneSets.nodes[0].term.split('_')[5]?.split(' ')[0] ?? 'N/A'
              const concentration = enrichmentResult?.geneSets.nodes[0].term.split(' ')[1]
              
              if (!enrichmentResult?.geneSets) return null
              return (
                <tr key={genesetIndex} className='text-center'>
                <td className={showTerm ? '' : 'hidden'}>{term}</td>
                <td>
                  {!perturbation?.includes('KO') ? 
                  <>
                  {perturbation}
                  <a className='underline cursor-pointer mx-2' href={`https://pubchem.ncbi.nlm.nih.gov/#query=${perturbation}`} target='_blank'>
                  <Image className="inline-block rounded" src="/images/drug_vector_art.png" width={20} height={20} alt="PubChem"/>
                  </a>
                  </>
                    :
                    <>
                    {perturbation}
                    <a className='underline cursor-pointer mx-2' href={`https://maayanlab.cloud/Harmonizome/gene/${perturbation.replace(' KO', '')}`} target='_blank'>
                      <Image className="inline-block rounded" src="/images/harmonizome_logo_30x26.png" width={20} height={20} alt="Harmonizome"/>
                    </a>
                    <a className='underline cursor-pointer' href={`https://maayanlab.cloud/prismexp/g/${perturbation.replace(' KO', '')}`} target='_blank'>
                      <Image className="inline-block rounded" src="/images/prismexp.png" width={20} height={20} alt="PrismEXP"/>
                    </a>
                  </>}
                </td>
                <td>
                  <a className='underline cursor-pointer' onClick={
                    async evt => {
                      evt.preventDefault()
                      const res = await fetch('enrich/depmapcl', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          cellLine: cellLine,
                        })})

                        const resJson = await res.json()
                        window.open(`https://depmap.org${resJson[0].url}`, '_blank')
                    }
                  }>{cellLine}</a>
                </td>
                <td>
                  {timepoint}
                </td>
                <td>
                  {direction}
                </td>
                <td>
                  {concentration}
                </td>
                <td>
                  {count}
                </td>
                <td>
                  {approved ? 'Yes' : 'No'}
                </td>
                <td>
                <label
                  htmlFor="geneSetModal"
                  className="prose underline cursor-pointer"
                  onClick={evt => {
                    setModalGeneSet({
                      type: 'GeneSet',
                      id: enrichmentResult?.geneSets.nodes[0].id,
                      description: term ?? '',
                    })
                  }}
                >{enrichmentResult?.geneSets.nodes[0].nGeneIds}</label>
                </td>
                <td>
                <label
                    htmlFor="geneSetModal"
                    className="prose underline cursor-pointer"
                    onClick={evt => {
                      setModalGeneSet({
                        type: 'GeneSetOverlap',
                        id: enrichmentResult?.geneSets.nodes[0].id,
                        description: `${userGeneSet?.userGeneSet?.description || 'User gene set'} & ${term || 'L2S2 gene set'}`,
                        genes,
                      })
                    }}
                  >{enrichmentResult?.nOverlap}</label>
                </td>
                <td>
                  {enrichmentResult?.oddsRatio?.toPrecision(3)}
                </td>
                <td>
                  {enrichmentResult?.pvalue?.toPrecision(3)}
                </td>
                <td>
                  {enrichmentResult?.adjPvalue?.toPrecision(3)}
                </td>
                
              </tr>

              )

            })}
          </tbody>
        </table>}
      </div>
      {enrichmentResults?.currentBackground?.enrich ?
        <div className="w-full flex flex-col items-center">
          {consensus ? <Pagination
            page={page}
            totalCount={enrichmentResults?.currentBackground?.enrich?.consensusCount ? enrichmentResults?.currentBackground?.enrich.consensusCount : undefined}
            pageSize={pageSize}
            onChange={page => {
              setQueryString({ page: `${page}`, q: term })
            }}
          />:
          <Pagination
            page={page}
            totalCount={enrichmentResults?.currentBackground?.enrich?.totalCount ? enrichmentResults?.currentBackground?.enrich.totalCount : undefined}
            pageSize={pageSize}
            onChange={page => {
              setQueryString({ page: `${page}`, q: term })
            }}
          />}
        </div>
      : null}
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
  const { data: userGeneSet } = useFetchGeneInfoQuery({
    skip: props.modalGeneSet?.type !== 'UserGeneSet',
    variables: props.modalGeneSet?.type === 'UserGeneSet' ? {
      genes: props.modalGeneSet.genes,
    } : undefined,
  })
  return (
    <GeneSetModal
      showModal={props.modalGeneSet !== undefined}
      term={props.modalGeneSet?.description}
      geneset={
        props.modalGeneSet?.type === 'GeneSet' ? geneSet?.geneSet?.genes.nodes
        : props.modalGeneSet?.type === 'GeneSetOverlap' ? overlap?.geneSet?.overlap.nodes
        : props.modalGeneSet?.type === 'UserGeneSet' ?
          userGeneSet?.geneMap2?.nodes ? userGeneSet.geneMap2.nodes.map(({ gene, geneInfo }) => ({gene, ...geneInfo}))
          : props.modalGeneSet.genes.map(symbol => ({ symbol }))
        : undefined
      }
      setShowModal={show => {
        if (!show) props.setModalGeneSet(undefined)
      }}
    />
  )
}

export default function EnrichClientPage({
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
      <EnrichmentResults userGeneSet={userGeneSet} setModalGeneSet={setModalGeneSet} />
      <GeneSetModalWrapper modalGeneSet={modalGeneSet} setModalGeneSet={setModalGeneSet} />
    </>
  )
}
