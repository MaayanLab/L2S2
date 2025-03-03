import React from "react";
import EnrichrButton from "./enrichrButton";
import { useAddUserGeneSetMutation } from "@/graphql";
import { useRouter } from "next/navigation";
import classNames from "classnames";
import blobTsv from "@/utils/blobTsv";
import clientDownloadBlob from "@/utils/clientDownloadBlob";
import RummageneButton from "./rummageneButton";
import RummageoButton from "./rummageoButton";

function ExpandableText({ text }: { text: string }) {
  const [more, setMore] = React.useState(false);
  const startText = React.useMemo(() => text.split(". ")[0], [text]);
  if (!text) return null;
  return (
    <>
      {more ? text : startText}
      &nbsp;
      {more ? (
        <button className="text-blue-500" onClick={() => setMore(() => false)}>
          Show Less
        </button>
      ) : (
        <button className="text-blue-500" onClick={() => setMore(() => true)}>
          Show More
        </button>
      )}
    </>
  );
}

export default function GeneSetModal({
  geneset,
  geneset2,
  term,
  showModal,
  setShowModal,
}: {
  geneset?:
    | (
        | {
            gene?: string | null;
            symbol?: string | null;
            ncbi_gene_id?: number | null;
            description?: string | null;
            summary?: string | null;
          }
        | null
        | undefined
      )[]
    | undefined;
  geneset2?:
    | (
        | {
            gene?: string | null;
            symbol?: string | null;
            ncbi_gene_id?: number | null;
            description?: string | null;
            summary?: string | null;
          }
        | null
        | undefined
      )[]
    | undefined;
  term: string | null | undefined;
  showModal?: boolean;
  setShowModal: (show: boolean) => void;
}) {
  const ref = React.useRef<HTMLDialogElement>(null);
  const router = useRouter();
  const [addUserGeneSetMutation, { loading, error }] =
    useAddUserGeneSetMutation();

  console.log(geneset)
  const genes = React.useMemo(
    () =>
      geneset
        ?.filter(
          (
            gene
          ): gene is Exclude<typeof gene, null | undefined> & {
            symbol: string;
          } => !!gene?.gene
        )
        .map(({ gene }) => gene)
        .filter((gene): gene is string | null => gene !== undefined),
    [geneset]
  );
  const genesDown = React.useMemo(
    () =>
      geneset2
        ?.filter(
          (
            gene
          ): gene is Exclude<typeof gene, null | undefined> & {
            symbol: string;
          } => !!gene?.gene
        )
        .map(({ gene }) => gene)
        .filter((gene): gene is string | null => gene !== undefined),
    [geneset2]
  );
  React.useEffect(() => {
    if (!ref.current) return;
    ref.current.addEventListener("close", () => setShowModal(false));
  }, [ref, setShowModal]);
  React.useEffect(() => {
    if (!ref.current) return;
    if (showModal) ref.current.showModal();
  }, [ref, showModal]);

  
  return (
    <>
      <dialog className="modal" ref={ref}>
        <div className="modal-box w-11/12 max-w-screen-xl h-5/6 overflow-hidden flex flex-col p-0">
          <p className="text-md text-center text-gray-900 dark:text-white flex-shrink-0 py-2">
            Gene Set ({geneset ? geneset?.length : "n"})
          </p>
          <p className="text-md text-center text-gray-600 dark:text-white">
            {term}
          </p>
          <div
            className={classNames(
              "p-2 text-slate-500 text-sm leading-relaxed whitespace-pre-line overflow-hidden flex flex-grow flex-shrink"
            )}
          >
            <div className="flex flex-col">
            {geneset ? (
              <div className="overflow-x-auto block">
                <table className="table table-xs table-pin-rows table-pin-cols">
                  <thead className="bg-white dark:bg-slate-800 sticky top-0">
                    <th>{geneset2 ? "Up Genes" : <></>}</th>
                    <th>Symbol</th>
                    <th>Description</th>
                    <th>Summary</th>
                  </thead>
                  <tbody className="overflow-y-auto">
                    {geneset
                      .map((gene) => (
                        <tr key={gene?.symbol ?? gene?.gene}>
                          <td>{gene?.gene}</td>
                          <td className="font-bold">{gene?.symbol ?? gene?.gene}</td>
                          <td>{gene?.description ?? "Gene not contained in L2S2 background"} </td>
                          <td>
                            <ExpandableText text={gene?.summary ?? ""} />
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="w-full flex justify-center">
                <span className="loading loading-ring w-24"></span>
              </div>
            )}
            <div className="flex items-center justify-end border-t border-solid border-slate-200 flex-shrink-0 gap-2 p-3">
              <button
                className="btn btn-sm btn-outline text-xs"
                type="button"
                onClick={(evt) => {
                  if (!geneset) return;
                  const blob = blobTsv(
                    ["symbol", "description", "summary"],
                    geneset,
                    (item) => ({
                      symbol: item?.symbol,
                      description: item?.description,
                      summary: item?.summary,
                    })
                  );
                  clientDownloadBlob(blob, `${term ? term : "gene_set"}.tsv`);
                }}
              >
                Download Table
              </button>
              <button
                className="btn btn-sm btn-outline text-xs transition-colors duration-500"
                type="button"
                onClick={(evt) => {
                  const currentRef = evt.currentTarget;
                  const currentColor = currentRef.style.backgroundColor;
                  currentRef.style.backgroundColor = "green";
                  setTimeout(() => {
                    currentRef.style.backgroundColor = currentColor;
                  }, 500);
                  navigator.clipboard.writeText(genes?.join("\n") || "");
                }}
              >
                Copy Symbols to Clipboard
              </button>
              <EnrichrButton genes={genes} description={term}></EnrichrButton>
              <RummageoButton genes={genes?.filter((gene): gene is string => gene !== null)} description={term}></RummageoButton>
              <RummageneButton genes={genes?.filter((gene): gene is string => gene !== null)} description={term} ></RummageneButton>
              <span
                className={classNames("loading", "w-6", { hidden: !loading })}
              ></span>
              <div
                className={classNames("alert alert-error", { hidden: !error })}
              >
                {error?.message ?? null}
              </div>
            </div>
          </div>
          </div>

          <div
            className={classNames(
              "p-2 text-slate-500 text-sm leading-relaxed whitespace-pre-line overflow-hidden flex flex-grow flex-shrink"
            )}
          >
            {geneset2 && (
              <div className="overflow-x-auto block">
                <table className="table table-xs table-pin-rows table-pin-cols">
                  <thead className="bg-white dark:bg-slate-800 sticky top-0">
                    <th>Down Genes</th>
                    <th>Symbol</th>
                    <th>Description</th>
                    <th>Summary</th>
                  </thead>
                  <tbody className="overflow-y-auto">
                    {geneset2
                      .filter(
                        (
                          gene
                        ): gene is Exclude<typeof gene, null | undefined> & {
                          symbol: string;
                        } => !!gene?.symbol
                      )
                      .map((gene) => (
                        <tr key={gene.symbol}>
                          <td>{gene.gene}</td>
                          <td className="font-bold">{gene.symbol}</td>
                          <td>{gene.description}</td>
                          <td>
                            <ExpandableText text={gene.summary ?? ""} />
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {geneset2 && <div className="flex items-center justify-end border-t border-solid border-slate-200 flex-shrink-0 gap-2 p-3">
            <button
              className="btn btn-sm btn-outline text-xs"
              type="button"
              onClick={(evt) => {
                if (!geneset2) return;
                const blob = blobTsv(
                  ["symbol", "description", "summary"],
                  geneset2,
                  (item) => ({
                    symbol: item?.symbol,
                    description: item?.description,
                    summary: item?.summary,
                  })
                );
                clientDownloadBlob(blob, `${term ? term : "gene_set"}.tsv`);
              }}
            >
              Download Table
            </button>
            <button
              className="btn btn-sm btn-outline text-xs transition-colors duration-500"
              type="button"
              onClick={(evt) => {
                const currentRef = evt.currentTarget;
                const currentColor = currentRef.style.backgroundColor;
                currentRef.style.backgroundColor = "green";
                setTimeout(() => {
                  currentRef.style.backgroundColor = currentColor;
                }, 500);
                navigator.clipboard.writeText(genesDown?.join("\n") || "");
              }}
            >
              Copy Symbols to Clipboard
            </button>
            <EnrichrButton genes={genesDown} description={term}></EnrichrButton>
            <RummageoButton genes={genesDown?.filter((gene): gene is string => gene !== null)} description={term}></RummageoButton>
            <RummageneButton genes={genesDown?.filter((gene): gene is string => gene !== null)} description={term}></RummageneButton>
            <span
              className={classNames("loading", "w-6", { hidden: !loading })}
            ></span>
            <div
              className={classNames("alert alert-error", { hidden: !error })}
            >
              {error?.message ?? null}
            </div>
          </div>}
        </div>
        <form method="dialog" className="modal-backdrop">
          <button>close</button>
        </form>
      </dialog>
    </>
  );
}
