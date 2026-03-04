"use client";

import { ExternalLink, Store } from "lucide-react";
import { PHARMACY_INFO } from "@/lib/constants";
import { trackAffiliateClick } from "@/lib/api";

interface AffiliateLinksProps {
  medicationId: string;
  medicationName: string;
}

export default function AffiliateLinks({
  medicationId,
  medicationName,
}: AffiliateLinksProps) {
  function handleClick(pharmacyId: string, url: string) {
    trackAffiliateClick(medicationId, pharmacyId).catch(() => {});
    window.open(url, "_blank", "noopener,noreferrer");
  }

  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {PHARMACY_INFO.map((pharmacy) => {
        const url = `${pharmacy.baseUrl}${encodeURIComponent(medicationName)}`;
        return (
          <button
            key={pharmacy.id}
            onClick={() => handleClick(pharmacy.id, url)}
            className="flex items-center gap-3 rounded-lg border border-gray-200 bg-white p-4 text-left shadow-sm transition-shadow hover:shadow-md"
          >
            <div
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg"
              style={{ backgroundColor: `${pharmacy.color}15` }}
            >
              <Store className="h-5 w-5" style={{ color: pharmacy.color }} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900">
                {pharmacy.name}
              </p>
              <p className="text-xs text-gray-500">Buscar nesta farmacia</p>
            </div>
            <ExternalLink className="h-4 w-4 shrink-0 text-gray-400" />
          </button>
        );
      })}
    </div>
  );
}
