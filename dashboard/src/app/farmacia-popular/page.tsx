import type { Metadata } from "next";
import Link from "next/link";
import {
  Heart,
  Search,
  Check,
  BadgePercent,
  CreditCard,
  FileText,
  ArrowRight,
  Pill,
  AlertCircle,
} from "lucide-react";
import { FARMACIA_POPULAR_FREE } from "@/lib/constants";
import SearchBar from "@/components/SearchBar";

export const metadata: Metadata = {
  title: "Farmacia Popular - Medicamentos gratis e com desconto",
  description:
    "Lista completa dos medicamentos gratuitos e com desconto no programa Farmacia Popular do Brasil. Saiba como retirar seus remedios.",
};

const DISCOUNTED_CATEGORIES = [
  {
    name: "Antidepressivos e ansiedade",
    medications: ["Sertralina", "Citalopram", "Paroxetina"],
  },
  {
    name: "Anticonvulsivantes",
    medications: ["Carbamazepina", "Fenitoina", "Valproato de Sodio"],
  },
  {
    name: "Antiparkinsonianos",
    medications: ["Biperideno", "Entacapona", "Pramipexol"],
  },
  {
    name: "Osteoporose",
    medications: ["Raloxifeno", "Calcitriol"],
  },
  {
    name: "Glaucoma",
    medications: ["Timolol", "Travoprosta", "Brimonidina"],
  },
  {
    name: "Rinite",
    medications: ["Budesonida nasal"],
  },
  {
    name: "Incontinencia urinaria",
    medications: ["Oxibutinina"],
  },
];

export default function FarmaciaPopularPage() {
  return (
    <div>
      {/* Hero */}
      <section className="bg-teal-50 py-12">
        <div className="mx-auto max-w-4xl px-4">
          <div className="flex items-center gap-3">
            <Heart className="h-8 w-8 text-teal-600" />
            <h1 className="text-3xl font-bold text-gray-900">
              Farmacia Popular do Brasil
            </h1>
          </div>
          <p className="mt-3 max-w-2xl text-gray-600">
            O Farmacia Popular e um programa do Governo Federal que oferece
            medicamentos essenciais de forma gratuita ou com descontos
            significativos em farmacias credenciadas de todo o Brasil.
          </p>
        </div>
      </section>

      {/* How to get */}
      <section className="bg-white py-10">
        <div className="mx-auto max-w-4xl px-4">
          <h2 className="text-xl font-bold text-gray-900">
            Como retirar seus medicamentos
          </h2>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            <div className="rounded-lg border border-gray-200 p-5">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-teal-50">
                <FileText className="h-5 w-5 text-teal-600" />
              </div>
              <h3 className="mt-3 text-sm font-semibold text-gray-900">
                1. Receita medica
              </h3>
              <p className="mt-1 text-sm text-gray-500">
                Leve a receita medica original, valida por 120 dias (ate 365
                dias para contraceptivos).
              </p>
            </div>
            <div className="rounded-lg border border-gray-200 p-5">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-teal-50">
                <CreditCard className="h-5 w-5 text-teal-600" />
              </div>
              <h3 className="mt-3 text-sm font-semibold text-gray-900">
                2. Documento com CPF
              </h3>
              <p className="mt-1 text-sm text-gray-500">
                Apresente um documento de identificacao com CPF (RG, CNH ou
                cartao do SUS).
              </p>
            </div>
            <div className="rounded-lg border border-gray-200 p-5">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-teal-50">
                <Check className="h-5 w-5 text-teal-600" />
              </div>
              <h3 className="mt-3 text-sm font-semibold text-gray-900">
                3. Retire na farmacia
              </h3>
              <p className="mt-1 text-sm text-gray-500">
                Va a qualquer farmacia credenciada. Nao e necessario cadastro
                previo.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Free medications */}
      <section className="border-t border-gray-100 bg-gray-50 py-10">
        <div className="mx-auto max-w-4xl px-4">
          <div className="flex items-center gap-2">
            <Heart className="h-5 w-5 text-teal-600" />
            <h2 className="text-xl font-bold text-gray-900">
              Medicamentos 100% gratuitos
            </h2>
          </div>
          <p className="mt-2 text-sm text-gray-500">
            {FARMACIA_POPULAR_FREE.length} medicamentos disponiveis sem nenhum
            custo para o paciente.
          </p>

          <div className="mt-6 grid gap-2 sm:grid-cols-2 md:grid-cols-3">
            {FARMACIA_POPULAR_FREE.map((med) => (
              <Link
                key={med}
                href={`/buscar?q=${encodeURIComponent(med)}&fp=1`}
                className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm hover:shadow-sm"
              >
                <Pill className="h-4 w-4 shrink-0 text-teal-600" />
                <span className="text-gray-900">{med}</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Discounted medications */}
      <section className="bg-white py-10">
        <div className="mx-auto max-w-4xl px-4">
          <div className="flex items-center gap-2">
            <BadgePercent className="h-5 w-5 text-teal-600" />
            <h2 className="text-xl font-bold text-gray-900">
              Medicamentos com desconto
            </h2>
          </div>
          <p className="mt-2 text-sm text-gray-500">
            Alem dos medicamentos gratuitos, o programa oferece descontos de ate
            90% em diversas categorias.
          </p>

          <div className="mt-6 space-y-4">
            {DISCOUNTED_CATEGORIES.map((cat) => (
              <div
                key={cat.name}
                className="rounded-lg border border-gray-200 p-4"
              >
                <h3 className="text-sm font-semibold text-gray-900">
                  {cat.name}
                </h3>
                <div className="mt-2 flex flex-wrap gap-2">
                  {cat.medications.map((med) => (
                    <Link
                      key={med}
                      href={`/buscar?q=${encodeURIComponent(med)}`}
                      className="inline-flex items-center gap-1.5 rounded-md bg-gray-50 px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-100"
                    >
                      <Pill className="h-3 w-3 text-gray-400" />
                      {med}
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Important note */}
      <section className="border-t border-gray-100 bg-gray-50 py-6">
        <div className="mx-auto max-w-4xl px-4">
          <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
            <div className="text-sm text-amber-900">
              <p className="font-semibold">Importante</p>
              <p className="mt-1">
                O programa Farmacia Popular exige receita medica. Medicamentos
                controlados (tarja preta) possuem regras especificas. Consulte
                seu medico ou farmaceutico para mais informacoes.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Search CTA */}
      <section className="bg-white py-12">
        <div className="mx-auto max-w-2xl px-4 text-center">
          <h2 className="text-xl font-bold text-gray-900">
            Busque seu medicamento
          </h2>
          <p className="mt-2 text-sm text-gray-500">
            Verifique se seu remedio esta disponivel no Farmacia Popular e
            compare precos.
          </p>
          <div className="mt-6">
            <SearchBar />
          </div>
        </div>
      </section>
    </div>
  );
}
