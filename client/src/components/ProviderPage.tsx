import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Endpoint, ConsumerMetric } from "../types";
import { 
  Activity, 
  Cpu, 
  Trash2, 
  TrendingUp, 
  Server, 
  ChevronRight,
  Sliders,
  DollarSign
} from "lucide-react";

interface ProviderPageProps {
  endpoints: Endpoint[];
  onUpdateEndpointPrice: (id: string, price: number) => void;
  onUpdateEndpointStatus: (id: string, status: Endpoint["status"]) => void;
}

export default function ProviderPage({ 
  endpoints, 
  onUpdateEndpointPrice, 
  onUpdateEndpointStatus 
}: ProviderPageProps) {
  const navigate = useNavigate();
  const providerEndpoints = endpoints;
  const [selectedId, setSelectedId] = useState<string>(
    providerEndpoints.length > 0 ? providerEndpoints[0].id : ""
  );

  const selectedEndpoint = providerEndpoints.find(ep => ep.id === selectedId) || providerEndpoints[0];

  // Pricing slider state initialized relative to the selected endpoint's price
  const [sliderPrice, setSliderPrice] = useState<number>(selectedEndpoint ? selectedEndpoint.price : 0.12);

  // Sync pricing slider when endpoint changes
  React.useEffect(() => {
    if (selectedEndpoint) {
      setSliderPrice(selectedEndpoint.price);
    }
  }, [selectedId]);

  // Simulated active data consumers table
  const [consumers, setConsumers] = useState<ConsumerMetric[]>([
    { id: "c1", clientAddress: "sui:addr_7f29a0de...4cc2", activeStreams: 5, accumulatedSui: 84.20, lastPaymentTime: "12:14:15", burnRate: 0.12 },
    { id: "c2", clientAddress: "sui:addr_1c8df4f2...3aa2", activeStreams: 12, accumulatedSui: 45.90, lastPaymentTime: "12:14:11", burnRate: 0.35 },
    { id: "c3", clientAddress: "sui:addr_b8f0ca44...9de1", activeStreams: 2, accumulatedSui: 11.55, lastPaymentTime: "12:12:00", burnRate: 0.05 },
    { id: "c4", clientAddress: "sui:addr_a8de9bb2...19fa", activeStreams: 8, accumulatedSui: 37.80, lastPaymentTime: "12:14:14", burnRate: 0.20 }
  ]);

  const handlePriceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value);
    setSliderPrice(value);
    if (selectedEndpoint) {
      onUpdateEndpointPrice(selectedEndpoint.id, value);
    }
  };

  const handleStatusChange = (status: Endpoint["status"]) => {
    if (selectedEndpoint) {
      onUpdateEndpointStatus(selectedEndpoint.id, status);
    }
  };

  const handleDropConsumer = (id: string) => {
    setConsumers(consumers.filter(c => c.id !== id));
  };

  // Hardware stats animation mock
  const [hardware, setHardware] = useState({
    cpu: 42,
    memory: "78.4 GB",
    ioLoad: 18.2,
    packetLoss: "0.00% SECURE",
    activeThreads: 144
  });

  // Random hardware telemetry fluctuator
  React.useEffect(() => {
    const timer = setInterval(() => {
      setHardware(prev => {
        const cpuFluct = (Math.random() * 6 - 3);
        const newCpu = Math.max(10, Math.min(95, Math.floor(prev.cpu + cpuFluct)));
        return {
          ...prev,
          cpu: newCpu,
          ioLoad: parseFloat((Math.max(1, prev.ioLoad + (Math.random() * 2 - 1))).toFixed(1))
        };
      });
    }, 3000);
    return () => clearInterval(timer);
  }, []);

  if (!selectedEndpoint) {
    return (
      <div className="py-12 text-center max-w-xl mx-auto border border-dashed border-stone-300 bg-white p-8">
        <p className="text-sm font-mono text-stone-500 uppercase">No active registered endpoints under management.</p>
        <button 
          onClick={() => navigate("/register")}
          className="mt-4 px-4.5 py-2.5 bg-[#8C2C16] hover:bg-[#A63A23] text-white rounded-full text-xs font-mono font-bold tracking-wider transition-all inline-flex items-center gap-2 shadow-md hover:shadow-lg active:scale-95 cursor-pointer uppercase"
        >
          Create First Endpoint
        </button>
      </div>
    );
  }

  const accumulatedRevenue = consumers.reduce((acc, curr) => acc + curr.accumulatedSui, 0) + (selectedEndpoint.totalRequests * (selectedEndpoint.price / 1000));

  const [realEarningsSui, setRealEarningsSui] = useState<number>(0);

  React.useEffect(() => {
    if (!selectedId) return;

    const fetchEarnings = async () => {
      try {
        const res = await fetch(`http://localhost:3001/api/providers/${selectedId}/earnings`);
        if (res.ok) {
          const data = await res.json();
          setRealEarningsSui(data.totalEarnedMist / 1_000_000_000);
        }
      } catch (e) {
        // ignore
      }
    };

    fetchEarnings();
    const interval = setInterval(fetchEarnings, 10000);
    return () => clearInterval(interval);
  }, [selectedId]);

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
            Manage your endpoints, pricing, and connected clients.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0 bg-white border border-stone-250 px-4 py-2">            <span className="text-xs font-sans text-stone-400 font-medium">Select endpoint:</span>
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
            Total Earned: {realEarningsSui > 0 ? realEarningsSui.toFixed(4) : (accumulatedRevenue + 740).toFixed(2)} SUI
          </span>
          <span className="text-xs font-sans text-emerald-700 flex items-center gap-1 mt-1 font-medium">
            <TrendingUp className="w-3.5 h-3.5" />
            +14.8% growth
          </span>
        </div>

        <div className="p-4 border border-stone-200 bg-white">
          <span className="text-xs font-sans text-stone-400 block">Active Clients</span>
          <span className="font-sans text-2xl font-bold text-[#1C1A17] mt-1 block">
            {consumers.length} Client streams
          </span>
          <span className="text-xs font-sans text-[#8C2C16] mt-1 block font-medium">Payments Active</span>
        </div>

        <div className="p-4 border border-stone-200 bg-white">
          <span className="text-xs font-sans text-stone-400 block">Total Requests</span>
          <span className="font-sans text-2xl font-bold text-[#1C1A17] mt-1 block">
            {Math.max(14022, selectedEndpoint.totalRequests + 518293).toLocaleString()} COMP
          </span>
          <span className="text-xs font-sans text-stone-400 mt-1 block">All threads active</span>
        </div>

        <div className="p-4 border border-stone-200 bg-white">
          <span className="text-xs font-sans text-stone-400 block">Avg Latency</span>
          <span className="font-sans text-2xl font-bold text-[#8C2C16] mt-1 block">
            {selectedEndpoint.latency} Milliseconds
          </span>
          <span className="text-xs font-sans text-emerald-700 mt-1 block font-medium">99.98% optimal</span>
        </div>

      </div>

      {/* CONTROL GRIDS */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mb-10">
        
        {/* pricing sliders (left) */}
        <div className="lg:col-span-7 border border-stone-200 bg-white p-6 shadow-sm flex flex-col justify-between">
          <div>
            <div className="border-b border-stone-150 pb-3 mb-5">
              <h2 className="font-sans font-semibold text-lg text-[#1C1A17]">Pricing</h2>
              <p className="text-sm text-stone-500">Adjust your per-unit pricing for this endpoint</p>
            </div>

            <div className="p-5 bg-[#FCFBF9] border border-stone-200 flex flex-col gap-4">
              <div className="flex items-center justify-between text-sm font-sans">
                <span className="text-stone-500 font-medium">Price per unit (SUI)</span>
                <span className="font-sans text-base font-bold text-[#1C1A17]">
                  {sliderPrice.toFixed(4)} SUI / {selectedEndpoint.unit}
                </span>
              </div>

              <input 
                type="range" 
                min="0.01" 
                max="5.00" 
                step="0.01"
                value={sliderPrice}
                onChange={handlePriceChange}
                className="w-full accent-[#8C2C16] h-1.5 bg-stone-200 cursor-pointer"
              />

              <div className="flex justify-between text-xs font-sans text-stone-400">
                <span>0.01 SUI</span>
                <span>2.50 SUI</span>
                <span>5.00 SUI</span>
              </div>

              <div className="border-t border-stone-200 pt-3 flex flex-col gap-1.5 text-sm font-sans text-stone-500">
                <div className="flex justify-between">
                  <span>Est. hourly burn rate</span>
                  <span className="text-stone-800 font-bold">~{ (sliderPrice * 12.5).toFixed(2) } SUI / hour</span>
                </div>
                <div className="flex justify-between">
                  <span>Per-block cost</span>
                  <span className="text-emerald-800 font-semibold">{(sliderPrice * 0.015).toFixed(4)} SUI</span>
                </div>
              </div>
            </div>
          </div>

          {/* Quick status controls */}
          <div className="flex flex-col sm:flex-row items-baseline sm:items-center justify-between border-t border-stone-200 pt-5 mt-6 gap-4">
            <div className="flex flex-col">
              <span className="text-sm font-sans text-stone-500 font-medium">Override Status</span>
              <span className="text-xs font-sans text-stone-400">Changes the endpoint status on the network</span>
            </div>

            <div className="flex items-center gap-2">
              {[
                { id: "active", label: "ACTIVE", color: "bg-emerald-50 text-emerald-850 border-emerald-300 font-bold" },
                { id: "degraded", label: "DEGRADED", color: "bg-amber-50 text-amber-850 border-amber-300 font-semibold" },
                { id: "offline", label: "OFFLINE", color: "bg-stone-100 text-stone-600 border-stone-300" }
              ].map((st) => (
                <button
                  key={st.id}
                  onClick={() => handleStatusChange(st.id as Endpoint["status"])}
                  className={`px-3.5 py-1.5 border font-mono text-[9px] tracking-wider uppercase transition-all rounded-full cursor-pointer ${
                    selectedEndpoint.status === st.id 
                      ? st.color + " border-2 scale-105" 
                      : "bg-white text-stone-500 border-stone-250 hover:bg-stone-50"
                  }`}
                >
                  {st.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* hardware telemetries (right) */}
        <div className="lg:col-span-5 border border-stone-200 bg-white p-6 shadow-sm flex flex-col justify-between">
          <div className="flex flex-col gap-4">
            <div className="border-b border-stone-150 pb-3">
              <h2 className="font-sans font-semibold text-lg text-[#1C1A17]">System Health</h2>
              <p className="text-sm text-stone-500">Real-time hardware and network metrics</p>
            </div>

            <div className="flex flex-col gap-3 font-sans text-sm">
              
              <div className="flex justify-between items-center bg-[#FCFBF9] px-3 py-3 border border-stone-150 rounded-xl">
                <span className="text-stone-500 text-xs font-medium">CPU usage:</span>
                <div className="flex items-center gap-3">
                  <div className="w-16 bg-stone-200 h-1 rounded-none overflow-hidden">
                    <div className="h-full bg-stone-850" style={{ width: `${hardware.cpu}%` }} />
                  </div>
                  <span className="text-stone-900 font-bold">{hardware.cpu}%</span>
                </div>
              </div>

              <div className="flex justify-between items-center bg-[#FCFBF9] px-3 py-3 border border-stone-150 rounded-xl">
                <span className="text-stone-500 text-xs font-medium">Memory:</span>
                <span className="text-stone-850 font-semibold select-all text-right">{hardware.memory}</span>
              </div>

              <div className="flex justify-between items-center bg-[#FCFBF9] px-3 py-3 border border-stone-150 rounded-xl">
                <span className="text-stone-500 text-xs font-medium">Disk throughput:</span>
                <span className="text-stone-850 font-bold">{hardware.ioLoad} GB/s</span>
              </div>

              <div className="flex justify-between items-center bg-[#FCFBF9] px-3 py-3 border border-stone-150 rounded-xl">
                <span className="text-stone-500 text-xs font-medium">Packet loss:</span>
                <span className="text-emerald-800 font-bold">{hardware.packetLoss}</span>
              </div>

            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-stone-150 text-xs font-sans text-stone-400 flex items-center gap-2">
            <Server className="w-4 h-4 text-stone-400 shrink-0" />
            <span>Secure engine active at block 44,902</span>
          </div>
        </div>

      </div>

      {/* connected clients list */}
      <div className="border border-stone-200 bg-white p-6 shadow-sm">
        
        <div className="flex items-center justify-between border-b border-stone-150 pb-3 mb-4">
          <div>
            <h2 className="font-sans font-semibold text-lg text-[#1C1A17]">Connected Clients</h2>
            <p className="text-sm text-stone-500">Active consumers paying for your data</p>
          </div>
          <span className="px-2.5 py-0.5 border border-emerald-300 text-emerald-800 bg-emerald-50 font-sans text-xs font-bold">
            {consumers.length} Channels Connected
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left font-mono text-xs border-collapse">
            <thead>
              <tr className="text-xs text-stone-400 border-b border-stone-200 bg-stone-50">
                <th className="py-3 px-3 font-semibold text-left">Address</th>
                <th className="py-3 px-3 font-semibold text-left">Streams</th>
                <th className="py-3 px-3 font-semibold text-left">Burn Rate</th>
                <th className="py-3 px-3 font-semibold text-left">Earned</th>
                <th className="py-3 px-3 font-semibold text-left">Last Payment</th>
                <th className="py-3 px-3 font-semibold text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-150">
              {consumers.length > 0 ? (
                consumers.map((c) => (
                  <tr key={c.id} className="hover:bg-stone-50/50 transition-colors">
                    <td className="py-3.5 px-3 text-stone-800 font-medium select-all text-xs">{c.clientAddress}</td>
                    <td className="py-3.5 px-3 text-stone-500">{c.activeStreams}</td>
                    <td className="py-3.5 px-3 text-[#8C2C16] font-semibold">{(c.burnRate * sliderPrice).toFixed(4)} SUI/s</td>
                    <td className="py-3.5 px-3 text-emerald-800 font-bold">{c.accumulatedSui.toFixed(2)} SUI</td>
                    <td className="py-3.5 px-3 text-stone-400">{c.lastPaymentTime}</td>
                    <td className="py-3.5 px-3 text-right">
                      <button 
                        onClick={() => handleDropConsumer(c.id)}
                        className="px-3 py-1 border border-stone-200 hover:border-red-650 hover:bg-[#8C2C16]/5 text-stone-500 hover:text-red-850 transition-all flex items-center gap-1.5 ml-auto cursor-pointer rounded-full text-xs font-semibold"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>KICK</span>
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-stone-400 font-sans text-sm">
                    No active consumer escrows currently streaming funds.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

      </div>

    </div>
  );
}
