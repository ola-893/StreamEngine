import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { SuiDataGateSDK } from "../lib/SuiDataGateSDK";
import { motion, AnimatePresence } from "motion/react";
import { Agent, Endpoint } from "../types";
import {
  Bot,
  Plus,
  Play,
  Pause,
  Trash2,
  DollarSign,
  Activity,
  Globe,
  AlertTriangle,
  Check,
  X,
  BarChart3,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

function StreamBalancePoller({ streamId, onBalanceUpdate }: { streamId: string; onBalanceUpdate: (balanceSui: number) => void }) {
  const onUpdateRef = React.useRef(onBalanceUpdate);
  useEffect(() => {
    onUpdateRef.current = onBalanceUpdate;
  }, [onBalanceUpdate]);

  useEffect(() => {
    let isActive = true;
    
    const poll = async () => {
      try {
        const res = await fetch(`http://localhost:3001/api/streams/${streamId}/balance`);
        if (res.ok) {
          const data = await res.json();
          if (isActive) {
            onUpdateRef.current(data.balanceMist / 1_000_000_000);
          }
        }
      } catch (e) {
        console.error("Polling error", e);
      }
    };
    
    // Initial fetch
    poll();
    
    // Poll every 5s
    const interval = setInterval(poll, 5000);
    return () => {
      isActive = false;
      clearInterval(interval);
    };
  }, [streamId]);
  
  return null; // purely logic component
}

interface AgentDashboardPageProps {
  agents: Agent[];
  endpoints: Endpoint[];
  onUpdateAgent: (id: string, updates: Partial<Agent>) => void;
  onDeleteAgent: (id: string) => void;
}

export default function AgentDashboardPage({
  agents,
  endpoints,
  onUpdateAgent,
  onDeleteAgent,
}: AgentDashboardPageProps) {
  const navigate = useNavigate();
  const [expandedAgent, setExpandedAgent] = useState<string | null>(null);
  const [editingBudget, setEditingBudget] = useState<string | null>(null);
  const [budgetValue, setBudgetValue] = useState<number>(0);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const getAgentEndpoints = (agent: Agent) =>
    endpoints.filter((ep) => agent.selectedEndpoints.includes(ep.id));

  const getBurnRate = (agent: Agent) => {
    const eps = getAgentEndpoints(agent);
    return eps.reduce((sum, ep) => sum + ep.price * 3600, 0);
  };

  const getRemainingHours = (agent: Agent) => {
    const burnRate = getBurnRate(agent);
    if (burnRate <= 0) return Infinity;
    const remaining = agent.maxBudgetSui - agent.currentSpendSui;
    return remaining / burnRate;
  };

  const getStatusColor = (status: Agent["status"]) => {
    switch (status) {
      case "active": return "bg-emerald-50 text-emerald-700 border-emerald-200";
      case "paused": return "bg-amber-50 text-amber-700 border-amber-200";
      case "depleted": return "bg-red-50 text-red-700 border-red-200";
    }
  };

  const getStatusDot = (status: Agent["status"]) => {
    switch (status) {
      case "active": return "bg-emerald-500";
      case "paused": return "bg-amber-500";
      case "depleted": return "bg-red-500";
    }
  };

  const handleSaveBudget = (agentId: string) => {
    onUpdateAgent(agentId, { maxBudgetSui: budgetValue });
    setEditingBudget(null);
  };

  const totalAgents = agents.length;
  const activeAgents = agents.filter((a) => a.status === "active").length;
  const totalSpend = agents.reduce((sum, a) => sum + a.currentSpendSui, 0);
  const totalBudget = agents.reduce((sum, a) => sum + a.maxBudgetSui, 0);

  if (agents.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6">
        <div className="w-20 h-20 rounded-full bg-stone-100 border border-stone-200 flex items-center justify-center">
          <Bot className="w-10 h-10 text-stone-300" />
        </div>
        <div className="text-center flex flex-col gap-2">
          <h2 className="font-serif text-2xl font-bold text-[#1C1A17]">No agents deployed</h2>
          <p className="text-sm text-stone-500 max-w-md">
            Create your first agent to start collecting and paying for data.
          </p>
        </div>
        <button
          onClick={() => navigate("/agent/create")}
          className="py-3 px-7 bg-[#1C1A17] hover:bg-[#2E2E38] text-white font-sans text-sm font-bold rounded-full flex items-center gap-2 shadow-lg transition-all"
        >
          <Plus className="w-4 h-4" />
          Create Agent
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 text-[#8C2C16] font-sans text-sm font-semibold mb-2">
            <span className="w-1.5 h-1.5 bg-[#8C2C16]" />
            Agent Management
          </div>
          <h1 className="font-sans text-3xl font-bold text-[#1C1A17]">
            Your Agents
          </h1>
          <p className="text-sm text-stone-500 mt-1">
            Monitor and control your deployed agents.
          </p>
        </div>
        <button
          onClick={() => navigate("/agent/create")}
          className="py-2.5 px-5 bg-[#8C2C16] hover:bg-[#A63A23] text-white font-sans text-sm font-bold rounded-full flex items-center gap-1.5 shadow-md transition-all"
        >
          <Plus className="w-3.5 h-3.5" />
          New Agent
        </button>
      </div>

      {/* Fleet Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total Agents", value: totalAgents.toString(), icon: <Bot className="w-4 h-4" /> },
          { label: "Active", value: activeAgents.toString(), icon: <Activity className="w-4 h-4 text-emerald-600" />, accent: "text-emerald-600" },
          { label: "Total Spent", value: `${totalSpend.toFixed(4)} SUI`, icon: <DollarSign className="w-4 h-4 text-[#8C2C16]" />, accent: "text-[#8C2C16]" },
          { label: "Total Budget", value: `${totalBudget.toFixed(2)} SUI`, icon: <BarChart3 className="w-4 h-4" /> },
        ].map((stat, i) => (
          <div key={i} className="p-4 bg-[#FAF9F6] border border-stone-200 rounded-xl">
            <div className="flex items-center gap-2 mb-2 text-stone-400">
              {stat.icon}
              <span className="text-xs font-sans text-stone-400 font-medium">{stat.label}</span>
            </div>              <span className={`font-sans text-xl font-bold ${stat.accent || "text-[#1C1A17]"}`}>
              {stat.value}
            </span>
          </div>
        ))}
      </div>

      {/* Agent Cards */}
      <div className="space-y-4">
        <AnimatePresence>
          {agents.map((agent) => {
            const agentEndpoints = getAgentEndpoints(agent);
            const burnRate = getBurnRate(agent);
            const remainingHours = getRemainingHours(agent);
            const spendPercent = agent.maxBudgetSui > 0 ? (agent.currentSpendSui / agent.maxBudgetSui) * 100 : 0;
            const isExpanded = expandedAgent === agent.id;

            return (
              <motion.div
                key={agent.id}
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="bg-[#FAF9F6] border border-stone-200 rounded-2xl overflow-hidden"
              >
                {/* Agent Header */}
                <div className="p-5 flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 ${
                    agent.status === "active" ? "bg-emerald-50 border border-emerald-200" :
                    agent.status === "paused" ? "bg-amber-50 border border-amber-200" :
                    "bg-red-50 border border-red-200"
                  }`}>
                    <Bot className={`w-6 h-6 ${
                      agent.status === "active" ? "text-emerald-600" :
                      agent.status === "paused" ? "text-amber-600" :
                      "text-red-600"
                    }`} />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2.5">
                      <span className="font-sans text-sm font-bold uppercase truncate">{agent.name}</span>
                      <span className={`px-2 py-0.5 text-xs font-sans font-bold rounded-full border ${getStatusColor(agent.status)}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${getStatusDot(agent.status)} inline-block mr-1`} />
                        {agent.status}
                      </span>
                    </div>
                    <p className="text-xs text-stone-500 mt-0.5 truncate">{agent.description || agent.purpose}</p>
                  </div>

                  <div className="hidden md:flex items-center gap-6 text-right shrink-0">
                    <div>
                      <span className="text-xs font-sans text-stone-400 block">Spend</span>
                      <span className="font-sans text-sm font-bold text-[#8C2C16]">{agent.currentSpendSui.toFixed(4)}</span>
                    </div>
                    <div>
                      <span className="text-xs font-sans text-stone-400 block">Budget</span>
                      <span className="font-sans text-sm font-bold text-[#1C1A17]">{agent.maxBudgetSui.toFixed(2)}</span>
                    </div>
                    <div>
                      <span className="text-xs font-sans text-stone-400 block">Burn Rate</span>
                      <span className="font-sans text-sm font-bold text-[#1C1A17]">{burnRate.toFixed(4)}/h</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={() => onUpdateAgent(agent.id, { status: agent.status === "active" ? "paused" : "active" })}
                      className={`p-2 rounded-lg border transition-all ${
                        agent.status === "active"
                          ? "bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100"
                          : "bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100"
                      }`}
                      title={agent.status === "active" ? "Pause agent" : "Resume agent"}
                    >
                      {agent.status === "active" ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                    </button>
                    <button
                      onClick={() => setExpandedAgent(isExpanded ? null : agent.id)}
                      className="p-2 rounded-lg border border-stone-200 text-stone-500 hover:bg-stone-100 transition-all"
                      title="Expand details"
                    >
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                  </div>

                  {/* Mobile controls */}
                  <div className="flex md:hidden items-center gap-2 shrink-0">
                    <button
                      onClick={() => onUpdateAgent(agent.id, { status: agent.status === "active" ? "paused" : "active" })}
                      className={`p-2 rounded-lg border transition-all ${
                        agent.status === "active"
                          ? "bg-amber-50 border-amber-200 text-amber-700"
                          : "bg-emerald-50 border-emerald-200 text-emerald-700"
                      }`}
                    >
                      {agent.status === "active" ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                    </button>
                    <button
                      onClick={() => setExpandedAgent(isExpanded ? null : agent.id)}
                      className="p-2 rounded-lg border border-stone-200 text-stone-500"
                    >
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Spend Bar */}
                <div className="px-5 pb-4">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-sans text-stone-400">Escrow Usage</span>
                    <span className="text-xs font-sans text-stone-500">
                      {agent.currentSpendSui.toFixed(4)} / {agent.maxBudgetSui.toFixed(2)} SUI ({spendPercent.toFixed(1)}%)
                    </span>
                  </div>
                  <div className="w-full h-2 bg-stone-200 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        spendPercent > 90 ? "bg-red-500" : spendPercent > 70 ? "bg-amber-500" : "bg-[#8C2C16]"
                      }`}
                      style={{ width: `${Math.min(spendPercent, 100)}%` }}
                    />
                  </div>
                </div>

                {/* Expanded Details */}
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="border-t border-stone-200"
                    >
                      <div className="p-5 space-y-5">
                        {/* Stats Grid */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                          <div className="bg-white p-3 border border-stone-100 rounded-xl">
                            <span className="text-xs font-sans text-stone-400 block mb-1">Burn Rate</span>
                            <span className="font-sans text-sm font-bold text-[#1C1A17]">{burnRate.toFixed(4)} SUI/h</span>
                          </div>
                          <div className="bg-white p-3 border border-stone-100 rounded-xl">
                            <span className="text-xs font-sans text-stone-400 block mb-1">Remaining</span>
                            <span className={`font-sans text-sm font-bold ${remainingHours < 10 ? "text-red-600" : "text-[#1C1A17]"}`}>
                              {remainingHours === Infinity ? "∞" : `~${Math.floor(remainingHours)}h`}
                            </span>
                          </div>
                          <div className="bg-white p-3 border border-stone-100 rounded-xl">
                            <span className="text-xs font-sans text-stone-400 block mb-1">Sources</span>
                            <span className="font-sans text-sm font-bold text-[#1C1A17]">{agentEndpoints.length}</span>
                          </div>
                          <div className="bg-white p-3 border border-stone-100 rounded-xl">
                            <span className="text-xs font-sans text-stone-400 block mb-1">Requests</span>
                            <span className="font-sans text-sm font-bold text-[#1C1A17]">{agent.totalRequests.toLocaleString()}</span>
                          </div>
                        </div>

                        {/* Connected and Available Endpoints */}
                        <div className="space-y-4">
                          {/* Connected Endpoints */}
                          {agentEndpoints.length > 0 && (
                            <div>
                              <span className="text-xs font-sans text-stone-400 font-medium block mb-2">Connected Endpoints</span>
                              <div className="space-y-2">
                                {agentEndpoints.map((ep) => (
                                  <div key={ep.id} className="flex items-center justify-between p-3 bg-white border border-stone-100 rounded-xl">
                                    <div className="flex items-center gap-2.5">
                                      <Globe className="w-4 h-4 text-emerald-500" />
                                      <div>
                                        <span className="font-sans text-xs font-bold">{ep.name}</span>
                                        <span className="text-xs text-stone-400 ml-2">{ep.latency}ms</span>
                                      </div>
                                    </div>
                                    <div className="flex flex-col items-end">
                                      <span className="font-sans text-xs text-[#8C2C16] font-bold">{ep.price.toFixed(5)} SUI/s</span>
                                      {agent.activeStreamId && (
                                        <span className="text-[10px] text-stone-400">Stream ID: {agent.activeStreamId.substring(0,8)}</span>
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Available Endpoints */}
                          <div>
                            <span className="text-xs font-sans text-stone-400 font-medium block mb-2">Available Endpoints</span>
                            <div className="space-y-2">
                              {endpoints.filter(ep => !agent.selectedEndpoints.includes(ep.id)).map((ep) => (
                                <div key={ep.id} className="flex items-center justify-between p-3 bg-white border border-stone-100 rounded-xl">
                                  <div className="flex items-center gap-2.5">
                                    <Globe className="w-4 h-4 text-stone-400" />
                                    <div>
                                      <span className="font-sans text-xs font-bold">{ep.name}</span>
                                      <span className="text-xs text-stone-400 ml-2">{ep.latency}ms</span>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-3">
                                    <span className="font-sans text-xs text-[#8C2C16] font-bold">{ep.price.toFixed(5)} SUI/s</span>
                                    <button 
                                      onClick={async () => {
                                        try {
                                          // Initialize SDK (using a dummy key since we don't have the user's raw private key in browser)
                                          const sdk = new SuiDataGateSDK({
                                            privateKeyHex: '0000000000000000000000000000000000000000000000000000000000000000',
                                            rpcUrl: 'https://fullnode.testnet.sui.io:443',
                                            agentId: agent.id
                                          });

                                          // Trigger request which automatically catches 402 and creates a stream
                                          // Note: this will likely fail due to the dummy key having no gas,
                                          // so we fallback to simulating the backend state updates below for the demo.
                                          await sdk.makeRequest(`http://localhost:3001${ep.endpointUrl}`);
                                        } catch (e) {
                                          console.warn("SDK Request failed (likely due to dummy key). Proceeding with simulated stream creation.", e);
                                        }
                                        
                                        // 1. Simulate SDK creating a stream
                                        const streamId = `stream-${Date.now()}`;
                                        const amountMist = agent.maxBudgetSui * 1_000_000_000;
                                        
                                        // 2. Patch agent with new stream
                                        await fetch(`http://localhost:3001/api/agents/${agent.id}/stream`, {
                                          method: "PATCH",
                                          headers: { "Content-Type": "application/json" },
                                          body: JSON.stringify({ streamId, amountMist })
                                        });

                                        // Update local state
                                        onUpdateAgent(agent.id, { 
                                          selectedEndpoints: [...agent.selectedEndpoints, ep.id],
                                          activeStreamId: streamId
                                        });
                                      }}
                                      className="py-1 px-3 bg-[#1C1A17] hover:bg-[#2E2E38] text-white font-sans text-[10px] font-bold rounded-lg shadow-sm transition-all"
                                    >
                                      Connect & Scrape
                                    </button>
                                  </div>
                                </div>
                              ))}
                              {endpoints.filter(ep => !agent.selectedEndpoints.includes(ep.id)).length === 0 && (
                                <div className="p-3 bg-white border border-stone-100 rounded-xl text-center">
                                  <span className="text-xs text-stone-400 font-sans">No available endpoints</span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Budget Adjustment */}
                        <div className="p-4 bg-white border border-stone-200 rounded-xl">
                          <div className="flex items-center justify-between mb-3">
                            <span className="text-xs font-sans text-stone-400 font-medium">Adjust Budget</span>
                            {editingBudget !== agent.id ? (
                              <button
                                onClick={() => { setEditingBudget(agent.id); setBudgetValue(agent.maxBudgetSui); }}
                                className="text-xs font-sans text-[#8C2C16] font-bold hover:underline"
                              >
                                Edit
                              </button>
                            ) : (
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => handleSaveBudget(agent.id)}
                                  className="p-1 bg-emerald-50 text-emerald-700 rounded"
                                >
                                  <Check className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => setEditingBudget(null)}
                                  className="p-1 bg-red-50 text-red-700 rounded"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            )}
                          </div>
                          {editingBudget === agent.id ? (
                            <div className="flex items-center gap-3">
                              <input
                                type="number"
                                value={budgetValue}
                                onChange={(e) => setBudgetValue(parseFloat(e.target.value) || 0)}
                                step="0.5"
                                className="flex-1 px-3 py-2 bg-[#FAF9F6] border border-stone-200 rounded-xl font-sans text-sm text-[#1C1A17] focus:outline-none focus:border-[#8C2C16]"
                              />
                              <span className="text-sm font-sans text-stone-500">SUI</span>
                            </div>
                          ) : (
                            <div className="flex items-center justify-between">
                              <span className="font-sans text-lg font-bold text-[#8C2C16]">{agent.maxBudgetSui.toFixed(2)} SUI</span>
                              <span className="text-xs font-sans text-stone-500">Auto-refill: {agent.autoRefill ? "On" : "Off"}</span>
                            </div>
                          )}
                        </div>

                        {/* Stream Balance Polling (if active) */}
                        {agent.activeStreamId && (
                           <StreamBalancePoller 
                             streamId={agent.activeStreamId}
                             onBalanceUpdate={(balanceSui) => {
                               const spent = agent.maxBudgetSui - balanceSui;
                               if (spent !== agent.currentSpendSui) {
                                 onUpdateAgent(agent.id, { currentSpendSui: spent });
                               }
                             }}
                           />
                        )}

                        {/* Agent Config Code Block */}
                        <div className="bg-[#1C1A17] text-[#8AF2D0] p-4 rounded-xl font-mono text-[10px] space-y-0.5 overflow-x-auto whitespace-pre">
                          <p className="text-white/40">// Agent Config</p>
                          <p>id: "{agent.id}"</p>
                          <p>name: "{agent.name}"</p>
                          <p>purpose: {agent.purpose}</p>
                          <p>sources: [{agentEndpoints.map((e) => `"${e.id}"`).join(", ")}]</p>
                          <p>escrow: {agent.maxBudgetSui} SUI</p>
                          <p>spent: {agent.currentSpendSui.toFixed(6)} SUI</p>
                          <p>interval: {agent.scrapeInterval}</p>
                          <p>status: <span className={agent.status === "active" ? "text-emerald-400" : agent.status === "paused" ? "text-amber-400" : "text-red-400"}>{agent.status.toUpperCase()}</span></p>
                          <p>activeStreamId: {agent.activeStreamId || "null"}</p>
                          <p>created: {agent.createdAt}</p>
                        </div>

                        {/* Delete */}
                        <div className="pt-2 border-t border-stone-100">
                          {confirmDelete === agent.id ? (
                            <div className="flex items-center gap-3">
                              <AlertTriangle className="w-4 h-4 text-red-500" />
                              <span className="text-sm text-red-600 font-sans">Delete this agent?</span>
                              <button
                                onClick={() => { onDeleteAgent(agent.id); setConfirmDelete(null); }}
                                className="px-3 py-1.5 bg-red-600 text-white text-xs font-sans font-bold rounded-lg"
                              >
                                Confirm
                              </button>
                              <button
                                onClick={() => setConfirmDelete(null)}
                                className="px-3 py-1.5 bg-stone-200 text-stone-600 text-xs font-sans font-bold rounded-lg"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setConfirmDelete(agent.id)}
                              className="flex items-center gap-1.5 text-xs font-sans text-red-500 hover:text-red-700 font-bold transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              Delete Agent
                            </button>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}
