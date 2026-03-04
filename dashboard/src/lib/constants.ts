export const BRAZILIAN_STATES = [
  { code: "AC", name: "Acre" },
  { code: "AL", name: "Alagoas" },
  { code: "AP", name: "Amapá" },
  { code: "AM", name: "Amazonas" },
  { code: "BA", name: "Bahia" },
  { code: "CE", name: "Ceará" },
  { code: "DF", name: "Distrito Federal" },
  { code: "ES", name: "Espírito Santo" },
  { code: "GO", name: "Goiás" },
  { code: "MA", name: "Maranhão" },
  { code: "MT", name: "Mato Grosso" },
  { code: "MS", name: "Mato Grosso do Sul" },
  { code: "MG", name: "Minas Gerais" },
  { code: "PA", name: "Pará" },
  { code: "PB", name: "Paraíba" },
  { code: "PR", name: "Paraná" },
  { code: "PE", name: "Pernambuco" },
  { code: "PI", name: "Piauí" },
  { code: "RJ", name: "Rio de Janeiro" },
  { code: "RN", name: "Rio Grande do Norte" },
  { code: "RS", name: "Rio Grande do Sul" },
  { code: "RO", name: "Rondônia" },
  { code: "RR", name: "Roraima" },
  { code: "SC", name: "Santa Catarina" },
  { code: "SP", name: "São Paulo" },
  { code: "SE", name: "Sergipe" },
  { code: "TO", name: "Tocantins" },
] as const;

export type StateCode = (typeof BRAZILIAN_STATES)[number]["code"];

export const PHARMACY_INFO = [
  {
    id: "drogasil",
    name: "Drogasil",
    color: "#E31937",
    baseUrl: "https://www.drogasil.com.br/search?w=",
    awinAdvertiserId: process.env.NEXT_PUBLIC_AWIN_DROGASIL_ID || "",
  },
  {
    id: "drogaraia",
    name: "Droga Raia",
    color: "#00A651",
    baseUrl: "https://www.drogaraia.com.br/search?w=",
    awinAdvertiserId: process.env.NEXT_PUBLIC_AWIN_DROGARAIA_ID || "",
  },
  {
    id: "paguemenos",
    name: "Pague Menos",
    color: "#0066B3",
    baseUrl: "https://www.paguemenos.com.br/busca?q=",
    awinAdvertiserId: process.env.NEXT_PUBLIC_AWIN_PAGUEMENOS_ID || "64086",
  },
  {
    id: "drogaria_sp",
    name: "Drogaria Sao Paulo",
    color: "#D4202C",
    baseUrl: "https://www.drogariasaopaulo.com.br/search?w=",
    awinAdvertiserId: process.env.NEXT_PUBLIC_AWIN_DROGARIA_SP_ID || "",
  },
  {
    id: "drogaria_araujo",
    name: "Drogaria Araujo",
    color: "#F7941D",
    baseUrl: "https://www.araujo.com.br/busca?q=",
    awinAdvertiserId: process.env.NEXT_PUBLIC_AWIN_ARAUJO_ID || "",
  },
] as const;

const AWIN_PUBLISHER_ID = process.env.NEXT_PUBLIC_AWIN_PUBLISHER_ID || "";

/**
 * Wraps a destination URL with Awin tracking if publisher + advertiser IDs are set.
 * Falls back to the raw URL if Awin is not configured.
 */
export function buildAffiliateUrl(
  destinationUrl: string,
  awinAdvertiserId: string
): string {
  if (!AWIN_PUBLISHER_ID || !awinAdvertiserId) return destinationUrl;
  return `https://www.awin1.com/cread.php?awinmid=${awinAdvertiserId}&awinaffid=${AWIN_PUBLISHER_ID}&ued=${encodeURIComponent(destinationUrl)}`;
}

export const ICMS_BRACKETS: Record<string, number> = {
  AC: 19,
  AL: 19,
  AP: 18,
  AM: 20,
  BA: 20.5,
  CE: 20,
  DF: 20,
  ES: 17,
  GO: 19,
  MA: 22,
  MT: 17,
  MS: 17,
  MG: 18,
  PA: 19,
  PB: 20,
  PR: 19.5,
  PE: 20.5,
  PI: 21,
  RJ: 22,
  RN: 18,
  RS: 17,
  RO: 19.5,
  RR: 20,
  SC: 17,
  SP: 18,
  SE: 19,
  TO: 20,
};

export const FARMACIA_POPULAR_FREE = [
  "Captopril",
  "Cloridrato de Propranolol",
  "Hidroclorotiazida",
  "Losartana Potássica",
  "Maleato de Enalapril",
  "Atenolol",
  "Anlodipino",
  "Glibenclamida",
  "Cloridrato de Metformina",
  "Insulina Humana NPH",
  "Insulina Humana Regular",
  "Salbutamol",
  "Brometo de Ipratrópio",
  "Dipropionato de Beclometasona",
  "Budesonida",
  "Sinvastatina",
  "Furosemida",
  "Espironolactona",
  "Digoxina",
  "Carvedilol",
  "Succinato de Metoprolol",
  "Valsartana",
  "Clopidogrel",
  "Hidralazina",
  "Isossorbida",
  "Metildopa",
  "Varfarina",
  "Amiodarona",
  "Levotiroxina",
  "Alendronato de Sódio",
  "Carbonato de Cálcio",
  "Nitrato de Miconazol",
  "Noretisterona + Estradiol",
  "Acetato de Medroxiprogesterona",
  "Etinilestradiol + Levonorgestrel",
  "Valerato de Estradiol",
  "Carbidopa + Levodopa",
  "Diazepam",
  "Clonazepam",
  "Fluoxetina",
  "Amitriptilina",
];
