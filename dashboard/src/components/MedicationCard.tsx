import Link from "next/link";
import { Tag, TrendingDown, Heart } from "lucide-react";
import type { MedicationWithPrice } from "@/lib/api";

interface MedicationCardProps {
  medication: MedicationWithPrice;
}

function formatCurrency(value: number): string {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function getCategoryBadge(category: string) {
  switch (category) {
    case "generic":
      return {
        label: "Generico",
        className: "bg-green-50 text-green-700 border-green-200",
      };
    case "reference":
      return {
        label: "Referencia",
        className: "bg-blue-50 text-blue-700 border-blue-200",
      };
    case "similar":
      return {
        label: "Similar",
        className: "bg-amber-50 text-amber-700 border-amber-200",
      };
    default:
      return {
        label: category,
        className: "bg-gray-50 text-gray-700 border-gray-200",
      };
  }
}

export default function MedicationCard({ medication }: MedicationCardProps) {
  const badge = getCategoryBadge(medication.category);

  return (
    <Link
      href={`/remedio/${medication.slug}`}
      className="block rounded-lg border border-gray-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-base font-semibold text-gray-900 truncate">
              {medication.name}
            </h3>
            <span
              className={`inline-flex items-center gap-1 rounded border px-2 py-0.5 text-xs font-medium ${badge.className}`}
            >
              <Tag className="h-3 w-3" />
              {badge.label}
            </span>
          </div>

          <p className="mt-1 text-sm text-gray-500">
            {medication.active_ingredient} &middot; {medication.manufacturer}
          </p>
          <p className="mt-0.5 text-xs text-gray-400">
            {medication.presentation}
          </p>

          {medication.farmacia_popular_free && (
            <div className="mt-2 inline-flex items-center gap-1.5 rounded-md bg-green-50 px-2.5 py-1 text-xs font-medium text-green-700">
              <Heart className="h-3 w-3" />
              GRATIS no Farmacia Popular
            </div>
          )}
          {medication.farmacia_popular && !medication.farmacia_popular_free && (
            <div className="mt-2 inline-flex items-center gap-1.5 rounded-md bg-teal-50 px-2.5 py-1 text-xs font-medium text-teal-700">
              <Heart className="h-3 w-3" />
              Desconto no Farmacia Popular
            </div>
          )}
        </div>

        <div className="text-right shrink-0">
          <p className="text-xl font-bold text-gray-900">
            {formatCurrency(medication.price)}
          </p>

          {medication.savings_percentage != null &&
            medication.savings_percentage > 0 && (
              <div className="mt-1 flex items-center justify-end gap-1 text-green-600">
                <TrendingDown className="h-3.5 w-3.5" />
                <span className="text-sm font-medium">
                  {medication.savings_percentage.toFixed(0)}% mais barato
                </span>
              </div>
            )}

          {medication.reference_price != null &&
            medication.savings_vs_reference != null &&
            medication.savings_vs_reference > 0 && (
              <p className="mt-0.5 text-xs text-gray-400">
                Ref: {formatCurrency(medication.reference_price)}
              </p>
            )}
        </div>
      </div>
    </Link>
  );
}
