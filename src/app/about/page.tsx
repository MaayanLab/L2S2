import React from 'react'
import Image from "next/image"
import Stats from "../stats"
import Link from "next/link"
import { Metadata, ResolvingMetadata } from 'next'

export async function generateMetadata(props: {}, parent: ResolvingMetadata): Promise<Metadata> {
  const parentMetadata = await parent
  return {
    title: `${parentMetadata.title?.absolute} | About`,
    keywords: parentMetadata.keywords,
  }
}

export default async function About() {
  return (
    <div className="prose">
      <h2 className="title text-xl font-medium mb-3">About Rummagene</h2>
      <div className="flex">
        <div className="flex-col">
        <Image className={'rounded float-right ml-5'} src={'/images/LINCSearch_logo.png'} width={250} height={250} alt={'L2S2'}></Image>
          <p className="text-justify">
          
          </p>
          
          <br></br>
          <p>
          The Library of Integrated Network-Based Cellular Signatures (LINCS) is an NIH Common Fund initiative dedicated to cataloging the global responses of human cells to various chemical, genetic, and disease-related perturbations. LINCS resources encompass experimental and computational techniques, data visualization tools, molecular and imaging data, and distinctive cellular response signatures. By compiling a comprehensive view of human cellular responses to diverse perturbations, LINCS aims to enhance our understanding of disease mechanisms and facilitate new therapeutic discoveries. Perturbations studied include drugs, genetic modifications, tissue micro-environments, antibodies, and mutations associated with diseases. Cellular responses to these perturbations are measured using transcript profiling, mass spectrometry, cell imaging, and other biochemical assays. The program emphasizes cellular functions common to different tissues and cell types that are relevant to diseases like cancer, heart disease, and neurodegenerative disorders.
          Gene set signatures are sourced from SigCom LINCS, a web-based search engine that serves over 1.5 million gene expression signatures processed, analyzed, and visualized from LINCS, GTEx, and GEO. SigCom LINCS provides rapid signature similarity search for mimickers and reversers given sets of up and down genes. L2W2 provides fast enrichment search and term search for over 1.4 million chemical perturbation and over 280,000 CRISPR knockout signatures.
          </p>
          <br />
          <p>
          This site is programmatically accessible via a <Link href="/graphiql" className="underline cursor-pointer" target="_blank">GraphQL API</Link>.
          </p>
          <br />
          <p>
          L2S2 was developed by <a className='underline cursor' href="https://labs.icahn.mssm.edu/maayanlab/">the Ma&apos;ayan Lab</a>
          </p>
          <br />
          <p>Please acknowledge LINCS in your publications by citing the following references:</p>
          <br></br>
          <p>Evangelista, J. E., Clarke, D. J. B., Xie, Z., Lachmann, A., Jeon, M., Chen, K., Jagodnik, K. M., Jenkins, S. L., Kuleshov, M. V., Wojciechowicz, M. L., Schürer, S. C., Medvedovic, M., & Ma&apos;ayan, A. (2022). SigCom LINCS: data and metadata search engine for a million gene expression signatures. Nucleic acids research, 50(W1), W697–W709.
            <a className="underline cursor" href="https://doi.org/10.1093/nar/gkac3287" target="_blank"> https://doi.org/10.1093/nar/gkac3287.</a></p>
            <br></br>
          <p>Keenan, A. B., Jenkins, S. L., Jagodnik, K. M., Koplev, S., He, E., Torre, D., Wang, Z., Dohlman, A. B., Silverstein, M. C., Lachmann, A., Kuleshov, M. V., Ma&apos;ayan, A., Stathias, V., Terryn, R., Cooper, D., Forlin, M., Koleti, A., Vidovic, D., Chung, C., Schürer, S. C., … Pillai, A. (2018). The Library of Integrated Network-Based Cellular Signatures NIH Program: System-Level Cataloging of Human Cells Response to Perturbations. Cell systems, 6(1), 13–24.
            <a className="underline cursor" href="https://doi.org/10.1016/j.cels.2017.11.001" target="_blank"> https://doi.org/10.1016/j.cels.2017.11.001.</a></p>
        </div>
       
      </div>
      
    </div>
  )
}
