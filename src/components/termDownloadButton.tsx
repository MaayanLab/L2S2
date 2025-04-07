import React, { useState } from "react";
import blobTsv from "@/utils/blobTsv";
import clientDownloadBlob from "@/utils/clientDownloadBlob";

type dataFilteredType = {
    __typename?: "GeneSet";
    term?: string | null;
    id?: any;
    nGeneIds?: number | null;
};

export default function TermDownloadButton({dataFiltered, filterTerm}: {dataFiltered: dataFilteredType[], filterTerm: string}) {
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);

  if (!dataFiltered || filterTerm == "") return null;

  const handleMetadataDownload = async () => {
    setShowModal(false)
    if (!dataFiltered) return
        const blob = blobTsv(['term', 'nGenes'], dataFiltered, item => ({
            term: item.term,
            nGenes: item.nGeneIds,
        }))
        clientDownloadBlob(blob, 'results.tsv')
    }

  const handleDownload = async () => {
    setShowModal(false)
    setLoading(true);
    const encodedTerm = encodeURIComponent(filterTerm);
    const downloadUrl = `/term-search/download?term=${encodedTerm}`;
    const link = document.createElement("a");
    link.href = downloadUrl;
    link.download = `${filterTerm}_genesets.tsv`; // optional override if server doesn't send Content-Disposition
    link.rel = "nofollow";
    link.style.display = "none";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setLoading(false);
  };

  console.log(filterTerm)

  return (
    <div className="relative">
      <div className="tooltip" data-tip="Download results">
        <button
          type="button"
          onClick={() => {
              setShowModal(true)
          }}
          className="btn join-item font-bold text-2xl pb-1"
          disabled={loading}
        >
          {loading ? (
            <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
            </svg>
          ) : (
            "↓"
          )}
        </button>
      </div>

      {showModal && (
        <div className="absolute right-0 z-50 bg-white shadow-lg p-4 rounded-lg border mt-2 w-96">
          <label className="block mb-2 font-semibold text-left">Signifigant results to download (max 5k):</label>

          <div className="flex justify-end space-x-2">
            <button className="btn btn-sm btn-primary" onClick={handleDownload}>Download GMT</button>
            <button className="btn btn-sm btn-primary" onClick={handleMetadataDownload}>Download Metadata</button>
          </div>
        
          <div className="flex justify-center text-center mx-auto space-x-2 mt-2 ">
            <button className="btn btn-sm btn-ghost" onClick={() => setShowModal(false)}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}
