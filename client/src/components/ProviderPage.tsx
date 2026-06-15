import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Endpoint, ProviderEarnings, StreamBalance, API_BASE } from "../types";
import { TrendingUp, Wallet } from "lucide-react";

interface ProviderPageProps {
  endpoints: Endpoint[];
  isWalletConnected: boolean;
}

export default function ProviderPage({ endpoints, isWalletConnected }: ProviderPageProps) {
  const navigate = useNavigate();
  const providerEndpoints = endpoints;
  const [selectedId, setSelectedId] = useState<string>(
    providerEndpoints.length > 0 ? providerEndpoints[0].id : ""
  );

  const selectedEndpoint = providerEndpoints.find(ep => ep.id === selectedId) || providerEndpoints[0];

  // Backend earnings state
  const [earnings, setEarnings] = useState<ProviderEarnings | null>(null);

  React.useEffect(() => {
    if (!selectedId) return;
    fetch(`${API_BASE}/api/providers/${selectedId}/earnings`)
      .then((res) => res.json())
      .then((data: ProviderEarnings) => setEarnings(data))
      .catch(() => setEarnings(null));
  }, [selectedId]);

  // Stream balance checker state
  const [streamIdInput, setStreamIdInput] = useState("");
  const [streamBalance, setStreamBalance] = useState<StreamBalance | null>(null);
  const [streamLoading, setStreamLoading] = useState(false);
  const [streamError, setStreamError] = useState<string | null>(null);

  const handleCheckBalance = () => {
    if (!streamIdInput.trim()) return;
    setStreamLoading(true);
    setStreamError(null);
    setStreamBalance(null);
    fetch(`${API_BASE}/api/streams/${streamIdInput.trim()}/balance`)
      .then((res) => {
        if (!res.ok) throw new Error("Stream not found");
        return res.json();
      })
      .then((data: StreamBalance) => setStreamBalance(data))
      .catch((err) => setStreamError(err.message || "Failed to fetch balance"))
      .finally(() => setStreamLoading(false));
  };

  // Wallet gate
  if (!isWalletConnected) {
    return (
      <div className="pb-16">
        <div className="flex items-center gap-2 text-xs font-sans text-stone-500 mb-6">
          <span onClick={() => navigate("/")} className="hover:text-black cursor-pointer transition-colors font-semibold">Flowgate</span>
          <span>/</span>
          <span className="text-stone-400">Provider Dashboard</span>
        </div>
        <div className="py-12 text-center max-w-xl mx-auto border border-dashed border-stone-300 bg-white p-8">
          <div className="w-14 h-14 rounded-full bg-stone-100 flex items-center justify-center mx-auto mb-4">
            <Wallet className="w-7 h-7 text-stone-400" />
          </div>
          <h2 className="font-sans text-xl font-bold text-[#1C1A17] mb-2">Connect your wallet</h2>
          <p className="text-sm font-sans text-stone-500 max-w-md mx-auto leading-relaxed">
            You need to connect a Sui wallet to access the Provider Dashboard and manage your endpoints.
          </p>
        </div>
      </div>
    );
  }

  if (!selectedEndpoint) {
    return (
      <div className="pb-16">
        {/* Breadcrumb line */}
        <div className="flex items-center gap-2 text-xs font-sans text-stone-500 mb-6">
          <span onClick={() => navigate("/")} className="hover:text-black cursor-pointer transition-colors font-semibold">Flowgate</span>
          <span>/</span>
          <span className="text-stone-400">Provider Dashboard</span>
        </div>

        <div className="py-12 text-center max-w-xl mx-auto border border-dashed border-stone-300 bg-white p-8 mb-10">
          <p className="text-sm font-mono text-stone-500 uppercase">No active registered endpoints under management.</p>
          <button 
            onClick={() => navigate("/register")}
            className="mt-4 px-4.5 py-2.5 bg-[#8C2C16] hover:bg-[#A63A23] text-white rounded-full text-xs font-mono font-bold tracking-wider transition-all inline-flex items-center gap-2 shadow-md hover:shadow-lg active:scale-95 cursor-pointer uppercase"
          >
            Create First Endpoint
          </button>
        </div>

        {/* Stream Balance Checker - always visible */}
        <div className="border border-stone-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-stone-150 pb-3 mb-4">
            <div>
              <h2 className="font-sans font-semibold text-lg text-[#1C1A17]">Stream Balance Checker</h2>
              <p className="text-sm text-stone-500">Query on-chain stream object balance</p>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              placeholder="Paste a Sui stream object ID..."
              value={streamIdInput}
              onChange={(e) => setStreamIdInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCheckBalance()}
              className="flex-1 bg-white border border-stone-300 focus:border-stone-800 outline-none px-4 py-2.5 text-sm font-mono text-[#1C1A17] rounded-full placeholder:text-stone-400"
            />
            <button
              onClick={handleCheckBalance}
              disabled={streamLoading || !streamIdInput.trim()}
              className="px-5 py-2.5 bg-[#1C1A17] hover:bg-[#2E2E38] disabled:opacity-50 text-[#FAF9F5] font-sans text-xs font-bold rounded-full transition-all flex items-center justify-center gap-2 shadow-md cursor-pointer shrink-0"
            >
              {streamLoading ? (
                <><span className="w-3 h-3 border-2 border-white/25 border-t-white rounded-full animate-spin" /> Querying...</>
              ) : "Check Balance"}
            </button>
          </div>
          {streamBalance && (
            <div className="mt-4 p-4 bg-[#FAF9F5] border border-stone-200 flex flex-col sm:flex-row gap-4 sm:gap-8">
              <div className="flex flex-col gap-0.5">
                <span className="text-[10px] font-sans text-stone-400 uppercase font-medium">Stream ID</span>
                <span className="text-xs font-mono text-stone-700 select-all truncate max-w-[200px]" title={streamBalance.streamId}>{streamBalance.streamId}</span>
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-[10px] font-sans text-stone-400 uppercase font-medium">Balance (MIST)</span>
                <span className="text-sm font-mono text-stone-800 font-bold">{streamBalance.balanceMist.toLocaleString()}</span>
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-[10px] font-sans text-stone-400 uppercase font-medium">Balance (SUI)</span>
                <span className="text-sm font-mono text-[#8C2C16] font-bold">{streamBalance.balanceSui.toFixed(9)} SUI</span>
              </div>
            </div>
          )}
          {streamError && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 text-xs font-sans text-red-700 rounded-xl">
              {streamError}
            </div>
          )}
        </div>
      </div>
    );
  }

  const totalEarnedSui = earnings ? earnings.totalEarnedMist / 1_000_000_000 : 0;

  return (
    <div className="pb-16">
      
      {/* Breadcrumb line */}
      <div className="flex items-center gap-2 text-xs font-sans text-stone-500 mb-6">
        <span onClick={() => navigate("/")} className="hover:text-black cursor-pointer transition-colors font-semibold">Flowgate</span>
        <span>/</span>
        <span className="text-stone-400">Provider Dashboard</span>
      </div>

      {/* Flag Header & Selector */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 mb-10 border-b border-stone-300 pb-6">
        <div>
          <h1 className="font-sans text-3xl font-bold text-[#1C1A17]">
            Provider Dashboard
          </h1>
          <p className="text-sm text-stone-500 mt-0.5">
            Manage your endpoints and monitor earnings.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0 bg-white border border-stone-250 px-4 py-2">
          <span className="text-xs font-sans text-stone-400 font-medium">Select endpoint:</span>
          <select
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
            className="bg-white border-0 text-xs font-mono text-[#1C1A17] focus:ring-0 outline-none uppercase font-bold cursor-pointer"
          >
            {providerEndpoints.map(ep => (
              <option key={ep.id} value={ep.id}>
                {ep.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* TOP LEVEL METRICS SUMMARY */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
        
        <div className="p-4 border border-stone-200 bg-white">
          <span className="text-xs font-sans text-stone-400 block">Total Revenue</span>
          <span className="font-sans text-2xl font-bold text-emerald-800 mt-1 block">
            {totalEarnedSui.toFixed(4)} SUI
          </span>
          <span className="text-xs font-sans text-emerald-700 flex items-center gap-1 mt-1 font-medium">
            <TrendingUp className="w-3.5 h-3.5" />
            Earnings
          </span>
        </div>

        <div className="p-4 border border-stone-200 bg-white">
          <span className="text-xs font-sans text-stone-400 block">Active Consumers</span>
          <span className="font-sans text-2xl font-bold text-[#1C1A17] mt-1 block">
            {selectedEndpoint.activeConsumers} Connected
          </span>
          <span className="text-xs font-sans text-[#8C2C16] mt-1 block font-medium">Payments Active</span>
        </div>

        <div className="p-4 border border-stone-200 bg-white">
          <span className="text-xs font-sans text-stone-400 block">Total Requests</span>
          <span className="font-sans text-2xl font-bold text-[#1C1A17] mt-1 block">
            {selectedEndpoint.totalRequests.toLocaleString()}
          </span>
        </div>

        <div className="p-4 border border-stone-200 bg-white">
          <span className="text-xs font-sans text-stone-400 block">Avg Latency</span>
          <span className="font-sans text-2xl font-bold text-[#8C2C16] mt-1 block">
            {selectedEndpoint.latency}ms
          </span>
        </div>

      </div>

      {/* Stream Balance Checker */}
      <div className="border border-stone-200 bg-white p-6 shadow-sm mb-10">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-stone-150 pb-3 mb-4">
          <div>
            <h2 className="font-sans font-semibold text-lg text-[#1C1A17]">Stream Balance Checker</h2>
            <p className="text-sm text-stone-500">Query on-chain stream object balance</p>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            placeholder="Paste a Sui stream object ID..."
            value={streamIdInput}
            onChange={(e) => setStreamIdInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleCheckBalance()}
            className="flex-1 bg-white border border-stone-300 focus:border-stone-800 outline-none px-4 py-2.5 text-sm font-mono text-[#1C1A17] rounded-full placeholder:text-stone-400"
          />
          <button
            onClick={handleCheckBalance}
            disabled={streamLoading || !streamIdInput.trim()}
            className="px-5 py-2.5 bg-[#1C1A17] hover:bg-[#2E2E38] disabled:opacity-50 text-[#FAF9F5] font-sans text-xs font-bold rounded-full transition-all flex items-center justify-center gap-2 shadow-md cursor-pointer shrink-0"
          >
            {streamLoading ? (
              <><span className="w-3 h-3 border-2 border-white/25 border-t-white rounded-full animate-spin" /> Querying...</>
            ) : "Check Balance"}
          </button>
        </div>
        {streamBalance && (
          <div className="mt-4 p-4 bg-[#FAF9F5] border border-stone-200 flex flex-col sm:flex-row gap-4 sm:gap-8">
            <div className="flex flex-col gap-0.5">
              <span className="text-[10px] font-sans text-stone-400 uppercase font-medium">Stream ID</span>
              <span className="text-xs font-mono text-stone-700 select-all truncate max-w-[200px]" title={streamBalance.streamId}>{streamBalance.streamId}</span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-[10px] font-sans text-stone-400 uppercase font-medium">Balance (MIST)</span>
              <span className="text-sm font-mono text-stone-800 font-bold">{streamBalance.balanceMist.toLocaleString()}</span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-[10px] font-sans text-stone-400 uppercase font-medium">Balance (SUI)</span>
              <span className="text-sm font-mono text-[#8C2C16] font-bold">{streamBalance.balanceSui.toFixed(9)} SUI</span>
            </div>
          </div>
        )}
        {streamError && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 text-xs font-sans text-red-700 rounded-xl">
            {streamError}
          </div>
        )}
      </div>

      {/* connected clients list */}
      <div className="border border-stone-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between border-b border-stone-150 pb-3 mb-4">
          <div>
            <h2 className="font-sans font-semibold text-lg text-[#1C1A17]">Connected Clients</h2>
            <p className="text-sm text-stone-500">Active consumers paying for your data</p>
          </div>
          <span className="px-2.5 py-0.5 border border-stone-300 text-stone-500 bg-stone-50 font-sans text-xs font-bold">
            0 Channels
          </span>
        </div>
        <div className="py-12 text-center text-stone-400 font-sans text-sm border border-dashed border-stone-200 bg-stone-50/50 rounded-xl">
          <p>No active consumer escrows currently streaming funds.</p>
          <p className="text-xs text-stone-300 mt-1">Consumer data will appear here once agents begin using your endpoint.</p>
        </div>
      </div>

    </div>
  );
}
