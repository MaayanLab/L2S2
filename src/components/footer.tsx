"use client";
import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";
import { useSearchParams } from 'next/navigation'
import Analytics from "@/app/analytics";

const LocalStorageWrapper = ({ children }:{children: React.ReactNode}) => {
    const [isClient, setIsClient] = useState(false);
  
    useEffect(() => {
      setIsClient(true);
    }, []);
  
    return isClient ? children : null;
  };
export default function Footer() {
  const [showConsent, setShowConsent] = useState(true);
  const [analyticsOn, setAnalyticsOn] = useState(false);
  const searchParams = useSearchParams()

  useEffect(() => {
    if (typeof window !== 'undefined' && window.localStorage) {
        const consent = localStorage.getItem('analytics-consent')
        if (consent) {
            setShowConsent(false);
            if (consent === 'true') setAnalyticsOn(true);
        }
      }   
  })
  
  if (searchParams?.get('embed') !== null) return null
  return (
    <footer className="flex-none footer p-5 mt-5 bg-blue-950 text-neutral-content flex place-content-evenly">
      <div className="text-center pt-5  font-bold">
        <ul>
          <li>
            <Link href="mailto:avi.maayan@mssm.edu" target="_blank">
              Contact Us
            </Link>
          </li>
          <li>
            <Link
              href="https://github.com/MaayanLab/L2S2"
              target="_blank"
              rel="noopener noreferrer"
            >
              Source Code
            </Link>
          </li>
        </ul>
      </div>
      <div className="text-center">
        <p>
          <Link
            href="https://labs.icahn.mssm.edu/"
            target="_blank"
            rel="noopener noreferrer"
          >
            <Image
              src={"/images/ismms_white.png"}
              width={150}
              height={250}
              alt={"Ma&apos;ayan Lab"}
            />
          </Link>
        </p>
      </div>
      <div className="text-center pt-5">
        <p>
          <Link
            href="https://labs.icahn.mssm.edu/maayanlab/"
            target="_blank"
            rel="noopener noreferrer"
          >
            <Image
              className={"rounded"}
              src={"/images/maayanlab_white.png"}
              width={125}
              height={250}
              alt={"Ma&apos;ayan Lab"}
            />
          </Link>
        </p>
      </div>
      <div className="text-center pt-5 text-md font-bold">
        <ul>
          <li>
            <Link
              href="https://www.apache.org/licenses/LICENSE-2.0.txt"
              target="_blank"
            >
              License
            </Link>
          </li>
          <li>
            <Link
              href="https://academic.oup.com/nar/advance-article/doi/10.1093/nar/gkaf373/8123452"
              target="_blank"
            >
              Publication
            </Link>
          </li>
        </ul>
      </div>
      <LocalStorageWrapper>
      {showConsent && <div className="fixed z-10 bottom-0 w-full bg-blue-300 text-gray-900 shadow-lg opacity-90">
        <p className="text-left font-bold p-5 pl-10 pb-0">Cookie Policy</p>
        <div className="col-auto">
          <p className="pl-10 mb-5">
            Do you consent to the use of Google Analytics while browsing this
            website?
            <button 
            className="btn btn-sm btn-outline p-1 mx-2 text-gray-900 hover:bg-blue-500"
            onClick={() => {
                if (typeof window !== 'undefined' && window.localStorage) {
                    localStorage.setItem('analytics-consent', 'true')
                    setShowConsent(false)}
                }
            }>
              Accept
            </button>
            <button className="btn btn-sm btn-outline p-1 text-gray-900 hover:bg-blue-500"
                onClick={() => {
                    if (typeof window !== 'undefined' && window.localStorage) {
                    localStorage.setItem('analytics-consent', 'false')
                    setShowConsent(false)}
                }
            }>
              Decline
            </button>
          </p>
        </div>
      </div>}
      {analyticsOn && <Analytics/>}
      </LocalStorageWrapper>
    </footer>
  );
}
