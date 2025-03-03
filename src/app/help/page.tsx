'use client';
import Image from "next/image";
import Link from "next/link";
import { FaCopy } from "react-icons/fa";
import { singleGeneEnrich, upDownGeneSetEnrich, overlap, upDownOverlap, validGenes } from "./examples";

export default function UserManual() {
  return (
    <div className="prose">
      <div className="flex">
        <div className="flex-col mx-auto max-w-5xl">
          <h2 className="title text-2xl font-medium mb-3 mt-3 text-center">
            L2S2 Documentation
          </h2>
          <div className="navbar block text-center">
            <div className="navbar-center">
              <ul className="menu menu-horizontal gap-3 flex text-lg">
                <li>
                  <Link
                    href="/about"
                    className="underline cursor-pointer"
                    shallow
                  >
                    Abstract
                  </Link>
                </li>
                <li>
                  <Link
                    href="#gene-set-search"
                    className="underline cursor-pointer"
                    shallow
                  >
                    Gene Set Search
                  </Link>
                </li>
                <li>
                  <Link
                    href="#metadata-search"
                    className="underline cursor-pointer"
                    shallow
                  >
                    Term Search
                  </Link>
                </li>
                <li>
                  <Link
                    href="#api"
                    className="underline cursor-pointer"
                    shallow
                  >
                    API
                  </Link>
                </li>
              </ul>
            </div>
          </div>
          <br></br>
          <h2 className="title text-xl font-medium mb-3" id="gene-set-search">
            1.1 Gene Set Search
          </h2>
          <p>
          The Gene Set Search page enables users to search the L2S2 database for gene sets that match their query gene set. Similarity to gene sets contained within the L2S2 database with the query gene set is measured with Fisher&apos;s exact test. Any significantly overlapping gene sets are returned to the user along with their accompanying metadata. User query gene sets can be pasted or typed into the input form with each gene on a new line, or the user may upload a file containing genes where the genes are listed with new line, tab, or comma separators:

          </p>
          <Image
            src="/images/gene-set-search-1.png"
            width={600}
            height={500}
            alt={""}
            className="border rounded-lg mx-auto my-4"
          />
          <p>
          Paginated results are returned with the total number of gene sets which the query was compared to and the number of those gene sets which were significantly enriched. Enrichment statistics are provided on the right side of the table. The user may explore the metadata associated with the signatures on each results page, by clicking on the icon next to the compound, gene KO, or on the underlined cell line:
          </p>
          <Image
            src="/images/gene-set-search-2.png"
            width={600}
            height={500}
            alt={""}
            className="border rounded-lg mx-auto my-4"
          />
          <p>
          Other information such as the directionality of the gene set, the number of overlapping genes, and the total number of genes in the enriched gene set are also displayed. Clicking the overlap or gene set size will open a modal box with the corresponding genes as well as buttons to copy the gene set to the clipboard, or to view the enrichment results on RummaGEO, Rummagene, or Enrichr:
          </p>
          <Image
            src="/images/gene-set-search-3.png"
            width={600}
            height={500}
            alt={""}
            className="border rounded-lg mx-auto my-4"
          />
          <p>
          To further filter and refine the results, the user may use the search bar located above the table to search for gene sets containing certain keywords. This allows, for instance, to view enriched results from the MCF7 cell line based upon the same input gene set. The total number of enriched gene sets is updated accordingly:
          </p>
          <Image
            src="/images/gene-set-search-4.png"
            width={600}
            height={500}
            alt={""}
            className="border rounded-lg mx-auto my-4"
          />
          <p>
          Results may also be easily downloaded using the button to the far right of the search feature in a tab delimited format (for downloads of greater than 10,000 results please refer to the downloads page):
          </p>
          <Image
            src="/images/gene-set-search-5.png"
            width={600}
            height={500}
            alt={""}
            className="border rounded-lg mx-auto my-4"
          />

          <p>
          Users may additionally filter results by the direction of the signature, FDA approved drugs, or CRISPR KOs with the buttons above the table:
          </p>
          <Image
            src="/images/gene-set-search-6.png"
            width={600}
            height={500}
            alt={""}
            className="border rounded-lg mx-auto my-4"
          />
           <p>
          To generate consensus results, selecting the consensus button at the top of table will compute significant compounds and CRISPR KOs using the Fisher&apos;s exact test taking into account the number of significant and insignificant signatures corresponding to that perturbation. P-values for the direction of the signature are then generated for each significant consensus perturbation and CRISPR KO using the number of significant up and down, and insignificant up and down terms for that perturbation and is denoted with a red or blue arrow:
          </p>
          <Image
            src="/images/gene-set-search-7.png"
            width={600}
            height={500}
            alt={""}
            className="border rounded-lg mx-auto my-4"
          />
          <h2
            className="title text-xl font-medium mb-3 mt-10"
            id="metadata-search"
          >
            1.2 Term Search
          </h2>
          L2S2 also provides direct metadata search of the L1000 signatures. Paginated results are returned with accompanying metadata of the returned signatures:
          <Image
            src="/images/metadata-search-1.png"
            width={600}
            height={500}
            alt={""}
            className="border rounded-lg mx-auto my-4"
          />
         These results can also be filtered using the search bar at the top right of the table and the results table can be downloaded in a tab-delimited format:

          <Image
            src="/images/metadata-search-2.png"
            width={600}
            height={500}
            alt={""}
            className="border rounded-lg mx-auto my-4"
          />
          <h2 className="title text-xl font-medium mb-3 mt-10" id="api">
            1.4 API
          </h2>
          <p>
            {" "}
            L2S2 provides programmatic access through a GraphQL endpoint.
            Users can learn more about GraphQL queries from their provided{" "}
            <a className="underline cursor-pointer" href="https://graphql.org/learn/" target="_blank">
              documentation
            </a>
            . The L2S2{" "}
            <Link className="underline cursor-pointer" href="/graphiql" target="_blank">
              GraphQL endpoint
            </Link>{" "}
            and associated Postgres database provide users with a wide range of
            available queries and with a user interface to test and develop
            these queries:
          </p>
          <Image
            src="/images/api-1.png"
            width={600}
            height={500}
            alt={""}
            className="border rounded-lg mx-auto my-4"
          />
          <p>
          For example, single gene set enrichment analysis queries can be performed in Python against all L2S2 signatures using the requests library as follows:
          </p>
          <div className="text-gray bg-slate-300 dark:bg-slate-700 text-xs font-mono mt-5 p-5 rounded-lg box-content sm:max-w-xl sm:overflow-scroll md:max-w-xl lg:max-w-3xl xl:max-w-full">
            <button className="float-right" onClick={() => navigator.clipboard.writeText(singleGeneEnrich)}><FaCopy/></button>
            <pre>
              <code>
                {singleGeneEnrich}
              </code>
            </pre>
          </div>
          <br />
          <p>
          Additionally, up- and down-gene set enrichment analysis queries can be performed in Python against all L2S2 signatures using the requests library as follows:
          </p>
          <div className="text-gray bg-slate-300 dark:bg-slate-700 text-xs font-mono mt-5 p-5 rounded-lg box-content sm:max-w-xl sm:overflow-scroll md:max-w-xl lg:max-w-3xl xl:max-w-full">
            <button className="float-right" onClick={() => navigator.clipboard.writeText(upDownGeneSetEnrich)}><FaCopy/></button>
            <pre>
              <code>
                {upDownGeneSetEnrich}
              </code>
            </pre>
          </div>
          <br />
          <p>
          Overlapping genes can be retrieved from either the single or up- and down-gene set search results using the L2S2 gene set ids provided in the returned enrichment tables:
          </p>
          <div className="text-gray bg-slate-300 dark:bg-slate-700 text-xs font-mono mt-5 p-5 rounded-lg box-content sm:max-w-xl sm:overflow-scroll md:max-w-xl lg:max-w-3xl xl:max-w-full">
            <button className="float-right" onClick={() => navigator.clipboard.writeText(overlap)}><FaCopy/></button>
            <pre>
              <code>
                {overlap}
              </code>
            </pre>
          </div>
          <div className="text-gray bg-slate-300 dark:bg-slate-700 text-xs font-mono mt-5 p-5 rounded-lg box-content sm:max-w-xl sm:overflow-scroll md:max-w-xl lg:max-w-3xl xl:max-w-full">
            <button className="float-right" onClick={() => navigator.clipboard.writeText(upDownOverlap)}><FaCopy/></button>
            <pre>
              <code>
                {upDownOverlap}
              </code>
            </pre>
          </div>
          <br />
          <p>
          Due to the nature of the L1000 assay, the L2S2 background includes 11,335 protein-coding genes. To find the overlap of a user gene set and the L2S2 background, the following query can be used to retrieve the overlap and converted symbols:
          </p>
          <div className="text-gray bg-slate-300 dark:bg-slate-700 text-xs font-mono mt-5 p-5 rounded-lg box-content sm:max-w-xl sm:overflow-scroll md:max-w-xl lg:max-w-3xl xl:max-w-full">
            <button className="float-right" onClick={() => navigator.clipboard.writeText(validGenes)}><FaCopy/></button>
            <pre>
              <code>
                {validGenes}
              </code>
            </pre>
          </div>
          <br />
          <p className="text-white">
            L2S2 is actively being developed by{" "}
            <Link
              className="underline cursor"
              href="https://labs.icahn.mssm.edu/maayanlab/"
              target="_blank"
            >
              the Ma&apos;ayan Lab
            </Link>
            .
          </p>
        </div>
      </div>
    </div>
  );
}
