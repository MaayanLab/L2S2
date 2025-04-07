import { url } from "inspector";
import React, { useState } from "react";
import { useSearchParams } from "next/navigation";

export default function DownloadButtonPair(
  { queryString, datasetUp, datasetDown} : 
  { queryString: Record<string, string | null>;
    datasetUp: string;
    datasetDown: string; 
  }) {
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [maxTotal, setMaxTotal] = useState<number>(1000);

  console.log("queryString", datasetUp, datasetDown)

  const handleDownload = async () => {
    setLoading(true);
    setShowModal(false);
    const downloadUrl = `/enrichpair/download?datasetup=${datasetUp}&datasetdown=${datasetDown}&q=${queryString.q}&fda=${queryString.fda}&consensus=${queryString.consensus}&dir=${queryString.dir}&ko=${queryString.ko}&sort=${queryString.sort}&topn=${queryString.topN}&moas=${queryString.moas}&maxTotal=${maxTotal}`;

    try {
      const response = await fetch(downloadUrl);
      if (!response.ok) {
        throw new Error("Failed to download file");
      }
      const blob = await response.blob();

      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `${queryString.dataset}.tsv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      console.error("Error downloading file:", error);
      alert("The request timed out. Please refer to the download page for retrieving large numbers of results.");
    } finally {
      setLoading(false);
      setShowModal(false);
    }
  };

  return (
    <div className="relative">
      <div className="tooltip" data-tip="Download results">
        <button
          type="button"
          onClick={() => {
            if (!loading && queryString.consensus != "true" && queryString.moas != "true") {
              setShowModal(true)
            } else {
              handleDownload()
            }

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
        <div className="absolute right-0 z-50 bg-white shadow-lg p-4 rounded-lg border mt-2 w-64">
          <label className="block mb-2 font-semibold">Signifigant results to download (max 100k):</label>
          <input
            type="number"
            className="input input-bordered w-full mb-4"
            value={maxTotal}
            onChange={(e) => setMaxTotal(parseInt(e.target.value))}
            min={1}
            step={1}
          />
          <div className="flex justify-end space-x-2">
            <button className="btn btn-sm btn-ghost" onClick={() => setShowModal(false)}>Cancel</button>
            <button className="btn btn-sm btn-primary" onClick={handleDownload}>Download</button>
          </div>
        </div>
      )}
    </div>
  );
}
