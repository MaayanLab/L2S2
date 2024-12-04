import React, { useState } from "react";

export default function DownloadButton({ queryString }: { queryString: Record<string, string | null> }) {
  const [loading, setLoading] = useState(false);


  const handleDownload = async () => {
    setLoading(true);

    const downloadUrl = `/enrich/download?dataset=${queryString.dataset}&q=${queryString.q}&fda=${queryString.fda}&consensus=${queryString.consensus}&dir=${queryString.dir}&ko=${queryString.ko}&sort=${queryString.sort}`;
    
    try {
      const response = await fetch(downloadUrl);
      if (!response.ok) {
        throw new Error("Failed to download file");
      }
      const blob = await response.blob();

      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `${queryString.dataset}.tsv`; // Set a default filename or make it dynamic
      document.body.appendChild(link);
      link.click();

      link.remove();
    } catch (error) {
      console.error("Error downloading file:", error);
      alert("The request timed out. Please refer to the download page for retrieving large numbers of results.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="tooltip" data-tip="Download results">
      <button
        type="button"
        onClick={handleDownload}
        className="btn join-item font-bold text-2xl pb-1"
        disabled={loading} // Disable button during loading
      >
        {loading ? (
          <div className="spinner">
            {/* Add your spinner here */}
            <svg
              className="animate-spin h-5 w-5 text-white"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              ></circle>
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8v8H4z"
              ></path>
            </svg>
          </div>
        ) : (
          "↓"
        )}
      </button>
    </div>
  );
}