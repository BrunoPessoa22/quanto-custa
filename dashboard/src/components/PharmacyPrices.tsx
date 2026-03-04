"use client";

import { useState, useEffect } from "react";
import { Store, ExternalLink, Loader2, TrendingDown, AlertCircle } from "lucide-react";
import { getPharmacyPrices, trackAffiliateClick, type PharmacyPricesResult } from "@/lib/api";
import { PHARMACY_INFO } from "@/lib/constants";
import AffiliateLinks from "./AffiliateLinks";

interface PharmacyPricesProps {
  medicationName: string;
  medicationId: string;
  pmcPrice?: number;
}

function formatCurrency(value: number): string {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function LoadingSkeleton() {
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className="animate-pulse rounded-lg border border-gray-200 bg-white p-4"
        >
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-gray-100" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-24 rounded bg-gray-100" />
              <div className="h-3 w-16 rounded bg-gray-100" />
            </div>
          </div>
          <div className="mt-3 h-6 w-20 rounded bg-gray-100" />
        </div>
      ))}
    </div>
  );
}

export default function PharmacyPrices({
  medicationName,
  medicationId,
  pmcPrice,
}: PharmacyPricesProps) {
  const [data, setData] = useState<PharmacyPricesResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setFailed(false);

    getPharmacyPrices(medicationName, medicationId)
      .then((result) => {
        if (!cancelled) setData(result);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [medicationName, medicationId]);

  if (loading) return <LoadingSkeleton />;

  // Fall back to affiliate links if scraping failed or returned no prices
  if (failed || !data) {
    return (
      <AffiliateLinks
        medicationId={medicationId}
        medicationName={medicationName}
      />
    );
  }

  const hasAnyPrices = Object.values(data.prices).some(
    (p) => p.products.length > 0
  );

  if (!hasAnyPrices) {
    return (
      <AffiliateLinks
        medicationId={medicationId}
        medicationName={medicationName}
      />
    );
  }

  const ceiling = data.pmc_ceiling ?? pmcPrice;

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-3">
        {PHARMACY_INFO.map((pharmacy) => {
          const priceData = data.prices[pharmacy.id];
          const hasProducts = priceData && priceData.products.length > 0;
          const cheapest = priceData?.cheapest;
          const savingsVsPmc =
            ceiling && cheapest && cheapest < ceiling
              ? ((1 - cheapest / ceiling) * 100).toFixed(0)
              : null;

          function handleClick(url?: string) {
            trackAffiliateClick(medicationId, pharmacy.id).catch(() => {});
            const target =
              url || `${pharmacy.baseUrl}${encodeURIComponent(medicationName)}`;
            window.open(target, "_blank", "noopener,noreferrer");
          }

          return (
            <div
              key={pharmacy.id}
              className="rounded-lg border border-gray-200 bg-white shadow-sm"
            >
              <div className="flex items-center gap-3 border-b border-gray-100 p-4">
                <div
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg"
                  style={{ backgroundColor: `${pharmacy.color}15` }}
                >
                  <Store
                    className="h-5 w-5"
                    style={{ color: pharmacy.color }}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900">
                    {pharmacy.name}
                  </p>
                  {hasProducts && cheapest != null && (
                    <p className="text-xs text-gray-500">
                      A partir de{" "}
                      <span className="font-medium text-gray-900">
                        {formatCurrency(cheapest)}
                      </span>
                    </p>
                  )}
                </div>
              </div>

              {hasProducts ? (
                <div className="p-3 space-y-2">
                  {savingsVsPmc && (
                    <div className="flex items-center gap-1 text-xs text-green-600">
                      <TrendingDown className="h-3 w-3" />
                      <span>
                        {savingsVsPmc}% abaixo do PMC
                        {ceiling ? ` (${formatCurrency(ceiling)})` : ""}
                      </span>
                    </div>
                  )}
                  {priceData.products.slice(0, 2).map((product, i) => (
                    <button
                      key={i}
                      onClick={() => handleClick(product.url)}
                      className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-sm hover:bg-gray-50"
                    >
                      <span className="truncate text-gray-700">
                        {product.name}
                      </span>
                      <div className="flex items-center gap-1.5 shrink-0 ml-2">
                        <span className="font-medium text-gray-900">
                          {formatCurrency(product.price)}
                        </span>
                        <ExternalLink className="h-3 w-3 text-gray-400" />
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="p-3">
                  <button
                    onClick={() => handleClick()}
                    className="flex w-full items-center justify-center gap-1.5 rounded-md bg-gray-50 px-3 py-2 text-sm text-gray-600 hover:bg-gray-100"
                  >
                    Buscar nesta farmacia
                    <ExternalLink className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {ceiling && (
        <div className="flex items-center gap-2 text-xs text-gray-400">
          <AlertCircle className="h-3 w-3" />
          Precos podem variar. PMC teto: {formatCurrency(ceiling)}
        </div>
      )}
    </div>
  );
}
