import "./globals.css";
import React from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { ApolloWrapper } from "@/lib/apollo/provider";
import Nav from "./nav";
import Stats from "./stats";
import Image from "next/image";
import { RuntimeConfig } from "@/app/runtimeConfig";
import Footer from "@/components/footer";

export const metadata: Metadata = {
  title: "L2S2",
  description:
    "Search through 1,678,002 gene sets generated by the Library of Integrated Network-based Cellular Signatures (LINCS) program to find the most similar gene sets that match your query.",
  keywords: [
    "big data",
    "bioinformatics",
    "bone",
    "cancer",
    "cell line",
    "data ecosystem",
    "data portal",
    "data",
    "dataset",
    "diabetes",
    "disease",
    "drug discovery",
    "drug",
    "enrichment analysis",
    "gene set library",
    "gene set",
    "gene",
    "genomics",
    "heart",
    "kidney",
    "knowledge",
    "literature mining",
    "literature",
    "liver",
    "machine learning",
    "neurons",
    "papers",
    "peturbation",
    "pharmacology",
    "phenotype",
    "pmc",
    "protein",
    "proteomics",
    "publications",
    "pubmed",
    "RNA-seq",
    "RNAseq",
    "scRNA-seq",
    "single cell",
    "skin",
    "systems biology",
    "target discovery",
    "target",
    "therapeutics",
    "tissue",
    "transcriptomics",
    "L1000",
    "LINCS",
  ].join(", "),
  metadataBase: new URL("https://l2s2.maayanlab.cloud"),
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "L2S2",
    description:
      "Search through 1,678,002 gene sets generated by the Library of Integrated Network-based Cellular Signatures (LINCS) program",
    url: "https://l2s2.maayanlab.cloud",
    siteName: "L2S2",
    images: [
      {
        url: "https://l2s2.maayanlab.cloud/images/LINCSearch_logo.png",
        width: 1024,
        height: 998,
      },
    ],
    locale: "en_US",
    type: "website",
  },
  robots: {
    index: true,
    follow: true,
    nocache: false,
    googleBot: {
      index: true,
      follow: false,
      noimageindex: true,
    },
  },
};

export default function RootLayout({
  children,
  jsonld,
}: {
  children: React.ReactNode;
  jsonld?: React.ReactNode;
}) {
  return (
    <html lang="en" style={{ minWidth: "580px" }}>
      <head>{jsonld}</head>
      <ApolloWrapper>
        <RuntimeConfig>
          <body className="min-h-screen flex flex-col bg-gradient-to-t from-blue-900 to-white dark:from-black dark:to-blue-900 dark:text-white">
            <header>
              <div className="navbar block text-center">
                <div className="navbar-center">
                  <ul className="menu menu-horizontal gap-3 text-lg justify-center">
                    <Nav />
                  </ul>
                </div>
                <div className="navbar-center ml-5">
                  <React.Suspense
                    fallback={
                      <span className="loading loading-ring loading-lg"></span>
                    }
                  >
                    <Stats bold show_sets_analyzed />
                  </React.Suspense>
                </div>
              </div>
            </header>
            <main className="flex-1 flex-col justify-stretch mx-8 md:mx-32">
              <React.Suspense
                fallback={
                  <span className="loading loading-ring loading-lg"></span>
                }
              >
                {children}
              </React.Suspense>
            </main>
            <Footer/>
          </body>
        </RuntimeConfig>
      </ApolloWrapper>
    </html>
  );
}
