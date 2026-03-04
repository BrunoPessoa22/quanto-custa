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
  file: File
): Promise<VisionResult> {
  const formData = new FormData();
  formData.append("image", file);

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
