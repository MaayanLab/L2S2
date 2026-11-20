"use client";

import type { ApolloError } from "@apollo/client";
import React from "react";

type EnrichmentErrorKind = "initializing" | "timeout" | "unavailable" | "unknown";

function classifyError(error: ApolloError): EnrichmentErrorKind {
  for (const graphQLError of error.graphQLErrors) {
    const exception = graphQLError.extensions?.exception as
      | { errcode?: string }
      | undefined;

    switch (exception?.errcode ?? graphQLError.extensions?.code) {
      case "L2S01":
        return "initializing";
      case "L2S02":
        return "timeout";
      case "L2S03":
        return "unavailable";
    }
  }

  return "unknown";
}

export default function EnrichmentError({
  error,
  retry,
}: {
  error: ApolloError;
  retry: () => Promise<unknown>;
}) {
  const kind = classifyError(error);

  React.useEffect(() => {
    if (kind !== "initializing") return;

    const timer = window.setTimeout(() => {
      void retry();
    }, 5000);

    return () => window.clearTimeout(timer);
  }, [kind, retry]);

  const message =
    kind === "initializing"
      ? "The enrichment index is warming up. This page will retry automatically."
      : kind === "timeout"
      ? "The enrichment request timed out. The service may be busy."
      : kind === "unavailable"
      ? "The enrichment service is temporarily unavailable."
      : "The enrichment query failed unexpectedly.";

  return (
    <div className="alert alert-error my-4" role="alert">
      <div className="flex flex-col items-start gap-2">
        <span>{message}</span>
        <button className="btn btn-sm" type="button" onClick={() => void retry()}>
          Retry
        </button>
        {kind === "unknown" ? (
          <details className="text-sm">
            <summary>Error details</summary>
            <span>{error.message}</span>
          </details>
        ) : null}
      </div>
    </div>
  );
}
