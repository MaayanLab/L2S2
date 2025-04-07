import React from 'react'
import { useViewGeneSetQuery } from '@/graphql';
import GeneSetModal from '@/components/geneSetModal';
import useQsState from '@/utils/useQsState';
import Pagination from '@/components/pagination';
import TermDownloadButton from '@/components/termDownloadButton';


const pageSize = 10

export default function TermTable({ terms }: { terms: { __typename?: "GeneSet" | undefined; term?: string | null | undefined; id?: any; nGeneIds?: number | null | undefined; }[] }) {
  const [queryString, setQueryString] = useQsState({ page: '1', f: '' })
  const { page, searchTerm, tableSearch } = React.useMemo(() => ({ page: queryString.page ? +queryString.page : 1, searchTerm: queryString.q ?? '', tableSearch: queryString.f || '' }), [queryString])

  const dataFiltered = React.useMemo(() =>
    terms.filter(el => {
      return (el?.term?.toLowerCase().includes(tableSearch.toLowerCase()))
    }),
  [terms, tableSearch])

  const [geneSetId, setGeneSetId] = React.useState(terms[0].id)
  const [currTerm, setCurrTerm] = React.useState(terms[0].term)
  const [showModal, setShowModal] = React.useState(false)

  const genesQuery = useViewGeneSetQuery({
    variables: { id: geneSetId }
  })

  return (
    <>
      <GeneSetModal geneset={genesQuery?.data?.geneSet?.genes.nodes} term={currTerm} showModal={showModal} setShowModal={setShowModal}></GeneSetModal>
      <div className='border m-5 mt-1'>

      <div className='join flex flex-row place-content-end items-center pt-3 pr-3'>
          <span className="label-text text-base">Search:&nbsp;</span>
          <input
            type="text"
            className="input input-bordered"
            value={tableSearch}
            onChange={evt => {
              setQueryString({ page: '1', f: evt.currentTarget.value, q: queryString.q })
            }}
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
                setQueryString({ page: '1', f: '' })
              }}
            >&#x232B;</button>
          </div>
          <div className="tooltip" data-tip="Download results">
            <TermDownloadButton dataFiltered={dataFiltered} filterTerm={searchTerm || ""} />
          </div>
        </div>
        <table className="table table-xs">
          <thead>
            <tr>
              <th>Term</th>
              <th>Perturbation</th>
              <th>Cell Line</th>
              <th>Timepoint</th>
              <th>Concentration</th>
              <th>Direction</th>
              <th>Gene Set Size</th>
            </tr>
          </thead>
          <tbody>
            {dataFiltered?.slice((page-1) * pageSize, page * pageSize).map(el => {
              if (!el) return null
              const term = el.term
              const batch = el?.term?.split('_')[0]
              const cellLine = el?.term?.split('_')[1]
              const timepoint = el?.term?.split('_')[2] 
              const batch2 = el?.term?.split('_')[3]
              var perturbation = el?.term?.split('_')[4]
              if (perturbation?.split(' ').length == 2) perturbation = perturbation?.split(' ')[0] + ' KO'
              const concentration = el?.term?.split('_')[5]?.split(' ')[0] ?? 'N/A'
              const direction = el?.term?.split(' ')[1]
              return (
                  <tr key={el?.term}>
                    <td>
                    {term}
                  </td>
                  <td>
                    {perturbation}
                  </td>
                  <td>
                    {cellLine}
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

                  <td className='w-3/12'>
                    <button
                      className='btn btn-xs btn-outline p-2 h-auto'
                      data-te-toggle="modal"
                      data-te-target="#geneSetModal"
                      data-te-ripple-init
                      data-te-ripple-color="light"
                      onClick={evt => {
                        setCurrTerm(el?.term || '')
                        setGeneSetId(el?.id || '')
                        setShowModal(true)
                      }}
                    ><p>View Gene Set ({el?.nGeneIds})</p>
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <div className="flex flex-col items-center">
        <Pagination
          page={page}
          pageSize={pageSize}
          totalCount={dataFiltered?.length}
          onChange={newPage => {setQueryString({ page: `${newPage}` })}}
        />
      </div>
    </>
  )
}