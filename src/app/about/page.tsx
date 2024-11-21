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
      <h2 className="title text-xl font-medium mb-3">About L2S2</h2>
      <div className="flex">
        <div className="flex-col">
        <Image className={'rounded float-right ml-5'} src={'/images/LINCSearch_logo.png'} width={250} height={250} alt={'L2S2'}></Image>
          <br></br>
          <p>
          The Library of Integrated Network-Based Cellular Signatures (LINCS) Common Fund program was established to construct a reference database of human cancer cell lines responses to diverse multi-omics and phenotypic perturbations. As part of the LINCS initiative, 248 cell lines were profiled with the L1000 transcriptomics assay to measure the response to 33,621 small molecules and 7,508 single gene CRISPR knockouts (KOs). From this massive dataset, we computed sets of up- and down-regulated genes. These gene sets are served for search by the LINCS L1000 Signature Search (L2S2) platform. L2S2 provides instant results when searching across over 1.678 million chemical perturbations and CRISPR KO signatures. The platform includes filters for FDA-approved drugs and signature directionality. With the L2S2 search engine, users can identify small molecules and single gene CRISPR KOs that produce gene expression profiles similar or opposite to their submitted gene sets. Significant CRISPR KO signatures can reveal potential driver genes and drug targets. Similarly, approved drugs and preclinical small molecule signatures that might reverse or mimic a desired expression pattern can provide hypotheses for preclinical experimental validation studies. L2S2 also includes a consensus search feature which ranks specific perturbations across cellular contexts, time points, and concentrations. L2S2 was systematically applied to the CPTAC3 cohort to prioritize potential targets, approved drugs, and preclinical compounds for all previously identified multi-omic cancer cohort subtypes. Overall, L2S2 provides cancer researchers with a powerful tool to further understand and personalize treatments for cancer subtypes.
          </p>
          <br />
          <p>
          This site is programmatically accessible via a <Link href="/graphiql" className="underline cursor-pointer" target="_blank">GraphQL API</Link>.
          </p>
          <br />
          <p>
          L2S2 was developed by <a className='underline cursor' href="https://labs.icahn.mssm.edu/maayanlab/">the Ma&apos;ayan Lab.</a>
          </p>
          <br />
          <p>Learn more about the LINCS program and the L1000 assay:</p>
          <ul className='list-decimal ml-4'>
            <li>The L1000 data was generated by the Connectivity Map at the Broad Institute: <a className='underline cursor' href="https://clue.io/" target='_blank'>https://clue.io/</a>.
            <p className='text-sm '>
            Subramanian, A., et al. (2017). A Next Generation Connectivity Map: L1000 Platform and the First 1,000,000 Profiles. Cell, 171(6), 1437–1452.e17. <a className="underline cursor" href="https://doi.org/10.1016/j.cell.2017.10.049" target="_blank">https://doi.org/10.1016/j.cell.2017.10.049</a>
            </p></li>
            <li>The LINCS program information portal: <a className='underline cursor' href="https://lincsproject.org/" target='_blank'>https://lincsproject.org/</a>.</li>
            <li>The LINCS program landmark paper:<p className='text-sm'>Keenan, A. B., et al. (2018). The Library of Integrated Network-Based Cellular Signatures NIH Program: System-Level Cataloging of Human Cells Response to Perturbations. Cell systems, 6(1), 13–24. 
              <a className='underline cursor' href="https://doi.org/10.1016/j.cels.2017.11.001" target='_blank'>https://doi.org/10.1016/j.cels.2017.11.001</a></p></li>
            <li>Alternative LINCS L1000 data portals and search engines:</li>
            a. SigCom LINCS <a href='https://maayanlab.cloud/sigcom-lincs' target="_blank" className='underline cursor'>https://maayanlab.cloud/sigcom-lincs</a> publication:<br></br>
            <p className='text-sm ml-4'>Evangelista, J. E., et al. (2022). SigCom LINCS: data and metadata search engine for a million gene expression signatures. Nucleic acids research, 50(W1), W697–W709.
            <a className="underline cursor" href="https://doi.org/10.1093/nar/gkac3287" target="_blank"> https://doi.org/10.1093/nar/gkac3287.</a></p>
            b. iLINCS <a href='https://www.ilincs.org/' target="_blank" className='underline cursor'>https://www.ilincs.org/</a> publication:<br></br>
            <p className='text-sm  ml-4'>Pilarczyk, M., et al. (2022). Connecting omics signatures and revealing biological mechanisms with iLINCS. Nature communications, 13(1), 4678. <a href='https://doi.org/10.1038/s41467-022-32205-3' target="_blank" className="underline cursor">https://doi.org/10.1038/s41467-022-32205-3</a></p>
            c. LINCS Data Portal <a href='https://lincsportal.ccs.miami.edu/dcic-portal/' target="_blank" className='underline cursor'>https://lincsportal.ccs.miami.edu/dcic-portal/</a> publication:<br></br>
            <p className='text-sm  ml-4'>
            Stathias, V., et al. (2020). LINCS Data Portal 2.0: next generation access point for perturbation-response signatures. Nucleic acids research, 48(D1), D431–D439.
            <a href='https://doi.org/10.1093/nar/gkz1023' target="_blank" className='underline cursor'>https://doi.org/10.1093/nar/gkz1023</a></p>
            d. L1000FWD <a href='https://maayanlab.cloud/l1000fwd/' target="_blank" className='underline cursor'>https://maayanlab.cloud/l1000fwd/</a> publication:<p className='text-sm ml-4'>
            Wang, Z., Lachmann, A., Keenan, A. B., & Ma&apos;ayan, A. (2018). L1000FWD: fireworks visualization of drug-induced transcriptomic signatures. Bioinformatics (Oxford, England), 34(12), 2150–2152.
            <a href=' https://doi.org/10.1093/bioinformatics/bty060' target="_blank" className='underline cursor'> https://doi.org/10.1093/bioinformatics/bty060</a></p>
            e. L1000CDS2 <a href='https://maayanlab.cloud/L1000CDS2' target="_blank" className='underline cursor'>https://maayanlab.cloud/L1000CDS2</a> publication:<br></br>
            <p className='text-sm  ml-4'>Duan, Q., et al. (2016). L1000CDS2: LINCS L1000 characteristic direction signatures search engine. NPJ systems biology and applications, 2, 16015–. <a href='https://doi.org/10.1038/npjsba.2016.15' target="_blank" className='underline cursor'>https://doi.org/10.1038/npjsba.2016.15</a></p>
          </ul>
          <br></br>
        </div>
       
      </div>
      
    </div>
  )
}
