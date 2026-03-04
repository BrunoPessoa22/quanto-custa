import { TrendingDown, Heart } from "lucide-react";
import type { MedicationWithPrice } from "@/lib/api";

interface PriceTableProps {
  reference: MedicationWithPrice | null;
  equivalents: MedicationWithPrice[];
}

function formatCurrency(value: number): string {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

export default function PriceTable({ reference, equivalents }: PriceTableProps) {
  const sorted = [...equivalents].sort((a, b) => a.price - b.price);

  return (
    <div className="overflow-hidden rounded-lg border border-gray-200">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-gray-200 bg-gray-50">
            <th className="px-4 py-3 font-medium text-gray-700">
              Medicamento
            </th>
            <th className="px-4 py-3 font-medium text-gray-700">
              Fabricante
            </th>
            <th className="px-4 py-3 font-medium text-gray-700">Tipo</th>
            <th className="px-4 py-3 text-right font-medium text-gray-700">
              Preco
            </th>
            <th className="px-4 py-3 text-right font-medium text-gray-700">
              Economia
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {reference && (
            <tr className="bg-blue-50/50">
              <td className="px-4 py-3">
                <div className="font-medium text-gray-900">
                  {reference.name}
                </div>
                <div className="text-xs text-gray-500">
                  {reference.presentation}
                </div>
              </td>
              <td className="px-4 py-3 text-gray-600">
                {reference.manufacturer}
              </td>
              <td className="px-4 py-3">
                <span className="inline-block rounded border border-blue-200 bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
                  Referencia
                </span>
              </td>
              <td className="px-4 py-3 text-right font-semibold text-gray-900">
                {formatCurrency(reference.price)}
              </td>
              <td className="px-4 py-3 text-right text-gray-400">--</td>
            </tr>
          )}
          {sorted.map((med) => (
            <tr key={med.id} className="hover:bg-gray-50">
              <td className="px-4 py-3">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-gray-900">{med.name}</span>
                  {(med.farmacia_popular || med.farmacia_popular_free) && (
                    <span className="inline-flex items-center gap-1 rounded bg-teal-50 px-1.5 py-0.5 text-xs text-teal-700">
                      <Heart className="h-3 w-3" />
                      {med.farmacia_popular_free ? "Gratis" : "Desconto"}
                    </span>
                  )}
                </div>
                <div className="text-xs text-gray-500">
                  {med.presentation}
                </div>
              </td>
              <td className="px-4 py-3 text-gray-600">{med.manufacturer}</td>
              <td className="px-4 py-3">
                <span
                  className={`inline-block rounded border px-2 py-0.5 text-xs font-medium ${
                    med.category === "generic"
                      ? "border-green-200 bg-green-50 text-green-700"
                      : "border-amber-200 bg-amber-50 text-amber-700"
                  }`}
                >
                  {med.category === "generic" ? "Generico" : "Similar"}
                </span>
              </td>
              <td className="px-4 py-3 text-right font-semibold text-gray-900">
                {formatCurrency(med.price)}
              </td>
              <td className="px-4 py-3 text-right">
                {med.savings_percentage != null &&
                med.savings_percentage > 0 ? (
                  <div className="flex items-center justify-end gap-1 text-green-600">
                    <TrendingDown className="h-3.5 w-3.5" />
                    <span className="text-sm font-medium">
                      {med.savings_percentage.toFixed(0)}%
                    </span>
                  </div>
                ) : (
                  <span className="text-gray-400">--</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {sorted.length === 0 && !reference && (
        <div className="px-4 py-8 text-center text-sm text-gray-500">
          Nenhum equivalente encontrado.
        </div>
      )}
    </div>
  );
}
