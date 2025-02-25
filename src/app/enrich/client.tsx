"use client";
import React from "react";
import {
  FetchUserGeneSetQuery,
  useEnrichmentQueryQuery,
  useFetchGeneInfoQuery,
  useFetchUserGeneSetQuery,
  useOverlapQueryQuery,
  useViewGeneSetQuery,
} from "@/graphql";
import ensureArray from "@/utils/ensureArray";
import Loading from "@/components/loading";
import Pagination from "@/components/pagination";
import DownloadButton from "@/components/downloadButton";
import useQsState from "@/utils/useQsState";
import Stats from "../stats";
import Image from "next/image";
import GeneSetModal from "@/components/geneSetModal";
import { FaFilter, FaSortUp } from "react-icons/fa6";
import { IoMdInformationCircleOutline } from "react-icons/io";

const pageSize = 12;

type GeneSetModalT =
  | {
      type: "UserGeneSet";
      description: string;
      genes: string[];
    }
  | {
      type: "GeneSetOverlap";
      id: string;
      description: string;
      genes: string[];
    }
  | {
      type: "GeneSet";
      id: string;
      description: string;
    }
  | undefined;

function EnrichmentResults({
  userGeneSet,
  setModalGeneSet,
}: {
  userGeneSet?: FetchUserGeneSetQuery;
  setModalGeneSet: React.Dispatch<React.SetStateAction<GeneSetModalT>>;
}) {
  const genes = React.useMemo(
    () =>
      ensureArray(userGeneSet?.userGeneSet?.genes)
        .filter((gene): gene is string => !!gene)
        .map((gene) => gene.toUpperCase()),
    [userGeneSet]
  );
  const [queryString, setQueryString] = useQsState({
    page: "1",
    q: "",
    dir: "",
    fda: "false",
    consensus: "false",
    sort: "pvalue",
    ko: "false",
    topn: "1000",
    pvaluele: "0.05",
  });
  const [rawTerm, setRawTerm] = React.useState("");
  const [topNSlider, setTopNSlider] = React.useState(1000);
  const [pvalueLeSlider, setPvalueLeSlider] = React.useState(0.05);

  const { page, term, fda, consensus, sort, ko, topN, pvalueLe } =
    React.useMemo(
      () => ({
        page: queryString.page ? +queryString.page : 1,
        term: queryString.q ?? "",
        fda: queryString.fda === "true",
        consensus: queryString.consensus === "true",
        sort: queryString.sort,
        ko: queryString.ko === "true",
        topN: parseInt(queryString?.topn ?? "1000"),
        pvalueLe: parseFloat(queryString?.pvaluele ?? "0.05"),
      }),
      [queryString]
    );
  const { data: enrichmentResults } = useEnrichmentQueryQuery({
    skip: genes.length === 0,
    variables: {
      genes,
      filterTerm: term + " " + queryString.dir,
      offset: (page - 1) * pageSize,
      first: pageSize,
      filterFda: fda,
      sortBy: sort,
      filterKo: ko,
      topN: topN,
      pvalueLe: pvalueLe,
    },
  });

  React.useEffect(() => {
    console.log(term);
    setRawTerm(term);
  }, [term]);

  return (
    <div className="flex flex-col gap-2 my-2">
      <h2 className="text-md font-bold">
        {!enrichmentResults?.currentBackground?.enrich ? (
          <>
            Rummaging through <Stats show_gene_sets />.
          </>
        ) : (
          <>
            {consensus ? (
              <>
                After rummaging through <Stats show_gene_sets />.{" "}
                <Image
                  className="inline-block rounded"
                  src="/images/LINCSearch_logo.png"
                  width={50}
                  height={100}
                  alt="LINCSearch"
                ></Image>{" "}
                computed significance for{" "}
                {Intl.NumberFormat("en-US", {}).format(
                  enrichmentResults?.currentBackground?.enrich
                    ?.consensusCount || 0
                )}{" "}
                consensus perturbations.
              </>
            ) : (
              <>
                After rummaging through <Stats show_gene_sets />.{" "}
                <Image
                  className="inline-block rounded"
                  src="/images/LINCSearch_logo.png"
                  width={50}
                  height={100}
                  alt="LINCSearch"
                ></Image>{" "}
                found{" "}
                {Intl.NumberFormat("en-US", {}).format(
                  enrichmentResults?.currentBackground?.enrich?.totalCount || 0
                )}{" "}
                statistically significant matches.
              </>
            )}
          </>
        )}
      </h2>
      <div className="flex-row">
        <button
          onClick={() => {
            if (queryString.fda === "false")
              setQueryString({
                page: "1",
                q: rawTerm,
                fda: "true",
                consensus: queryString.consensus,
                dir: queryString.dir,
                ko: "false",
                sort: queryString.sort,
                topn: queryString.topn,
                pvaluele: queryString.pvaluele,
              });
            else
              setQueryString({
                page: "1",
                q: rawTerm,
                fda: "false",
                dir: queryString.dir,
                consensus: queryString.consensus,
                ko: queryString.ko,
                sort: queryString.sort,
                topn: queryString.topn,
                pvaluele: queryString.pvaluele,
              });
          }}
          className={
            queryString.fda === "true"
              ? "button btn btn-sm float-left mx-4 bg-purple-400 hover:bg-purple-600"
              : "button btn btn-sm float-left mx-4"
          }
        >
          Approved
        </button>

        <button
          onClick={() => {
            if (queryString.consensus === "false")
              setQueryString({
                page: "1",
                q: rawTerm,
                fda: queryString.fda,
                consensus: "true",
                dir: queryString.dir,
                sort: queryString.sort,
                ko: queryString.ko,
                topn: queryString.topn,
                pvaluele: queryString.pvaluele,
              });
            else
              setQueryString({
                page: "1",
                q: rawTerm,
                fda: queryString.fda,
                consensus: "false",
                dir: queryString.dir,
                sort: queryString.sort,
                ko: queryString.ko,
                topn: queryString.topn,
                pvaluele: queryString.pvaluele,
              });
          }}
          className={
            queryString.consensus === "true"
              ? "button btn btn-sm float-left mr-4 bg-purple-400 hover:bg-purple-600"
              : "button btn btn-sm float-left mr-4"
          }
        >
          Consensus
        </button>

        <button
          onClick={() => {
            if (queryString.ko === "false")
              setQueryString({
                page: "1",
                q: rawTerm,
                fda: "false",
                consensus: queryString.consensus,
                dir: queryString.dir,
                ko: "true",
                sort: queryString.sort,
                topn: queryString.topn,
                pvaluele: queryString.pvaluele,
              });
            else
              setQueryString({
                page: "1",
                q: rawTerm,
                fda: queryString.fda,
                consensus: queryString.consensus,
                dir: queryString.dir,
                ko: "false",
                sort: queryString.sort,
                topn: queryString.topn,
                pvaluele: queryString.pvaluele,
              });
          }}
          className={
            queryString.ko === "true"
              ? "button btn btn-sm float-left mr-4 bg-purple-400 hover:bg-purple-600"
              : "button btn btn-sm float-left mr-4"
          }
        >
          CRISPR KOs
        </button>

        <div
          id="dir-select"
          className="join place-content-start place-items-center"
        >
          <div
            className={
              queryString.dir == "up"
                ? "join-item px-3 py-1.5 text-sm bg-purple-400 hover:bg-purple-600 font-bold cursor-pointer"
                : "join-item px-3 py-1.5  bg-gray-100 cursor-pointer font-bold text-sm dark:bg-gray-900"
            }
            onClick={(evt) => {
              evt.preventDefault();
              if (queryString.dir === "up")
                setQueryString({
                  page: "1",
                  q: rawTerm,
                  dir: "",
                  fda: queryString.fda,
                  consensus: queryString.consensus,
                  sort: queryString.sort,
                  ko: queryString.ko,
                  topn: queryString.topn,
                  pvaluele: queryString.pvaluele,
                });
              else
                setQueryString({
                  page: "1",
                  q: rawTerm,
                  dir: "up",
                  fda: queryString.fda,
                  consensus: queryString.consensus,
                  sort: queryString.sort,
                  ko: queryString.ko,
                  topn: queryString.topn,
                  pvaluele: queryString.pvaluele,
                });
            }}
          >
            UP
          </div>
          <div
            className={
              queryString.dir == "down"
                ? "join-item px-3 py-1.5 text-sm bg-purple-400 hover:bg-purple-600 font-bold cursor-pointer"
                : "join-item px-3 py-1.5 bg-gray-100 cursor-pointer font-bold text-sm dark:bg-gray-900"
            }
            onClick={(evt) => {
              evt.preventDefault();
              if (queryString.dir === "down")
                setQueryString({
                  page: "1",
                  q: rawTerm,
                  dir: "",
                  fda: queryString.fda,
                  consensus: queryString.consensus,
                  sort: queryString.sort,
                  ko: queryString.ko,
                  topn: queryString.topn,
                  pvaluele: queryString.pvaluele,
                });
              else
                setQueryString({
                  page: "1",
                  q: rawTerm,
                  dir: "down",
                  fda: queryString.fda,
                  consensus: queryString.consensus,
                  sort: queryString.sort,
                  ko: queryString.ko,
                  topn: queryString.topn,
                  pvaluele: queryString.pvaluele,
                });
            }}
          >
            DOWN
          </div>
        </div>
        {consensus ? <div className="inline-flex items-center ml-5 transition-all accent-purple-500">
          <label
            className="text-sm font-bold mr-3 tooltip inline-flex"
            htmlFor="default-range"
            data-tip="Significant signatures to use when computing consensus scores (ranked by p-value)"
          >
            Top N Significant Sigs{" "}
            <IoMdInformationCircleOutline className="ml-0.5" />
          </label>
          <div className="tooltip" data-tip={topNSlider.toString()}>
            <input
              id="default-range"
              type="range"
              value={topNSlider}
              onChange={(evt) => setTopNSlider(Number(evt.target.value))}
              max={20000}
              min={500}
              step={500}
              className="w-52 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"
            ></input>
          </div>

          <div className="tooltip ml-2" data-tip="Apply Threshold">
            <button
              className="btn btn-sm bg-transparent p-2"
              onClick={() => {
                setQueryString({
                  page: "1",
                  q: rawTerm,
                  dir: queryString.dir,
                  fda: queryString.fda,
                  consensus: queryString.consensus,
                  sort: queryString.sort,
                  ko: queryString.ko,
                  topn: topNSlider.toString(),
                  pvaluele: queryString.pvaluele,
                });
              }}
            >
              <FaFilter />
            </button>
          </div>
        </div> : 
        <></>}

        <form
          id="search-form"
          className="join flex flex-row place-content-end place-items-center overflow-visible mt-5"
          onSubmit={(evt) => {
            evt.preventDefault();
            setQueryString({
              page: "1",
              q: rawTerm,
              fda: queryString.fda,
              consensus: queryString.consensus,
              dir: queryString.dir,
              ko: queryString.ko,
              sort: queryString.sort,
              topn: queryString.topn,
              pvaluele: queryString.pvaluele,
            });
          }}
        >
          <input
            type="text"
            className="input input-bordered join-item"
            value={rawTerm}
            onChange={(evt) => {
              setRawTerm(evt.currentTarget.value);
            }}
          />
          <div className="tooltip" data-tip="Search results">
            <button type="submit" className="btn join-item">
              &#x1F50D;
            </button>
          </div>
          <div className="tooltip" data-tip="Clear search">
            <button
              type="reset"
              className="btn join-item"
              onClick={(evt) => {
                setQueryString({
                  page: "1",
                  q: "",
                  fda: queryString.fda,
                  consensus: queryString.consensus,
                  dir: queryString.dir,
                  ko: queryString.ko,
                  sort: queryString.sort,
                  topn: queryString.topn,
                  pvaluele: queryString.pvaluele,
                });
              }}
            >
              &#x232B;
            </button>
          </div>
          <DownloadButton queryString={queryString}></DownloadButton>
        </form>
      </div>
      <div className="overflow-x-scroll">
        {consensus ? (
          <>
            <table className="table table-xs">
              <thead>
                <tr className="text-left align-text-bottom">
                  <th>Perturbation</th>
                  <th className="relative group">
                    <div className="absolute z-10 left-0 top-10 mb-2 hidden w-max bg-gray-700 text-white text-xs rounded p-1 group-hover:block">
                      Reflecting if there are more significant up or down
                      signatures
                    </div>
                    <span className="inline-flex">
                      Direction
                      <IoMdInformationCircleOutline className="ml-0.5" />
                    </span>
                  </th>
                  <th>
                    Sig
                    <br />
                    Signatures
                  </th>
                  <th>
                    Insig
                    <br />
                    Signatures
                  </th>
                  <th className="relative group">
                    <div className="absolute z-10 left-0 top-10 mb-2 hidden w-max bg-gray-700 text-white text-xs rounded p-1 group-hover:block">
                      A Fisher&apos;s exact test comparing the number of
                      significant up signatures, and the number of significant
                      down signatures,
                      <br /> the number of insignificant up signatures, and the
                      number of insignificant down signatures
                    </div>
                    <span
                      className="flex align-text-top cursor-pointer"
                      onClick={() =>
                        setQueryString({
                          page: "1",
                          q: rawTerm,
                          fda: queryString.fda,
                          dir: queryString.dir,
                          sort: "pvalue_up",
                          ko: queryString.ko,
                          topn: queryString.topn,
                          pvaluele: queryString.pvaluele,
                        })
                      }
                    >
                      PValue
                      <br />
                      Up <FaSortUp />
                      <IoMdInformationCircleOutline className="ml-0.5" />
                    </span>
                  </th>
                  <th className="relative group">
                    <div className="absolute z-10 left-0 top-10 mb-2 hidden w-max bg-gray-700 text-white text-xs rounded p-1 group-hover:block">
                      Up p-values adjusted using the Benjamini-Hochberg method
                    </div>
                    AdjPValue
                    <br />
                    <span className="inline-flex">
                      Up
                      <IoMdInformationCircleOutline className="ml-0.5" />
                    </span>
                  </th>
                  <th>
                    <span
                      className="flex align-text-top cursor-pointer"
                      onClick={() =>
                        setQueryString({
                          page: "1",
                          q: rawTerm,
                          fda: queryString.fda,
                          dir: queryString.dir,
                          sort: "odds_ratio_up",
                          ko: queryString.ko,
                          topn: queryString.topn,
                          pvaluele: queryString.pvaluele,
                        })
                      }
                    >
                      Odds
                      <br />
                      Ratio
                      <br />
                      Up <FaSortUp />
                    </span>
                  </th>
                  <th className="relative group">
                    <div className="absolute z-10 right-0 top-10 mb-2 hidden w-max bg-gray-700 text-white text-xs rounded p-1 group-hover:block">
                      A Fisher&apos;s exact test comparing the number of
                      significant down signatures, and the number of significant
                      up signatures,
                      <br /> the number of insignificant down signatures, and
                      the number of insignificant up signatures
                    </div>
                    <span
                      className="flex align-text-top cursor-pointer"
                      onClick={() =>
                        setQueryString({
                          page: "1",
                          q: rawTerm,
                          fda: queryString.fda,
                          dir: queryString.dir,
                          sort: "pvalue_down",
                          ko: queryString.ko,
                          topn: queryString.topn,
                          pvaluele: queryString.pvaluele,
                        })
                      }
                    >
                      PValue
                      <br />
                      Down <FaSortUp />
                      <IoMdInformationCircleOutline className="ml-0.5" />
                    </span>
                  </th>
                  <th className="relative group">
                    <div className="absolute z-10 left-0 top-10 mb-2 hidden w-max bg-gray-700 text-white text-xs rounded p-1 group-hover:block">
                      Down p-values adjusted using the Benjamini-Hochberg method
                    </div>
                    AdjPValue
                    <br />
                    <span className="inline-flex">
                      Down
                      <IoMdInformationCircleOutline className="ml-0.5" />
                    </span>
                  </th>
                  <th>
                    <span
                      className="flex align-text-top cursor-pointer"
                      onClick={() =>
                        setQueryString({
                          page: "1",
                          q: rawTerm,
                          fda: queryString.fda,
                          dir: queryString.dir,
                          sort: "odds_ratio_down",
                          ko: queryString.ko,
                          topn: queryString.topn,
                          pvaluele: queryString.pvaluele,
                        })
                      }
                    >
                      Odds
                      <br />
                      Ratio
                      <br />
                      Down <FaSortUp />
                    </span>
                  </th>
                  <th>
                    FDA
                    <br />
                    Approved
                  </th>
                  <th>
                    <span
                      className="flex align-text-top cursor-pointer"
                      onClick={() =>
                        setQueryString({
                          page: "1",
                          q: rawTerm,
                          fda: queryString.fda,
                          dir: queryString.dir,
                          sort: "odds_ratio",
                          ko: queryString.ko,
                          topn: queryString.topn,
                          pvaluele: queryString.pvaluele,
                        })
                      }
                    >
                      Odds
                      <br />
                      Ratio <FaSortUp />
                    </span>
                  </th>
                  <th className="relative group hidden">
                    <div className="absolute z-10 right-0 top-10 mb-2 hidden w-max bg-gray-700 text-white text-xs rounded p-1 group-hover:block">
                      A Fisher&apos;s exact test comparing the number of
                      significant signatures and insignificant signatures for
                      the given perturbation,
                      <br /> as well as the total number of significant and
                      insignificant signatures
                    </div>
                    <span
                      className="flex align-text-top cursor-pointer"
                      onClick={() =>
                        setQueryString({
                          page: "1",
                          q: rawTerm,
                          fda: queryString.fda,
                          dir: queryString.dir,
                          sort: "pvalue",
                          ko: queryString.ko,
                          topn: queryString.topn,
                          pvaluele: queryString.pvaluele,
                        })
                      }
                    >
                      PValue <FaSortUp />
                      <IoMdInformationCircleOutline className="ml-0.5" />
                    </span>
                  </th>
                  <th className="relative group hidden">
                    <div className="absolute z-10 right-0 top-10 mb-2 hidden w-max bg-gray-700 text-white text-xs rounded p-1 group-hover:block">
                      P-values adjusted using the Benjamini-Hochberg method
                    </div>
                    <span className="inline-flex">
                      AdjPValue
                      <IoMdInformationCircleOutline className="ml-0.5" />
                    </span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {!enrichmentResults?.currentBackground?.enrich ? (
                  <tr>
                    <td colSpan={7}>
                      <Loading />
                    </td>
                  </tr>
                ) : null}
                {enrichmentResults?.currentBackground?.enrich?.consensus?.flatMap(
                  (enrichmentResult, genesetIndex) => {
                    var perturbation = enrichmentResult?.drug;
                    if (perturbation?.includes(" "))
                      perturbation = perturbation + " KO";
                    return (
                      <tr key={genesetIndex}>
                        <td>
                          {!perturbation?.includes("KO") ? (
                            <>
                              {perturbation}
                              <a
                                className="underline cursor-pointer mx-2"
                                href={`https://pubchem.ncbi.nlm.nih.gov/#query=${perturbation}`}
                                target="_blank"
                              >
                                <Image
                                  className="inline-block rounded"
                                  src="/images/drug_vector_art.png"
                                  width={20}
                                  height={20}
                                  alt="PubChem"
                                />
                              </a>
                            </>
                          ) : (
                            <>
                              {perturbation}
                              <a
                                className="underline cursor-pointer mx-2"
                                href={`https://maayanlab.cloud/Harmonizome/gene/${perturbation.replace(
                                  " KO",
                                  ""
                                )}`}
                                target="_blank"
                              >
                                <Image
                                  className="inline-block rounded"
                                  src="/images/harmonizome_logo_30x26.png"
                                  width={20}
                                  height={20}
                                  alt="Harmonizome"
                                />
                              </a>
                              <a
                                className="underline cursor-pointer"
                                href={`https://maayanlab.cloud/prismexp/g/${perturbation.replace(
                                  " KO",
                                  ""
                                )}`}
                                target="_blank"
                              >
                                <Image
                                  className="inline-block rounded"
                                  src="/images/prismexp.png"
                                  width={20}
                                  height={20}
                                  alt="PrismEXP"
                                />
                              </a>
                            </>
                          )}
                        </td>
                        <td>
                          {(enrichmentResult?.pvalueUp || 0) <
                          (enrichmentResult?.pvalueDown || 0) ? (
                            <Image
                              className="inline-block rounded"
                              src="/images/up.png"
                              width={15}
                              height={15}
                              alt="Up"
                            />
                          ) : (enrichmentResult?.pvalueUp || 0) >
                            (enrichmentResult?.pvalueDown || 0) ? (
                            <Image
                              className="inline-block rounded"
                              src="/images/down.png"
                              width={15}
                              height={15}
                              alt="Down"
                            />
                          ) : (
                            <Image
                              className="inline-block rounded"
                              src="/images/minus.png"
                              width={15}
                              height={15}
                              alt="Equal"
                            />
                          )}
                        </td>
                        <td>
                          {enrichmentResult?.countSignificant} (
                          {enrichmentResult?.countUpSignificant} Up,{" "}
                          {(enrichmentResult?.countSignificant || 0) -
                            (enrichmentResult?.countUpSignificant || 0)}{" "}
                          Down)
                        </td>
                        <td>{enrichmentResult?.countInsignificant}</td>
                        <td>{enrichmentResult?.pvalueUp?.toPrecision(3)}</td>
                        <td>{enrichmentResult?.adjPvalueUp?.toPrecision(3)}</td>
                        <td>{enrichmentResult?.oddsRatioUp?.toPrecision(3)}</td>
                        <td>{enrichmentResult?.pvalueDown?.toPrecision(3)}</td>
                        <td>
                          {enrichmentResult?.adjPvalueDown?.toPrecision(3)}
                        </td>
                        <td>
                          {enrichmentResult?.oddsRatioDown?.toPrecision(3)}
                        </td>
                        <td>{enrichmentResult?.approved ? "Yes" : "No"}</td>
                        <td>{enrichmentResult?.oddsRatio?.toPrecision(3)}</td>
                        <td className="hidden">
                          {enrichmentResult?.pvalue?.toPrecision(3)}
                        </td>
                        <td className="hidden">
                          {enrichmentResult?.adjPvalue?.toPrecision(3)}
                        </td>
                      </tr>
                    );
                  }
                )}
              </tbody>
            </table>
          </>
        ) : (
          <table className="table table-xs">
            <thead>
              <tr className="text-left align-text-bottom overflow-visible">
                <th className={"hidden"}>Term</th>
                <th className="relative group">
                  <div className="absolute z-10 left-0 top-10 mb-2 hidden w-max bg-gray-700 text-white text-xs rounded p-1 group-hover:block">
                    Preclinical compound, drug, or gene targeted by CRISPR KO
                  </div>
                  <span className="inline-flex">
                    Perturbation
                    <IoMdInformationCircleOutline className="ml-0.5" />
                  </span>
                </th>
                <th>Cell Line</th>
                <th>
                  Time
                  <br />
                  point
                </th>
                <th>Concentration</th>
                <th>Direction</th>
                <th className="relative group">
                  <div className="absolute z-10 left-0 top-10 mb-2 hidden w-max bg-gray-700 text-white text-xs rounded p-1 group-hover:block">
                    Number of signatures for this perturbation contained within
                    the database
                  </div>
                  Signature<br></br>
                  <span className="inline-flex">
                    Count
                    <IoMdInformationCircleOutline className="ml-0.5" />
                  </span>
                </th>
                <th>
                  FDA
                  <br />
                  Approved
                </th>
                <th>
                  Gene
                  <br />
                  Set
                  <br />
                  Size
                </th>
                <th>
                  <span
                    className="flex align-text-top cursor-pointer"
                    onClick={() =>
                      setQueryString({
                        page: "1",
                        q: rawTerm,
                        fda: queryString.fda,
                        dir: queryString.dir,
                        sort: "overlap",
                        ko: queryString.ko,
                        topn: queryString.topn,
                        pvaluele: queryString.pvaluele,
                        consensus: queryString.consensus,
                      })
                    }
                  >
                    Overlap <FaSortUp />
                  </span>
                </th>
                <th>
                  <span
                    className="flex align-text-top cursor-pointer"
                    onClick={() =>
                      setQueryString({
                        page: "1",
                        q: rawTerm,
                        fda: queryString.fda,
                        dir: queryString.dir,
                        sort: "odds_ratio",
                        ko: queryString.ko,
                        topn: queryString.topn,
                        pvaluele: queryString.pvaluele,
                        consensus: queryString.consensus,
                      })
                    }
                  >
                    Odds
                    <br />
                    Ratio <FaSortUp />
                  </span>
                </th>
                <th className="relative group">
                  <div className="absolute z-10 right-0 top-10 mb-2 hidden w-max bg-gray-700 text-white text-xs rounded p-1 group-hover:block">
                    P-value computed using the Fisher&apos;s Exact Test
                  </div>
                  <span
                    className="flex align-text-top cursor-pointer"
                    onClick={() =>
                      setQueryString({
                        page: "1",
                        q: rawTerm,
                        fda: queryString.fda,
                        dir: queryString.dir,
                        sort: "pvalue",
                        ko: queryString.ko,
                        topn: queryString.topn,
                        pvaluele: queryString.pvaluele,
                        consensus: queryString.consensus,
                      })
                    }
                  >
                    PValue <FaSortUp />
                    <IoMdInformationCircleOutline className="ml-0.5" />
                  </span>
                </th>
                <th className="relative group">
                  <div className="absolute z-10 right-0 top-10 mb-2 hidden w-max bg-gray-700 text-white text-xs rounded p-1 group-hover:block">
                    Adjusted P-value computed using the Benjamini-Hochberg
                    procedure
                  </div>
                  <span className="inline-flex">
                    AdjPValue
                    <IoMdInformationCircleOutline className="ml-0.5" />
                  </span>
                </th>
              </tr>
            </thead>
            <tbody>
              {!enrichmentResults?.currentBackground?.enrich ? (
                <tr>
                  <td colSpan={7}>
                    <Loading />
                  </td>
                </tr>
              ) : null}
              {enrichmentResults?.currentBackground?.enrich?.nodes?.flatMap(
                (enrichmentResult, genesetIndex) => {
                  const term = enrichmentResult?.geneSets.nodes[0].term;
                  const batch =
                    enrichmentResult?.geneSets.nodes[0].term.split("_")[0];
                  const cellLine =
                    enrichmentResult?.geneSets.nodes[0].term.split("_")[1];
                  const timepoint =
                    enrichmentResult?.geneSets.nodes[0].term.split("_")[2];
                  const batch2 =
                    enrichmentResult?.geneSets.nodes[0].term.split("_")[3];
                  var perturbation =
                    enrichmentResult?.geneSets.nodes[0].term.split("_")[4];
                  if (perturbation?.split(" ").length == 2)
                    perturbation = perturbation?.split(" ")[0] + " KO";

                  const count =
                    enrichmentResult?.geneSets.nodes[0].geneSetFdaCountsById
                      .nodes[0]?.count || 1;
                  const approved =
                    enrichmentResult?.geneSets.nodes[0].geneSetFdaCountsById
                      .nodes[0]?.approved || false;

                  const concentration =
                    enrichmentResult?.geneSets.nodes[0].term
                      .split("_")[5]
                      ?.split(" ")[0] ?? "N/A";
                  const direction =
                    enrichmentResult?.geneSets.nodes[0].term.split(" ")[1];

                  if (!enrichmentResult?.geneSets) return null;
                  return (
                    <tr key={genesetIndex} className="text-left">
                      <td className={"hidden"}>{term}</td>
                      <td>
                        {!perturbation?.includes("KO") ? (
                          <>
                            {perturbation}
                            <a
                              className="underline cursor-pointer mx-2"
                              href={`https://pubchem.ncbi.nlm.nih.gov/#query=${perturbation}`}
                              target="_blank"
                            >
                              <Image
                                className="inline-block rounded"
                                src="/images/drug_vector_art.png"
                                width={20}
                                height={20}
                                alt="PubChem"
                              />
                            </a>
                          </>
                        ) : (
                          <>
                            {perturbation}
                            <a
                              className="underline cursor-pointer mx-2"
                              href={`https://maayanlab.cloud/Harmonizome/gene/${perturbation.replace(
                                " KO",
                                ""
                              )}`}
                              target="_blank"
                            >
                              <Image
                                className="inline-block rounded"
                                src="/images/harmonizome_logo_30x26.png"
                                width={20}
                                height={20}
                                alt="Harmonizome"
                              />
                            </a>
                            <a
                              className="underline cursor-pointer"
                              href={`https://maayanlab.cloud/prismexp/g/${perturbation.replace(
                                " KO",
                                ""
                              )}`}
                              target="_blank"
                            >
                              <Image
                                className="inline-block rounded"
                                src="/images/prismexp.png"
                                width={20}
                                height={20}
                                alt="PrismEXP"
                              />
                            </a>
                          </>
                        )}
                      </td>
                      <td>
                        <a
                          className="underline cursor-pointer"
                          onClick={async (evt) => {
                            evt.preventDefault();
                            const res = await fetch("enrich/depmapcl", {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({
                                cellLine: cellLine,
                              }),
                            });

                            const resJson = await res.json();
                            const suggestedCellLines = resJson.filter((entry: any) => entry.type == 'cell_line')
                            if (suggestedCellLines.length > 0) {
                              window.open(
                                `https://depmap.org${suggestedCellLines[0].url}`,
                                "_blank"
                              );
                            }
                          }}
                        >
                          {cellLine}
                        </a>
                      </td>
                      <td>{timepoint}</td>
                      <td>{concentration}</td>
                      <td>
                        {direction}
                        {direction == "up" ? (
                          <Image
                            className="inline-block rounded ml-5"
                            src="/images/up.png"
                            width={15}
                            height={15}
                            alt="Up"
                          />
                        ) : (
                          <Image
                            className="inline-block rounded ml-1"
                            src="/images/down.png"
                            width={15}
                            height={15}
                            alt="Down"
                          />
                        )}
                      </td>
                      <td>{count}</td>
                      <td>{approved ? "Yes" : "No"}</td>
                      <td>
                        <label
                          htmlFor="geneSetModal"
                          className="prose underline cursor-pointer"
                          onClick={(evt) => {
                            setModalGeneSet({
                              type: "GeneSet",
                              id: enrichmentResult?.geneSets.nodes[0].id,
                              description: term ?? "",
                            });
                          }}
                        >
                          {enrichmentResult?.geneSets.nodes[0].nGeneIds}
                        </label>
                      </td>
                      <td>
                        <label
                          htmlFor="geneSetModal"
                          className="prose underline cursor-pointer"
                          onClick={(evt) => {
                            setModalGeneSet({
                              type: "GeneSetOverlap",
                              id: enrichmentResult?.geneSets.nodes[0].id,
                              description: `${
                                userGeneSet?.userGeneSet?.description ||
                                "User gene set"
                              } & ${term || "L2S2 gene set"}`,
                              genes,
                            });
                          }}
                        >
                          {enrichmentResult?.nOverlap}
                        </label>
                      </td>
                      <td>{enrichmentResult?.oddsRatio?.toPrecision(3)}</td>
                      <td>{enrichmentResult?.pvalue?.toPrecision(3)}</td>
                      <td>{enrichmentResult?.adjPvalue?.toPrecision(3)}</td>
                    </tr>
                  );
                }
              )}
            </tbody>
          </table>
        )}
      </div>
      {enrichmentResults?.currentBackground?.enrich ? (
        <div className="w-full flex flex-col items-center">
          {consensus ? (
            <Pagination
              page={page}
              totalCount={
                enrichmentResults?.currentBackground?.enrich?.consensusCount
                  ? enrichmentResults?.currentBackground?.enrich.consensusCount
                  : undefined
              }
              pageSize={pageSize}
              onChange={(page) => {
                setQueryString({
                  page: `${page}`,
                  q: term,
                  consensus: queryString.consensus,
                  ko: queryString.ko,
                  dir: queryString.dir,
                  topn: queryString.topn,
                  pvaluele: queryString.pvaluele,
                  fda: queryString.fda,
                });
              }}
            />
          ) : (
            <Pagination
              page={page}
              totalCount={
                enrichmentResults?.currentBackground?.enrich?.totalCount
                  ? enrichmentResults?.currentBackground?.enrich.totalCount
                  : undefined
              }
              pageSize={pageSize}
              onChange={(page) => {
                setQueryString({
                  page: `${page}`,
                  q: term,
                  consensus: queryString.consensus,
                  ko: queryString.ko,
                  dir: queryString.dir,
                  topn: queryString.topn,
                  pvaluele: queryString.pvaluele,
                  fda: queryString.fda,
                });
              }}
            />
          )}
        </div>
      ) : null}
    </div>
  );
}

function GeneSetModalWrapper(props: {
  modalGeneSet: GeneSetModalT;
  setModalGeneSet: React.Dispatch<React.SetStateAction<GeneSetModalT>>;
}) {
  const { data: geneSet } = useViewGeneSetQuery({
    skip: props.modalGeneSet?.type !== "GeneSet",
    variables:
      props.modalGeneSet?.type === "GeneSet"
        ? {
            id: props.modalGeneSet.id,
          }
        : undefined,
  });
  const { data: overlap } = useOverlapQueryQuery({
    skip: props.modalGeneSet?.type !== "GeneSetOverlap",
    variables:
      props.modalGeneSet?.type === "GeneSetOverlap"
        ? {
            id: props.modalGeneSet.id,
            genes: props.modalGeneSet?.genes,
          }
        : undefined,
  });
  const { data: userGeneSet } = useFetchGeneInfoQuery({
    skip: props.modalGeneSet?.type !== "UserGeneSet",
    variables:
      props.modalGeneSet?.type === "UserGeneSet"
        ? {
            genes: props.modalGeneSet.genes,
          }
        : undefined,
  });
  return (
    <GeneSetModal
      showModal={props.modalGeneSet !== undefined}
      term={props.modalGeneSet?.description}
      geneset={
        props.modalGeneSet?.type === "GeneSet"
          ? geneSet?.geneSet?.genes.nodes
          : props.modalGeneSet?.type === "GeneSetOverlap"
          ? overlap?.geneSet?.overlap.nodes
          : props.modalGeneSet?.type === "UserGeneSet"
          ? userGeneSet?.geneMap2?.nodes
            ? userGeneSet.geneMap2.nodes.map(({ gene, geneInfo }) => ({
                gene,
                ...geneInfo,
              }))
            : props.modalGeneSet.genes.map((symbol) => ({ symbol }))
          : undefined
      }
      setShowModal={(show) => {
        if (!show) props.setModalGeneSet(undefined);
      }}
    />
  );
}

export default function EnrichClientPage({
  searchParams,
}: {
  searchParams: {
    dataset: string | string[] | undefined;
  };
}) {
  const dataset = ensureArray(searchParams.dataset)[0];
  const { data: userGeneSet } = useFetchUserGeneSetQuery({
    skip: !dataset,
    variables: { id: dataset },
  });
  const [modalGeneSet, setModalGeneSet] = React.useState<GeneSetModalT>();
  return (
    <>
      <div className="flex flex-row gap-2 alert">
        <span className="prose">Input:</span>
        <label
          htmlFor="geneSetModal"
          className="prose underline cursor-pointer"
          onClick={(evt) => {
            setModalGeneSet({
              type: "UserGeneSet",
              genes: (userGeneSet?.userGeneSet?.genes ?? []).filter(
                (gene): gene is string => !!gene
              ),
              description: userGeneSet?.userGeneSet?.description || "Gene set",
            });
          }}
        >
          {userGeneSet?.userGeneSet?.description || "Gene set"}
          {userGeneSet ? (
            <> ({userGeneSet?.userGeneSet?.genes?.length ?? "?"} genes)</>
          ) : null}
        </label>
      </div>
      <EnrichmentResults
        userGeneSet={userGeneSet}
        setModalGeneSet={setModalGeneSet}
      />
      <GeneSetModalWrapper
        modalGeneSet={modalGeneSet}
        setModalGeneSet={setModalGeneSet}
      />
    </>
  );
}
