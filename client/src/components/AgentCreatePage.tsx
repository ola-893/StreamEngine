import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
import { ConnectButton } from "@mysten/dapp-kit-react/ui";
import { Endpoint, Agent } from "../types";
import {
  Bot,
  ArrowRight,
  ArrowLeft,
  Check,
  Cpu,
  Globe,
  Shield,
  Wallet,
  Play,
  Sparkles,
  Settings,
  Search,
  Activity,
  Server,
  Database,
} from "lucide-react";

interface AgentCreatePageProps {
  isWalletConnected: boolean;
  walletAddress: string | null;
  suiBalance: number;
  endpoints: Endpoint[];
  onDeploy: (agent: Agent) => void;
}

interface AgentConfig {
  name: string;
  description: string;
  purpose: string;
  selectedEndpoints: string[];
  maxBudgetSui: number;
  autoRefill: boolean;
  requestsPerMinute: number;
  scrapeInterval: string;
}

const PURPOSE_OPTIONS = [
  { id: "research", label: "Research & Analysis", desc: "Aggregate data for market research, sentiment analysis, or academic studies", icon: <Search className="w-5 h-5" /> },
  { id: "trading", label: "Trading Signals", desc: "Fetch real-time financial data to power trading algorithms", icon: <Activity className="w-5 h-5" /> },
  { id: "monitoring", label: "Brand Monitoring", desc: "Track mentions, reviews, and social media across platforms", icon: <Globe className="w-5 h-5" /> },
  { id: "content", label: "Content Generation", desc: "Feed verified data into LLM pipelines for content creation", icon: <Sparkles className="w-5 h-5" /> },
  { id: "custom", label: "Custom Agent", desc: "Build a fully custom scraping agent with your own logic", icon: <Settings className="w-5 h-5" /> },
];

const INTERVAL_OPTIONS = [
  { value: "realtime", label: "Real-time", desc: "Continuous streaming" },
  { value: "5s", label: "Every 5s", desc: "High frequency" },
  { value: "30s", label: "Every 30s", desc: "Balanced" },
  { value: "5m", label: "Every 5 min", desc: "Periodic" },
  { value: "1h", label: "Every hour", desc: "Low frequency" },
];

export default function AgentCreatePage({
  isWalletConnected,
  walletAddress,
  suiBalance,
  endpoints,
  onDeploy,
}: AgentCreatePageProps) {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [agent, setAgent] = useState<AgentConfig>({
    name: "",
    description: "",
    purpose: "",
    selectedEndpoints: [],
    maxBudgetSui: 10,
    autoRefill: true,
    requestsPerMinute: 60,
    scrapeInterval: "30s",
  });
  const [deployed, setDeployed] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const filteredEndpoints = endpoints.filter(
    (ep) =>
      ep.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ep.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ep.dataProvider.toLowerCase().includes(searchQuery.toLowerCase())
  );
  const selectedEndpointsList = endpoints.filter((ep) =>
    agent.selectedEndpoints.includes(ep.id)
  );
  const estimatedCostPerHour = selectedEndpointsList.reduce(
    (sum, ep) => sum + ep.price * 3600,
    0
  );

  const toggleEndpoint = (id: string) => {
    setAgent((prev) => ({
      ...prev,
      selectedEndpoints: prev.selectedEndpoints.includes(id)
        ? prev.selectedEndpoints.filter((e) => e !== id)
        : [...prev.selectedEndpoints, id],
    }));
  };

  const canProceed = () => {
    if (step === 1) return agent.name.trim().length > 0 && agent.purpose.length > 0;
    if (step === 2) return agent.selectedEndpoints.length > 0;
    if (step === 3) return agent.maxBudgetSui > 0;
    return true;
  };

  const handleDeploy = async () => {
    try {
      const res = await fetch("http://localhost:3001/api/agents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: agent.name,
          description: agent.description,
          purpose: agent.purpose,
          budgetMist: Math.floor(agent.maxBudgetSui * 1_000_000_000)
        })
      });
      const data = await res.json();
      const newAgent: Agent = {
        id: data.id,
        name: data.name,
        description: data.description || "",
        purpose: data.purpose,
        selectedEndpoints: agent.selectedEndpoints,
        maxBudgetSui: data.budgetMist / 1_000_000_000,
        currentSpendSui: data.spentMist / 1_000_000_000,
        autoRefill: agent.autoRefill,
        scrapeInterval: agent.scrapeInterval,
        status: "active",
        createdAt: data.createdAt,
        totalRequests: 0,
      };
      onDeploy(newAgent);
      setDeployed(true);
    } catch (e) {
      console.error(e);
    }
  };

  const stepLabels = [
    { id: 1, label: "Identity", desc: "Name & purpose" },
    { id: 2, label: "Data Sources", desc: "Select endpoints" },
    { id: 3, label: "Budget", desc: "Fund escrow" },
    { id: 4, label: "Deploy", desc: "Launch agent" },
  ];

  if (deployed) {
    return (
      <div className="min-h-screen bg-[#E5E5ED] flex flex-col">
        <div className="w-full px-6 pt-6">
          <div className="max-w-3xl mx-auto">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5 cursor-pointer" onClick={() => navigate("/")}>
                <div className="flex items-center gap-1 bg-[#1C1A17] text-[#E5E5ED] p-2 leading-none font-black text-sm tracking-tighter">
                  <span>Σ</span><span>N</span>
                </div>
                <span className="font-sans text-xs font-bold">FLOWGATE</span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex-1 flex items-center justify-center px-6 pb-12">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="max-w-lg w-full flex flex-col items-center text-center gap-8"
          >
            <div className="w-24 h-24 rounded-full bg-emerald-50 border-2 border-emerald-200 flex items-center justify-center">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
              >
                <Bot className="w-12 h-12 text-emerald-600" />
              </motion.div>
            </div>

            <div className="flex flex-col gap-3">
              <h1 className="font-sans text-4xl font-bold text-[#1C1A17]">
                Agent "{agent.name}" deployed!
              </h1>
              <p className="text-sm text-stone-600 max-w-md leading-relaxed">
                Your AI agent is now live on FlowGate. It will automatically scrape and pay for data from{" "}
                <strong>{agent.selectedEndpoints.length} endpoints</strong> using your funded escrow.
              </p>
            </div>

            <div className="w-full bg-[#FAF9F6] border border-stone-200 rounded-2xl p-6 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-stone-100">
                <span className="text-xs font-sans text-stone-400 font-medium">Agent Status</span>
                <span className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 text-emerald-700 rounded-full text-xs font-sans font-bold">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  ACTIVE
                </span>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white p-3 border border-stone-100 rounded-xl">
                  <span className="text-xs font-sans text-stone-400 block mb-1">Escrow Balance</span>
                  <span className="font-sans text-lg font-bold text-[#8C2C16]">{agent.maxBudgetSui.toFixed(2)} SUI</span>
                </div>
                <div className="bg-white p-3 border border-stone-100 rounded-xl">
                  <span className="text-xs font-sans text-stone-400 block mb-1">Connected Sources</span>
                  <span className="font-sans text-lg font-bold text-[#1C1A17]">{agent.selectedEndpoints.length}</span>
                </div>
                <div className="bg-white p-3 border border-stone-100 rounded-xl">
                  <span className="text-xs font-sans text-stone-400 block mb-1">Est. Burn Rate</span>
                  <span className="font-sans text-lg font-bold text-[#1C1A17]">{estimatedCostPerHour.toFixed(4)} SUI/h</span>
                </div>
                <div className="bg-white p-3 border border-stone-100 rounded-xl">
                  <span className="text-xs font-sans text-stone-400 block mb-1">Interval</span>
                  <span className="font-sans text-lg font-bold text-[#1C1A17]">{agent.scrapeInterval}</span>
                </div>
              </div>

              <div className="bg-[#1C1A17] text-[#8AF2D0] p-4 rounded-xl font-mono text-[10px] space-y-0.5 overflow-x-auto whitespace-pre">
                <p className="text-white/40">// Agent Config Snapshot</p>
                <p>name: "{agent.name}"</p>
                <p>purpose: {agent.purpose}</p>
                <p>sources: [{selectedEndpointsList.map((e) => `"${e.id}"`).join(", ")}]</p>
                <p>escrow: {agent.maxBudgetSui} SUI</p>
                <p>interval: {agent.scrapeInterval}</p>
                <p>status: <span className="text-emerald-400">LIVE</span></p>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => navigate("/agent/dashboard")}
                className="py-3.5 px-7 bg-[#1C1A17] hover:bg-[#2E2E38] text-white font-sans text-sm font-bold rounded-full flex items-center gap-2 shadow-lg transition-all"
              >
                View Agent Dashboard
                <ArrowRight className="w-4 h-4" />
              </button>
              <button
                onClick={() => navigate("/directory")}
                className="py-3.5 px-7 bg-transparent hover:bg-[#1C1A17]/5 text-[#1C1A17] border border-[#1C1A17]/30 rounded-full text-sm font-sans font-bold transition-all"
              >
                Browse Directory
              </button>
            </div>
          </motion.div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#E5E5ED] flex flex-col">
      {/* Top progress bar */}
      <div className="w-full px-6 pt-6">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2.5 cursor-pointer" onClick={() => navigate("/")}>
              <div className="flex items-center gap-1 bg-[#1C1A17] text-[#E5E5ED] p-2 leading-none font-black text-sm tracking-tighter">
                <span>Σ</span><span>N</span>
              </div>
              <span className="font-mono text-xs tracking-widest font-black uppercase">FLOWGATE</span>
            </div>
            <div className="flex items-center gap-3">
              {isWalletConnected && walletAddress && (
                <span className="px-3 py-1.5 bg-[#FAF9F6] border border-stone-200 rounded-full font-sans text-xs font-bold text-[#1C1A17] flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}
                </span>
              )}
              <button
                onClick={() => navigate("/onboarding")}
                className="px-3 py-1.5 text-xs font-sans border border-stone-300 bg-[#FAF9F5] hover:border-[#1C1A17] transition-all rounded-full"
              >
                ← Back
              </button>
            </div>
          </div>

          {/* Step indicators */}
          <div className="grid grid-cols-4 gap-2 mb-8">
            {stepLabels.map((s) => (
              <div key={s.id} className="flex flex-col gap-1">
                <div className={`h-1 transition-all duration-500 ${step >= s.id ? "bg-[#8C2C16]" : "bg-stone-200"}`} />
                <span className={`text-xs font-sans ${step >= s.id ? "text-stone-700 font-bold" : "text-stone-400"}`}>
                  {s.label}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex items-start justify-center px-6 pb-12 pt-4">
        <div className="max-w-4xl w-full">
          <AnimatePresence mode="wait">
            {/* STEP 1: Agent Identity */}
            {step === 1 && (
              <motion.div
                key="step-1"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="flex flex-col items-center text-center gap-8"
              >
                <div className="w-20 h-20 rounded-full bg-[#9F9FEF]/20 border border-[#9F9FEF]/30 flex items-center justify-center">
                  <Bot className="w-10 h-10 text-[#9F9FEF]" />
                </div>

                <div className="flex flex-col gap-3">
                  <h1 className="font-sans text-3xl sm:text-4xl font-bold text-[#1C1A17]">
                    Create your AI Agent
                  </h1>
                  <p className="text-sm text-stone-600 max-w-lg leading-relaxed">
                    Configure an autonomous agent that discovers, pays for, and scrapes data from
                    registered FlowGate endpoints using SUI micropayments.
                  </p>
                </div>

                <div className="w-full max-w-lg space-y-6">
                  {/* Agent Name */}
                  <div className="text-left space-y-2">
                    <label className="text-xs font-sans text-stone-500 font-medium">Agent Name</label>
                    <input
                      type="text"
                      value={agent.name}
                      onChange={(e) => setAgent((prev) => ({ ...prev, name: e.target.value }))}
                      placeholder="e.g. market-sentinel-alpha"
                      className="w-full px-4 py-3 bg-white border border-stone-200 rounded-xl font-sans text-sm text-[#1C1A17] placeholder:text-stone-300 focus:outline-none focus:border-[#8C2C16] focus:ring-1 focus:ring-[#8C2C16]/20 transition-all"
                    />
                  </div>

                  {/* Agent Description */}
                  <div className="text-left space-y-2">
                    <label className="text-xs font-sans text-stone-500 font-medium">Description (optional)</label>
                    <textarea
                      value={agent.description}
                      onChange={(e) => setAgent((prev) => ({ ...prev, description: e.target.value }))}
                      placeholder="What does this agent do?"
                      rows={2}
                      className="w-full px-4 py-3 bg-white border border-stone-200 rounded-xl font-sans text-sm text-[#1C1A17] placeholder:text-stone-300 focus:outline-none focus:border-[#8C2C16] focus:ring-1 focus:ring-[#8C2C16]/20 transition-all resize-none"
                    />
                  </div>

                  {/* Purpose Selection */}
                  <div className="text-left space-y-2">
                    <label className="text-xs font-sans text-stone-500 font-medium">Agent Purpose</label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {PURPOSE_OPTIONS.map((opt) => (
                        <button
                          key={opt.id}
                          onClick={() => setAgent((prev) => ({ ...prev, purpose: opt.id }))}
                          className={`p-4 border-2 rounded-xl text-left transition-all ${
                            agent.purpose === opt.id
                              ? "border-[#8C2C16] bg-[#FAF9F6] shadow-sm"
                              : "border-stone-200 bg-white hover:border-stone-300"
                          }`}
                        >
                          <div className="flex items-center gap-2.5 mb-1">
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                              agent.purpose === opt.id ? "bg-[#8C2C16]/10 text-[#8C2C16]" : "bg-stone-100 text-stone-400"
                            }`}>
                              {opt.icon}
                            </div>
                            <span className="text-xs font-sans font-bold">{opt.label}</span>
                          </div>
                          <p className="text-xs text-stone-500 leading-relaxed mt-1">{opt.desc}</p>
                          {agent.purpose === opt.id && (
                            <div className="mt-2 flex items-center gap-1 text-xs font-sans text-[#8C2C16] font-bold">
                              <Check className="w-3 h-3" /> Selected
                            </div>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex gap-3 mt-4">
                  <button
                    onClick={() => navigate("/onboarding")}
                    className="py-3 px-6 bg-transparent hover:bg-[#1C1A17]/5 text-[#1C1A17] border border-[#1C1A17]/30 rounded-full text-sm font-sans font-bold transition-all"
                  >
                    <ArrowLeft className="w-3.5 h-3.5 inline mr-1.5" />
                    Back
                  </button>
                  <button
                    onClick={() => setStep(2)}
                    disabled={!canProceed()}
                    className="py-3 px-8 bg-[#1C1A17] hover:bg-[#2E2E38] disabled:opacity-40 text-white font-sans text-sm font-bold rounded-full flex items-center gap-2 shadow-lg transition-all"
                  >
                    Select Data Sources
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </motion.div>
            )}

            {/* STEP 2: Select Data Sources */}
            {step === 2 && (
              <motion.div
                key="step-2"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="flex flex-col gap-6"
              >
                <div className="text-center flex flex-col gap-3">
                  <h2 className="font-sans text-3xl font-bold text-[#1C1A17]">
                    Select Data Sources
                  </h2>
                  <p className="text-sm text-stone-600 max-w-lg mx-auto leading-relaxed">
                    Choose which registered endpoints your agent will subscribe to and pay for.
                    Each source charges per-second in SUI.
                  </p>
                </div>

                {/* Search */}
                <div className="max-w-2xl mx-auto w-full">
                  <div className="relative">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search endpoints..."
                      className="w-full pl-10 pr-4 py-3 bg-white border border-stone-200 rounded-xl font-sans text-sm text-[#1C1A17] placeholder:text-stone-300 focus:outline-none focus:border-[#8C2C16] focus:ring-1 focus:ring-[#8C2C16]/20 transition-all"
                    />
                  </div>
                </div>

                {/* Selected count */}
                {agent.selectedEndpoints.length > 0 && (
                  <div className="max-w-2xl mx-auto w-full flex items-center gap-2 px-4 py-2.5 bg-[#8C2C16]/5 border border-[#8C2C16]/15 rounded-xl">
                    <Check className="w-4 h-4 text-[#8C2C16]" />
                    <span className="text-xs font-sans font-bold text-[#8C2C16]">
                      {agent.selectedEndpoints.length} endpoint{agent.selectedEndpoints.length !== 1 ? "s" : ""} selected
                    </span>
                    <span className="text-xs font-sans text-stone-500 ml-auto">
                      ~{estimatedCostPerHour.toFixed(4)} SUI/hour estimated
                    </span>
                  </div>
                )}

                {/* Endpoint Grid */}
                <div className="max-w-2xl mx-auto w-full grid grid-cols-1 gap-3 max-h-[420px] overflow-y-auto pr-1">
                  {filteredEndpoints.map((ep) => {
                    const isSelected = agent.selectedEndpoints.includes(ep.id);
                    return (
                      <button
                        key={ep.id}
                        onClick={() => toggleEndpoint(ep.id)}
                        className={`p-4 border-2 rounded-xl text-left transition-all flex items-start gap-4 ${
                          isSelected
                            ? "border-[#8C2C16] bg-[#FAF9F6] shadow-sm"
                            : "border-stone-200 bg-white hover:border-stone-300"
                        }`}
                      >
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
                          isSelected ? "bg-[#8C2C16]/10" : "bg-stone-100"
                        }`}>
                          {ep.type === "api" ? (
                            <Globe className={`w-5 h-5 ${isSelected ? "text-[#8C2C16]" : "text-stone-400"}`} />
                          ) : ep.type === "compute" ? (
                            <Cpu className={`w-5 h-5 ${isSelected ? "text-[#8C2C16]" : "text-stone-400"}`} />
                          ) : (
                            <Database className={`w-5 h-5 ${isSelected ? "text-[#8C2C16]" : "text-stone-400"}`} />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-sans text-xs font-bold truncate">{ep.name}</span>
                            <span className={`px-1.5 py-0.5 text-[7px] font-mono font-bold uppercase rounded ${
                              ep.status === "active" ? "bg-emerald-50 text-emerald-700" : "bg-stone-100 text-stone-500"
                            }`}>
                              {ep.status}
                            </span>
                          </div>
                          <p className="text-xs text-stone-500 mt-0.5 line-clamp-1">{ep.description}</p>
                          <div className="flex items-center gap-3 mt-2 font-sans text-xs text-stone-400">
                            <span>{ep.latency}ms latency</span>
                            <span>•</span>
                            <span className="text-[#8C2C16] font-bold">{ep.price.toFixed(5)} SUI/sec</span>
                            <span>•</span>
                            <span>⭐ {ep.rating}</span>
                          </div>
                        </div>
                        <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 mt-1 transition-all ${
                          isSelected
                            ? "border-[#8C2C16] bg-[#8C2C16]"
                            : "border-stone-300"
                        }`}>
                          {isSelected && <Check className="w-3.5 h-3.5 text-white" />}
                        </div>
                      </button>
                    );
                  })}
                  {filteredEndpoints.length === 0 && (
                    <div className="py-12 text-center">
                      <Server className="w-10 h-10 text-stone-300 mx-auto mb-3" />
                      <p className="text-sm text-stone-400 font-sans">No endpoints found</p>
                    </div>
                  )}
                </div>

                <div className="flex justify-center gap-3 mt-2">
                  <button
                    onClick={() => setStep(1)}
                    className="py-3 px-6 bg-transparent hover:bg-[#1C1A17]/5 text-[#1C1A17] border border-[#1C1A17]/30 rounded-full text-sm font-sans font-bold transition-all"
                  >
                    <ArrowLeft className="w-3.5 h-3.5 inline mr-1.5" />
                    Back
                  </button>
                  <button
                    onClick={() => setStep(3)}
                    disabled={!canProceed()}
                    className="py-3 px-8 bg-[#1C1A17] hover:bg-[#2E2E38] disabled:opacity-40 text-white font-sans text-sm font-bold rounded-full flex items-center gap-2 shadow-lg transition-all"
                  >
                    Configure Budget
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </motion.div>
            )}

            {/* STEP 3: Fund Escrow & Budget */}
            {step === 3 && (
              <motion.div
                key="step-3"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="flex flex-col items-center gap-8"
              >
                <div className="text-center flex flex-col gap-3">
                  <h2 className="font-sans text-3xl font-bold text-[#1C1A17]">
                    Fund Your Agent's Escrow
                  </h2>
                  <p className="text-sm text-stone-600 max-w-lg leading-relaxed">
                    Set the budget your agent can spend on data access. Funds are locked in a non-custodial
                    smart escrow and depleted as your agent makes queries.
                  </p>
                </div>

                <div className="w-full max-w-lg space-y-6">
                  {/* Wallet balance */}
                  <div className="p-4 bg-[#FAF9F6] border border-stone-200 rounded-xl flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Wallet className="w-4 h-4 text-stone-400" />
                      <span className="text-xs font-sans text-stone-500">Wallet Balance</span>
                    </div>
                    <span className="font-sans text-lg font-bold text-[#1C1A17]">
                      {suiBalance.toFixed(4)} SUI
                    </span>
                  </div>

                  {/* Budget slider */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-sans text-stone-500 font-medium">Escrow Budget</label>
                      <span className="font-sans text-xl font-bold text-[#8C2C16]">{agent.maxBudgetSui.toFixed(2)} SUI</span>
                    </div>
                    <input
                      type="range"
                      min="1"
                      max={Math.max(10, Math.floor(suiBalance))}
                      step="0.5"
                      value={agent.maxBudgetSui}
                      onChange={(e) => setAgent((prev) => ({ ...prev, maxBudgetSui: parseFloat(e.target.value) }))}
                      className="w-full accent-[#8C2C16]"
                    />
                    <div className="flex justify-between text-xs font-sans text-stone-400">
                      <span>1.00 SUI</span>
                      <span>{Math.max(10, Math.floor(suiBalance))} SUI</span>
                    </div>
                  </div>

                  {/* Quick amounts */}
                  <div className="flex gap-2">
                    {[5, 10, 25, 50].filter((v) => v <= suiBalance || v <= 50).map((amount) => (
                      <button
                        key={amount}
                        onClick={() => setAgent((prev) => ({ ...prev, maxBudgetSui: amount }))}
                        className={`flex-1 py-2.5 border rounded-lg font-sans text-xs font-bold transition-all ${
                          agent.maxBudgetSui === amount
                            ? "border-[#8C2C16] bg-[#8C2C16]/5 text-[#8C2C16]"
                            : "border-stone-200 bg-white text-stone-500 hover:border-stone-300"
                        }`}
                      >
                        {amount} SUI
                      </button>
                    ))}
                  </div>

                  {/* Auto-refill toggle */}
                  <div className="flex items-center justify-between p-4 bg-white border border-stone-200 rounded-xl">
                    <div>
                      <span className="text-xs font-sans font-bold block">Auto-refill</span>
                      <span className="text-xs text-stone-500">Automatically replenish escrow from wallet when low</span>
                    </div>
                    <button
                      onClick={() => setAgent((prev) => ({ ...prev, autoRefill: !prev.autoRefill }))}
                      className={`w-12 h-6 rounded-full transition-all relative ${
                        agent.autoRefill ? "bg-[#8C2C16]" : "bg-stone-300"
                      }`}
                    >
                      <div className={`w-5 h-5 bg-white rounded-full shadow absolute top-0.5 transition-all ${
                        agent.autoRefill ? "left-[26px]" : "left-[2px]"
                      }`} />
                    </button>
                  </div>

                  {/* Scrape interval */}
                  <div className="space-y-2">
                    <label className="text-xs font-sans text-stone-500 font-medium">Scrape Interval</label>
                    <div className="grid grid-cols-5 gap-2">
                      {INTERVAL_OPTIONS.map((opt) => (
                        <button
                          key={opt.value}
                          onClick={() => setAgent((prev) => ({ ...prev, scrapeInterval: opt.value }))}
                          className={`py-2.5 px-2 border rounded-lg text-center transition-all ${
                            agent.scrapeInterval === opt.value
                              ? "border-[#8C2C16] bg-[#8C2C16]/5 text-[#8C2C16]"
                              : "border-stone-200 bg-white text-stone-500 hover:border-stone-300"
                          }`}
                        >
                          <span className="text-xs font-sans font-bold block">{opt.label}</span>
                          <span className="text-[10px] text-stone-400 block">{opt.desc}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Cost estimate */}
                  <div className="p-4 bg-[#1C1A17] text-[#8AF2D0] rounded-xl font-mono text-[10px] space-y-0.5">
                    <p className="text-white/40">// Cost Estimate</p>
                    <p>sources: {agent.selectedEndpoints.length} endpoints</p>
                    <p>interval: {agent.scrapeInterval}</p>
                    <p>est_hourly_burn: {estimatedCostPerHour.toFixed(6)} SUI</p>
                    <p>est_daily_burn: {(estimatedCostPerHour * 24).toFixed(4)} SUI</p>
                    <p>escrow_hours: ~{agent.maxBudgetSui > 0 && estimatedCostPerHour > 0 ? Math.floor(agent.maxBudgetSui / estimatedCostPerHour) : "∞"} hours of operation</p>
                  </div>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => setStep(2)}
                    className="py-3 px-6 bg-transparent hover:bg-[#1C1A17]/5 text-[#1C1A17] border border-[#1C1A17]/30 rounded-full text-sm font-sans font-bold transition-all"
                  >
                    <ArrowLeft className="w-3.5 h-3.5 inline mr-1.5" />
                    Back
                  </button>
                  <button
                    onClick={() => setStep(4)}
                    disabled={!canProceed()}
                    className="py-3 px-8 bg-[#1C1A17] hover:bg-[#2E2E38] disabled:opacity-40 text-white font-sans text-sm font-bold rounded-full flex items-center gap-2 shadow-lg transition-all"
                  >
                    Review & Deploy
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </motion.div>
            )}

            {/* STEP 4: Review & Deploy */}
            {step === 4 && (
              <motion.div
                key="step-4"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="flex flex-col items-center gap-8"
              >
                <div className="text-center flex flex-col gap-3">
                  <h2 className="font-sans text-3xl font-bold text-[#1C1A17]">
                    Review & Deploy
                  </h2>
                  <p className="text-sm text-stone-600 max-w-lg leading-relaxed">
                    Confirm your agent configuration before deploying to the FlowGate network.
                  </p>
                </div>

                <div className="w-full max-w-lg space-y-4">
                  {/* Agent Identity */}
                  <div className="p-5 bg-[#FAF9F6] border border-stone-200 rounded-2xl space-y-3">
                    <div className="flex items-center justify-between pb-2 border-b border-stone-100">
                      <span className="text-xs font-sans text-stone-400 font-medium">Agent Identity</span>
                      <button onClick={() => setStep(1)} className="text-xs font-sans text-[#8C2C16] font-bold hover:underline cursor-pointer">Edit</button>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-[#9F9FEF]/20 flex items-center justify-center">
                        <Bot className="w-5 h-5 text-[#9F9FEF]" />
                      </div>
                      <div>
                        <span className="font-sans text-sm font-bold block">{agent.name}</span>
                        <span className="text-xs text-stone-500">{PURPOSE_OPTIONS.find((p) => p.id === agent.purpose)?.label || agent.purpose}</span>
                      </div>
                    </div>
                    {agent.description && (
                      <p className="text-sm text-stone-500 leading-relaxed">{agent.description}</p>
                    )}
                  </div>

                  {/* Data Sources */}
                  <div className="p-5 bg-[#FAF9F6] border border-stone-200 rounded-2xl space-y-3">
                    <div className="flex items-center justify-between pb-2 border-b border-stone-100">
                      <span className="text-xs font-sans text-stone-400 font-medium">Data Sources ({agent.selectedEndpoints.length})</span>
                      <button onClick={() => setStep(2)} className="text-xs font-sans text-[#8C2C16] font-bold hover:underline cursor-pointer">Edit</button>
                    </div>
                    <div className="space-y-2">
                      {selectedEndpointsList.map((ep) => (
                        <div key={ep.id} className="flex items-center justify-between py-2 border-b border-stone-100 last:border-0">
                          <div className="flex items-center gap-2">
                            <Globe className="w-3.5 h-3.5 text-stone-400" />
                            <span className="font-sans text-xs font-bold">{ep.name}</span>
                          </div>
                          <span className="font-sans text-xs text-[#8C2C16] font-bold">{ep.price.toFixed(5)} SUI/s</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Budget & Config */}
                  <div className="p-5 bg-[#FAF9F6] border border-stone-200 rounded-2xl space-y-3">
                    <div className="flex items-center justify-between pb-2 border-b border-stone-100">
                      <span className="text-xs font-sans text-stone-400 font-medium">Budget & Config</span>
                      <button onClick={() => setStep(3)} className="text-xs font-sans text-[#8C2C16] font-bold hover:underline cursor-pointer">Edit</button>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <span className="text-xs font-sans text-stone-400 block mb-0.5">Escrow</span>
                        <span className="font-sans text-lg font-bold text-[#8C2C16]">{agent.maxBudgetSui.toFixed(2)} SUI</span>
                      </div>
                      <div>
                        <span className="text-xs font-sans text-stone-400 block mb-0.5">Interval</span>
                        <span className="font-sans text-lg font-bold text-[#1C1A17]">{agent.scrapeInterval}</span>
                      </div>
                      <div>
                        <span className="text-xs font-sans text-stone-400 block mb-0.5">Auto-refill</span>
                        <span className="font-sans text-lg font-bold text-[#1C1A17]">{agent.autoRefill ? "Yes" : "No"}</span>
                      </div>
                      <div>
                        <span className="text-xs font-sans text-stone-400 block mb-0.5">Est. Burn Rate</span>
                        <span className="font-sans text-lg font-bold text-[#1C1A17]">{estimatedCostPerHour.toFixed(4)}/h</span>
                      </div>
                    </div>
                  </div>

                  {/* Deploy notice */}
                  {!isWalletConnected && (
                    <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-3">
                      <Shield className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                      <div>
                        <span className="text-xs font-sans font-bold text-amber-800 block">Wallet not connected</span>
                        <p className="text-xs text-amber-700 mt-0.5">
                          Connect your Sui wallet to deploy. You can also deploy as a guest with limited functionality.
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => setStep(3)}
                    className="py-3 px-6 bg-transparent hover:bg-[#1C1A17]/5 text-[#1C1A17] border border-[#1C1A17]/30 rounded-full text-sm font-sans font-bold transition-all"
                  >
                    <ArrowLeft className="w-3.5 h-3.5 inline mr-1.5" />
                    Back
                  </button>
                  <button
                    onClick={handleDeploy}
                    className="py-4 px-10 bg-[#8C2C16] hover:bg-[#A63A23] text-white font-sans text-sm font-bold rounded-full flex items-center gap-2.5 shadow-lg hover:shadow-xl transition-all"
                  >
                    <Play className="w-4 h-4" />
                    Deploy Agent
                    <Sparkles className="w-4 h-4" />
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
