"use client";

import { useState } from "react";
import {
  MapPin,
  Navigation,
  Loader2,
  Phone,
  Building2,
  AlertCircle,
} from "lucide-react";
import {
  getFarmaciaPopularLocations,
  type FarmaciaPopularLocation,
} from "@/lib/api";
import { BRAZILIAN_STATES } from "@/lib/constants";

export default function FarmaciaPopularLocator() {
  const [locations, setLocations] = useState<FarmaciaPopularLocation[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);
  const [selectedState, setSelectedState] = useState("");

  async function handleGeolocation() {
    if (!("geolocation" in navigator)) {
      setError("Geolocalizacao nao disponivel no seu navegador.");
      return;
    }

    setLoading(true);
    setError(null);

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const result = await getFarmaciaPopularLocations({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            limit: 10,
          });
          setLocations(result.locations);
          setSearched(true);
        } catch {
          setError("Erro ao buscar farmacias. Tente novamente.");
        } finally {
          setLoading(false);
        }
      },
      () => {
        setError(
          "Nao foi possivel obter sua localizacao. Selecione seu estado abaixo."
        );
        setLoading(false);
      },
      { timeout: 10000, enableHighAccuracy: false }
    );
  }

  async function handleStateSearch() {
    if (!selectedState) return;

    setLoading(true);
    setError(null);

    try {
      // Use a central coordinate for the state capital as fallback
      const result = await getFarmaciaPopularLocations({
        lat: -15.7801,
        lng: -47.9292,
        state: selectedState,
        limit: 20,
      });
      setLocations(result.locations);
      setSearched(true);
    } catch {
      setError("Erro ao buscar farmacias. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Search options */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <button
          onClick={handleGeolocation}
          disabled={loading}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-teal-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-50"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Navigation className="h-4 w-4" />
          )}
          Usar minha localizacao
        </button>

        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500">ou</span>
          <select
            value={selectedState}
            onChange={(e) => setSelectedState(e.target.value)}
            className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900"
          >
            <option value="">Selecione o estado</option>
            {BRAZILIAN_STATES.map((s) => (
              <option key={s.code} value={s.code}>
                {s.code} - {s.name}
              </option>
            ))}
          </select>
          <button
            onClick={handleStateSearch}
            disabled={!selectedState || loading}
            className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            Buscar
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Results */}
      {searched && locations.length === 0 && !loading && (
        <p className="text-sm text-gray-500">
          Nenhuma farmacia credenciada encontrada nessa regiao.
        </p>
      )}

      {locations.length > 0 && (
        <div className="space-y-2">
          {locations.map((loc) => (
            <div
              key={loc.id}
              className="rounded-lg border border-gray-200 bg-white p-4"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 shrink-0 text-teal-600" />
                    <p className="text-sm font-semibold text-gray-900 truncate">
                      {loc.name}
                    </p>
                  </div>
                  {loc.address && (
                    <p className="mt-1 text-sm text-gray-500">{loc.address}</p>
                  )}
                  <p className="mt-0.5 text-xs text-gray-400">
                    {loc.city} - {loc.state}
                    {loc.zipcode ? ` | CEP: ${loc.zipcode}` : ""}
                  </p>
                  {loc.phone && (
                    <p className="mt-1 flex items-center gap-1 text-xs text-gray-500">
                      <Phone className="h-3 w-3" />
                      {loc.phone}
                    </p>
                  )}
                </div>
                {loc.distance_km != null && (
                  <div className="shrink-0 text-right">
                    <div className="flex items-center gap-1 text-sm font-medium text-teal-600">
                      <MapPin className="h-3.5 w-3.5" />
                      {loc.distance_km.toFixed(1)} km
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
