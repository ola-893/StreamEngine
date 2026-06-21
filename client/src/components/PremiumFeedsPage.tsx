import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { API_BASE } from "../types";
import {
  Loader2,
  Database,
  Plus,
  ExternalLink,
  Zap,
  Globe,
  Tag,
} from "lucide-react";

interface RegisteredProvider {
  id: string;
  name: string;
  description: string;
  endpoint: string;
  websiteUrl: string;
  ratePerSecond: number;
  category: string;
  providerAddress: string;
}

const CATEGORY_ICONS: Record<string, string> = {
  "Data Feed": "📊",
  "Social Media": "💬",
  Finance: "📈",
  Research: "🔬",
  Compute: "⚡",
  API: "🔗",
  General: "📦",
};

export default function PremiumFeedsPage() {
  const navigate = useNavigate();
  const [providers, setProviders] = useState<RegisteredProvider[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchProviders = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/providers`);
      const data = await res.json();
      setProviders(data.providers || []);
    } catch {
      setProviders([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProviders();
  }, [fetchProviders]);

  return (
    <div className="pb-16">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-xs font-sans text-stone-500 mb-6">
        <span
          onClick={() => navigate("/")}
          className="hover:text-black cursor-pointer transition-colors font-semibold"
        >
          Flowgate
        </span>
        <span>/</span>
        <span className="text-stone-400">Marketplace</span>
      </div>

      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6 sm:mb-10 border-b border-stone-300 pb-6">
        <div>
          <h1 className="font-sans text-2xl sm:text-3xl font-bold text-[#1C1A17]">
            Marketplace
          </h1>
          <p className="text-xs sm:text-sm text-stone-500 mt-1">
            Browse API endpoints registered by providers. Agents pay per-second
            via Sui payment streams to access data.
          </p>
        </div>
        <button
          onClick={() => navigate("/register")}
          className="px-4 sm:px-5 py-2.5 bg-[#8C2C16] hover:bg-[#A63A23] text-white rounded-full text-xs sm:text-sm font-sans font-bold transition-all flex items-center gap-2 shadow-md hover:shadow-lg active:scale-95 cursor-pointer shrink-0"
        >
          <Plus className="w-4 h-4" />
          Register Endpoint
        </button>
      </div>

      {/* Provider cards */}
      {loading ? (
        <div className="flex items-center justify-center py-12 gap-3 text-sm font-sans text-stone-400">
          <Loader2 className="w-5 h-5 animate-spin" />
          Loading marketplace...
        </div>
      ) : providers.length === 0 ? (
        <div className="p-12 text-center">
          <Database className="w-10 h-10 text-stone-200 mx-auto mb-3" />
          <p className="text-sm font-sans font-bold text-[#1C1A17]">
            No providers registered yet
          </p>
          <p className="text-xs text-stone-400 mt-1 mb-4">
            Register your first API endpoint to list it on the marketplace.
          </p>
          <button
            onClick={() => navigate("/register")}
            className="px-5 py-2.5 bg-[#8C2C16] hover:bg-[#A63A23] text-white rounded-full text-sm font-sans font-bold transition-all"
          >
            Register Endpoint
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {providers.map((provider) => (
            <div
              key={provider.id}
              className="border border-stone-200 bg-white p-4 sm:p-6 shadow-sm flex flex-col gap-3 sm:gap-4 hover:border-[#8C2C16] hover:shadow-md transition-all min-w-0"
            >
              {/* Header */}
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <div className="w-9 h-9 rounded-full bg-[#1C1A17] text-[#FAF9F5] flex items-center justify-center font-mono text-sm shrink-0">
                    {CATEGORY_ICONS[provider.category] || "📦"}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="font-sans font-bold text-base sm:text-lg text-[#1C1A17] truncate">
                      {provider.name}
                    </h3>
                    <span className="text-[10px] font-sans text-stone-400 uppercase tracking-wider">
                      {provider.category}
                    </span>
                  </div>
                </div>
                <span className="px-2 py-0.5 border border-emerald-300 text-emerald-700 bg-emerald-50 font-sans text-[10px] font-bold uppercase shrink-0">
                  Live
                </span>
              </div>

              {/* Description */}
              <p className="text-xs sm:text-sm font-sans text-stone-500 leading-relaxed line-clamp-2">
                {provider.description || "No description provided."}
              </p>

              {/* Details */}
              <div className="flex flex-col text-[11px] sm:text-xs font-sans">
                <div className="flex items-center justify-between gap-2 py-2 border-t border-stone-100">
                  <div className="flex items-center gap-1.5 text-stone-400 shrink-0">
                    <Zap className="w-3 h-3" />
                    <span>Rate</span>
                  </div>
                  <span className="font-mono font-bold text-[#8C2C16] text-right min-w-0">
                    <span className="truncate block">{provider.ratePerSecond.toLocaleString()} MIST/s</span>
                    <span className="text-stone-400 font-normal text-[9px] sm:text-[10px] hidden sm:block">
                      ({(provider.ratePerSecond / 1_000_000_000).toFixed(6)} SUI/s)
                    </span>
                  </span>
                </div>

                <div className="flex items-center justify-between gap-2 py-2 border-t border-stone-100">
                  <div className="flex items-center gap-1.5 text-stone-400 shrink-0">
                    <Globe className="w-3 h-3" />
                    <span>Endpoint</span>
                  </div>
                  <span className="font-mono text-[10px] text-stone-600 truncate min-w-0">
                    {provider.endpoint}
                  </span>
                </div>

                <div className="flex items-center justify-between gap-2 py-2 border-t border-stone-100">
                  <div className="flex items-center gap-1.5 text-stone-400 shrink-0">
                    <Tag className="w-3 h-3" />
                    <span>Website</span>
                  </div>
                  <a
                    href={provider.websiteUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-mono text-[10px] text-[#8C2C16] hover:underline inline-flex items-center gap-0.5 truncate min-w-0"
                  >
                    {provider.websiteUrl.replace(/^https?:\/\//, "").slice(0, 25)}
                    <ExternalLink className="w-2.5 h-2.5 shrink-0" />
                  </a>
                </div>
              </div>

              {/* Provider address */}
              <div className="pt-2 border-t border-stone-100">
                <span className="text-[9px] font-mono text-stone-400">
                  Provider:{" "}
                  {provider.providerAddress.slice(0, 10)}...
                  {provider.providerAddress.slice(-4)}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
