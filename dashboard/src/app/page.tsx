import {
  Search,
  Camera,
  ArrowRight,
  Database,
  ShieldCheck,
  BadgePercent,
  Heart,
  Pill,
  BarChart3,
} from "lucide-react";
import SearchBar from "@/components/SearchBar";
import ImageUpload from "@/components/ImageUpload";

export default function Home() {
  return (
    <div>
      {/* Hero Section */}
      <section className="bg-white py-16 md:py-24">
        <div className="mx-auto max-w-3xl px-4 text-center">
          <h1 className="text-3xl font-bold tracking-tight text-gray-900 md:text-5xl">
            Descubra o preco justo
            <br />
            <span className="text-teal-600">do seu remedio</span>
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-lg text-gray-500">
            Compare precos de medicamentos com dados oficiais da ANVISA.
            Encontre genericos ate 80% mais baratos.
          </p>

          <div className="mt-8">
            <SearchBar size="large" showUpload />
          </div>
        </div>
      </section>

      {/* Stats Bar */}
      <section className="border-y border-gray-100 bg-gray-50 py-6">
        <div className="mx-auto grid max-w-4xl grid-cols-1 gap-6 px-4 md:grid-cols-3">
          <div className="flex items-center justify-center gap-3">
            <Database className="h-5 w-5 text-teal-600" />
            <span className="text-sm text-gray-700">
              <strong className="font-semibold">60.000+</strong> medicamentos
              cadastrados
            </span>
          </div>
          <div className="flex items-center justify-center gap-3">
            <ShieldCheck className="h-5 w-5 text-teal-600" />
            <span className="text-sm text-gray-700">
              Precos atualizados pela{" "}
              <strong className="font-semibold">ANVISA</strong>
            </span>
          </div>
          <div className="flex items-center justify-center gap-3">
            <BadgePercent className="h-5 w-5 text-teal-600" />
            <span className="text-sm text-gray-700">
              Genericos ate{" "}
              <strong className="font-semibold">80% mais baratos</strong>
            </span>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="bg-white py-16">
        <div className="mx-auto max-w-4xl px-4">
          <h2 className="text-center text-2xl font-bold text-gray-900">
            Como funciona
          </h2>
          <div className="mt-10 grid gap-8 md:grid-cols-3">
            <div className="text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-teal-50">
                <Search className="h-6 w-6 text-teal-600" />
              </div>
              <h3 className="mt-4 text-base font-semibold text-gray-900">
                1. Busque seu remedio
              </h3>
              <p className="mt-2 text-sm text-gray-500">
                Digite o nome do medicamento ou tire uma foto da receita medica.
              </p>
            </div>
            <div className="text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-teal-50">
                <BarChart3 className="h-6 w-6 text-teal-600" />
              </div>
              <h3 className="mt-4 text-base font-semibold text-gray-900">
                2. Compare precos
              </h3>
              <p className="mt-2 text-sm text-gray-500">
                Veja o preco maximo permitido pela ANVISA e todas as alternativas
                genéricas.
              </p>
            </div>
            <div className="text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-teal-50">
                <BadgePercent className="h-6 w-6 text-teal-600" />
              </div>
              <h3 className="mt-4 text-base font-semibold text-gray-900">
                3. Economize
              </h3>
              <p className="mt-2 text-sm text-gray-500">
                Escolha o generico mais barato ou descubra se esta disponivel no
                Farmacia Popular.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Prescription Upload Section */}
      <section className="border-t border-gray-100 bg-gray-50 py-16">
        <div className="mx-auto max-w-2xl px-4">
          <div className="text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-teal-50">
              <Camera className="h-6 w-6 text-teal-600" />
            </div>
            <h2 className="mt-4 text-2xl font-bold text-gray-900">
              Tire uma foto da receita
            </h2>
            <p className="mt-2 text-sm text-gray-500">
              Nosso sistema identifica automaticamente os medicamentos da sua
              receita e mostra os precos.
            </p>
          </div>
          <div className="mt-8">
            <ImageUpload />
          </div>
        </div>
      </section>

      {/* Farmacia Popular CTA */}
      <section className="bg-white py-16">
        <div className="mx-auto max-w-4xl px-4">
          <div className="rounded-xl border border-teal-100 bg-teal-50 p-8 md:p-10">
            <div className="flex flex-col items-start gap-6 md:flex-row md:items-center">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-white">
                <Heart className="h-7 w-7 text-teal-600" />
              </div>
              <div className="flex-1">
                <h2 className="text-xl font-bold text-gray-900">
                  Farmacia Popular do Brasil
                </h2>
                <p className="mt-1 text-sm text-gray-600">
                  Mais de 40 medicamentos essenciais totalmente gratis pelo
                  programa do governo. Verifique se o seu remedio esta na lista.
                </p>
              </div>
              <a
                href="/farmacia-popular"
                className="inline-flex items-center gap-2 rounded-lg bg-teal-600 px-5 py-3 text-sm font-medium text-white hover:bg-teal-700"
              >
                Ver lista completa
                <ArrowRight className="h-4 w-4" />
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* SEO Content */}
      <section className="border-t border-gray-100 bg-gray-50 py-16">
        <div className="mx-auto max-w-3xl px-4">
          <h2 className="text-xl font-bold text-gray-900">
            Sobre o Quanto Custa?
          </h2>
          <div className="mt-4 space-y-3 text-sm text-gray-600">
            <p>
              O Quanto Custa? e uma ferramenta gratuita para comparar precos de
              medicamentos no Brasil. Utilizamos dados oficiais da CMED (Camara
              de Regulacao do Mercado de Medicamentos), orgao da ANVISA
              responsavel por definir o Preco Maximo ao Consumidor (PMC) de todos
              os medicamentos comercializados no pais.
            </p>
            <p>
              Nosso objetivo e ajudar voce a encontrar alternativas mais baratas
              para seus medicamentos, especialmente genericos, que possuem a
              mesma eficacia do medicamento de referencia por um preco ate 80%
              menor.
            </p>
            <div className="flex items-start gap-3 rounded-lg bg-white p-4">
              <Pill className="mt-0.5 h-5 w-5 shrink-0 text-teal-600" />
              <p>
                <strong>Importante:</strong> O Quanto Custa? nao vende
                medicamentos. Sempre consulte seu medico ou farmaceutico antes de
                trocar qualquer medicacao.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
