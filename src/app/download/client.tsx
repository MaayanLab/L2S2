'use client'
import React from 'react'
import Stats from "@/components/stats";

// TODO: have downloads as a table in the database
const downloads = [
  {
    url: 'https://lincs-dcic.s3.amazonaws.com/LINCS-sigs-2021/gmt/l1000_cp.gmt',
    filename: 'l1000_cp.gmt',
    title: 'l1000_cp.gmt',
    value: '1,436,110 signatures',
    size: <><span className="whitespace-nowrap">2.25GB uncompressed</span></>,
    updated: new Date('Jul 1 2021'),
  },
  {
    url: 'https://lincs-dcic.s3.amazonaws.com/LINCS-sigs-2021/gmt/l1000_xpr.gmt',
    filename: 'l1000_xpr.gmt',
    title: 'l1000_xpr.gmt',
    value: '281,890 signatures',
    size: <><span className="whitespace-nowrap">438.4MB uncompressed</span></>,
    updated: new Date('Jul 1 2021'),
  }
]

export default function DownloadClientPage() {
  const downloads_with_latest = React.useMemo(() => {
    const downloads_with_latest = [
      ...downloads,
    ]
    downloads_with_latest.sort((a, b) => a.updated < b.updated ? 1 : -1)
    return downloads_with_latest
  }, [])
  return (
    <div className="prose">
      <h2 className="title text-xl font-medium mb-3">Downloads</h2>
      <br />
      <div className="grid lg:grid-cols-2 gap-4 my-4">
        {downloads_with_latest.map(download => (
          <a key={download.url} className="stats shadow" href={download.url} download={download.filename}>
            <div className="stat gap-2">
              <div className="stat-title">{download.title}</div>
              <div className="stat-value">{download.value}</div>
              <div className="stat-desc whitespace-normal">
                {download.size}, <span className="whitespace-nowrap">Last Updated {download.updated.toDateString()}</span>
              </div>
            </div>
          </a>
        ))}
      </div>
      <p>GMT Term Structure:</p>
      <img className='mb-4' src='/images/term_diagram.png' width={"700px"}/>
      <p>
        Developed in <a className='underline cursor' href="https://labs.icahn.mssm.edu/maayanlab/">the Ma&apos;ayan Lab</a>
      </p>
      <p>
        For more information about the LINCS L1000 data and additional download types, please visit the <a className='underline cursor' href="https://maayanlab.cloud/sigcom-lincs/#/Download">SigComLINCS</a> website and refer to its <a className='underline cursor' href="https://academic.oup.com/nar/article/50/W1/W697/6582159">publication</a>.
      </p>
    </div>
  )
}
