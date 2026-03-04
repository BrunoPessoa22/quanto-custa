import type { StateCode } from "./constants";

// --- Type Definitions ---

export interface Medication {
  id: string;
  slug: string;
  name: string;
  active_ingredient: string;
  manufacturer: string;
  presentation: string;
  category: "reference" | "generic" | "similar";
  ean: string;
  registry: string;
  farmacia_popular: boolean;
  farmacia_popular_free: boolean;
}

export interface MedicationPrice {
  medication_id: string;
  state: string;
  pmc: number; // preco maximo ao consumidor
  pfab: number; // preco fabrica
  icms_rate: number;
}

export interface MedicationWithPrice extends Medication {
  price: number;
  savings_vs_reference: number | null;
  savings_percentage: number | null;
  reference_price: number | null;
}

export interface MedicationDetail extends Medication {
  prices_by_state: MedicationPrice[];
  equivalents: MedicationWithPrice[];
}

export interface SearchResult {
  query: string;
  state: string;
  total: number;
  medications: MedicationWithPrice[];
}

export interface SearchSuggestion {
  name: string;
  slug: string;
  active_ingredient: string;
  category: string;
}

export interface VisionResult {
  medications: Array<{
    name: string;
    dosage: string;
    matches: MedicationWithPrice[];
  }>;
}

// --- Prescription Analysis (enhanced vision) ---

export interface PrescriptionExtracted {
  name: string;
  active_ingredient: string | null;
  dosage: string | null;
  form: string | null;
  quantity: string | null;
  frequency: string | null;
  duration: string | null;
  confidence: number;
}

export interface PrescriptionItem {
  extracted: PrescriptionExtracted;
  best_match: (MedicationWithPrice & { similarity_score?: number }) | null;
  generic_alternatives: MedicationWithPrice[];
  cheapest_option: MedicationWithPrice | null;
  farmacia_popular_option: MedicationWithPrice | null;
  savings: {
    reference_price: number | null;
    cheapest_price: number | null;
    amount: number | null;
    percentage: number | null;
  };
}

export interface PrescriptionAnalysis {
  prescription: {
    type: string;
    prescriber: string | null;
    date: string | null;
  };
  items: PrescriptionItem[];
  summary: {
    total_reference_cost: number;
    total_cheapest_cost: number;
    total_savings: number;
    total_savings_percentage: number;
    farmacia_popular_count: number;
    farmacia_popular_free_count: number;
  };
  model_used: string;
  overall_confidence: number;
  response_time_ms: number;
  // Legacy fallback fields
  medications_found?: VisionResult["medications"];
}

// --- Pharmacy Prices ---

export interface PharmacyProduct {
  name: string;
  price: number;
  url: string;
}

export interface PharmacyPriceEntry {
  products: PharmacyProduct[];
  cheapest: number | null;
  scraped_at: string | null;
}

export interface PharmacyPricesResult {
  query: string;
  prices: Record<string, PharmacyPriceEntry>;
  pmc_ceiling: number | null;
}

// --- Farmacia Popular ---

export interface FarmaciaPopularMedication {
  id: string;
  product_name: string;
  active_ingredient: string;
  manufacturer: string;
  presentation: string;
  category: string;
  farmacia_popular_free: boolean;
  pmc_price: number | null;
}

export interface FarmaciaPopularLocation {
  id: string;
  name: string;
  address: string | null;
  city: string;
  state: string;
  zipcode: string | null;
  phone: string | null;
  distance_km: number | null;
}

export interface FarmaciaPopularStats {
  total_eligible: number;
  total_free: number;
  total_discounted: number;
}

// --- API Client ---

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "/api";

async function fetchAPI<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });

  if (!res.ok) {
    throw new Error(`API error: ${res.status} ${res.statusText}`);
  }

  return res.json();
}

export async function searchMedications(
  query: string,
  state: StateCode = "SP"
): Promise<SearchResult> {
  const params = new URLSearchParams({ q: query, estado: state });
  return fetchAPI<SearchResult>(`/search?${params}`);
}

export async function searchSuggestions(
  query: string
): Promise<SearchSuggestion[]> {
  const params = new URLSearchParams({ q: query });
  return fetchAPI<SearchSuggestion[]>(`/search/suggestions?${params}`);
}

export async function getMedication(
  slug: string,
  state?: StateCode
): Promise<MedicationDetail> {
  const params = state ? `?estado=${state}` : "";
  return fetchAPI<MedicationDetail>(`/medications/${slug}${params}`);
}

export async function getMedicationEquivalents(
  id: string,
  state: StateCode = "SP"
): Promise<MedicationWithPrice[]> {
  const params = new URLSearchParams({ estado: state });
  return fetchAPI<MedicationWithPrice[]>(
    `/medications/${id}/equivalents?${params}`
  );
}

export async function analyzePrescriptionImage(
  file: File,
  state?: StateCode
): Promise<PrescriptionAnalysis> {
  const formData = new FormData();
  formData.append("file", file);
  if (state) formData.append("state", state);

  const res = await fetch(`${API_BASE}/vision/analyze`, {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    throw new Error(`API error: ${res.status} ${res.statusText}`);
  }

  return res.json();
}

export async function trackAffiliateClick(
  medicationId: string,
  pharmacy: string
): Promise<void> {
  await fetchAPI("/webhooks/affiliate-click", {
    method: "POST",
    body: JSON.stringify({ medication_id: medicationId, pharmacy }),
  });
}

export async function getTopMedications(): Promise<
  Array<{ slug: string; name: string }>
> {
  return fetchAPI<Array<{ slug: string; name: string }>>(
    "/medications/top?limit=1000"
  );
}

export async function getFarmaciaPopularList(): Promise<MedicationWithPrice[]> {
  return fetchAPI<MedicationWithPrice[]>("/medications/farmacia-popular");
}

// --- Pharmacy Prices API ---

export async function getPharmacyPrices(
  query: string,
  medicationId?: string
): Promise<PharmacyPricesResult> {
  const params = new URLSearchParams({ q: query });
  if (medicationId) params.set("medication_id", medicationId);
  return fetchAPI<PharmacyPricesResult>(`/pharmacy-prices?${params}`);
}

// --- Farmacia Popular API ---

export async function getFarmaciaPopularMedications(opts?: {
  q?: string;
  free?: boolean;
  estado?: StateCode;
  limit?: number;
  offset?: number;
}): Promise<{ medications: FarmaciaPopularMedication[]; total: number }> {
  const params = new URLSearchParams();
  if (opts?.q) params.set("q", opts.q);
  if (opts?.free !== undefined) params.set("free", String(opts.free));
  if (opts?.estado) params.set("estado", opts.estado);
  if (opts?.limit) params.set("limit", String(opts.limit));
  if (opts?.offset) params.set("offset", String(opts.offset));
  return fetchAPI(`/farmacia-popular/medications?${params}`);
}

export async function getFarmaciaPopularLocations(opts: {
  lat: number;
  lng: number;
  state?: string;
  city?: string;
  limit?: number;
}): Promise<{ locations: FarmaciaPopularLocation[] }> {
  const params = new URLSearchParams({
    lat: String(opts.lat),
    lng: String(opts.lng),
  });
  if (opts.state) params.set("state", opts.state);
  if (opts.city) params.set("city", opts.city);
  if (opts.limit) params.set("limit", String(opts.limit));
  return fetchAPI(`/farmacia-popular/locations?${params}`);
}

export async function getFarmaciaPopularStats(): Promise<FarmaciaPopularStats> {
  return fetchAPI<FarmaciaPopularStats>("/farmacia-popular/stats");
}
