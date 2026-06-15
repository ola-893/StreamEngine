import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
import { Agent, API_BASE } from "../types";
import {
  Bot,
  Plus,
  Activity,
  DollarSign,
  Clock,
  Globe,
  ChevronDown,
  ChevronUp,
  Wallet,
  Key,
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
        const res = await fetch(`${API_BASE}/api/streams/${streamId}/balance`);
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

    poll();
    const interval = setInterval(poll, 5000);
    return () => {
      isActive = false;
      clearInterval(interval);
    };
  }, [streamId]);

  return null;
}

interface AgentDashboardPageProps {
  agents: Agent[];
  onUpdateAgent: (id: string, updates: Partial<Agent>) => void;
}

export default function AgentDashboardPage({
  agents,
  onUpdateAgent,
}: AgentDashboardPageProps) {
  const navigate = useNavigate();
  const [expandedAgent, setExpandedAgent] = useState<string | null>(null);

  const totalAgents = agents.length;
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
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Total Agents", value: totalAgents.toString(), icon: <Bot className="w-4 h-4" /> },
          { label: "Total Spent", value: `${totalSpend.toFixed(4)} SUI`, icon: <DollarSign className="w-4 h-4 text-[#8C2C16]" />, accent: "text-[#8C2C16]" },
          { label: "Total Budget", value: `${totalBudget.toFixed(2)} SUI`, icon: <Activity className="w-4 h-4" /> },
        ].map((stat, i) => (
          <div key={i} className="p-4 bg-[#FAF9F6] border border-stone-200 rounded-xl">
            <div className="flex items-center gap-2 mb-2 text-stone-400">
              {stat.icon}
              <span className="text-xs font-sans text-stone-400 font-medium">{stat.label}</span>
            </div>
            <span className={`font-sans text-xl font-bold ${stat.accent || "text-[#1C1A17]"}`}>
              {stat.value}
            </span>
          </div>
        ))}
      </div>

      {/* Agent Cards */}
      <div className="space-y-4">
        <AnimatePresence>
          {agents.map((agent) => {
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
                  <div className="w-12 h-12 rounded-full flex items-center justify-center shrink-0 bg-emerald-50 border border-emerald-200">
                    <Bot className="w-6 h-6 text-emerald-600" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2.5">
                      <span className="font-sans text-sm font-bold uppercase truncate">{agent.name}</span>
                      <span className="px-2 py-0.5 text-xs font-sans font-bold rounded-full border bg-emerald-50 text-emerald-700 border-emerald-200">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block mr-1" />
                        active
                      </span>
                    </div>
                    <p className="text-xs text-stone-500 mt-0.5 truncate">{agent.description || agent.purpose}</p>
                  </div>

                  <div className="hidden md:flex items-center gap-6 text-right shrink-0">
                    <div>
                      <span className="text-xs font-sans text-stone-400 block">Spent</span>
                      <span className="font-sans text-sm font-bold text-[#8C2C16]">{agent.currentSpendSui.toFixed(4)}</span>
                    </div>
                    <div>
                      <span className="text-xs font-sans text-stone-400 block">Budget</span>
                      <span className="font-sans text-sm font-bold text-[#1C1A17]">{agent.maxBudgetSui.toFixed(2)}</span>
                    </div>
                  </div>

                  <button
                    onClick={() => setExpandedAgent(isExpanded ? null : agent.id)}
                    className="p-2 rounded-lg border border-stone-200 text-stone-500 hover:bg-stone-100 transition-all shrink-0"
                    title="Expand details"
                  >
                    {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>
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
                        {/* Agent Wallet (when backend provides it) */}
                        {agent.walletAddress && (
                          <div className="p-4 bg-white border border-stone-200 rounded-xl">
                            <div className="flex items-center justify-between mb-3">
                              <div className="flex items-center gap-2">
                                <Key className="w-3.5 h-3.5 text-stone-400" />
                                <span className="text-xs font-sans text-stone-400 font-medium">Agent Wallet</span>
                              </div>
                              <span className="flex items-center gap-1 px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded-full text-[10px] font-sans font-bold">
                                <span className="w-1 h-1 rounded-full bg-emerald-500" />
                                Generated
                              </span>
                            </div>
                            <div className="flex items-center gap-2 font-mono text-xs text-[#1C1A17] bg-stone-50 p-2.5 rounded-lg border border-stone-100">
                              <Wallet className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                              <span className="truncate">{agent.walletAddress}</span>
                            </div>
                            {agent.walletBalanceSui !== undefined && (
                              <div className="flex items-center justify-between mt-3 pt-3 border-t border-stone-100">
                                <span className="text-xs font-sans text-stone-400">Agent Balance</span>
                                <span className="font-sans text-sm font-bold text-[#8C2C16]">
                                  {agent.walletBalanceSui.toFixed(4)} SUI
                                </span>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Stats Grid */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                          <div className="bg-white p-3 border border-stone-100 rounded-xl">
                            <span className="text-xs font-sans text-stone-400 block mb-1">Purpose</span>
                            <span className="font-sans text-sm font-bold text-[#1C1A17] capitalize">{agent.purpose}</span>
                          </div>
                          <div className="bg-white p-3 border border-stone-100 rounded-xl">
                            <span className="text-xs font-sans text-stone-400 block mb-1">Remaining</span>
                            <span className="font-sans text-sm font-bold text-[#1C1A17]">
                              {((agent.maxBudgetSui - agent.currentSpendSui)).toFixed(4)} SUI
                            </span>
                          </div>
                          <div className="bg-white p-3 border border-stone-100 rounded-xl">
                            <span className="text-xs font-sans text-stone-400 block mb-1">Created</span>
                            <span className="font-sans text-xs font-bold text-[#1C1A17]">
                              {new Date(agent.createdAt).toLocaleDateString()}
                            </span>
                          </div>
                          <div className="bg-white p-3 border border-stone-100 rounded-xl">
                            <span className="text-xs font-sans text-stone-400 block mb-1">Stream</span>
                            <span className="font-sans text-xs font-bold text-[#1C1A17]">
                              {agent.activeStreamId ? agent.activeStreamId.substring(0, 12) + "..." : "None"}
                            </span>
                          </div>
                        </div>

                        {/* Connected Endpoints (when backend provides them) */}
                        {agent.connectedEndpoints && agent.connectedEndpoints.length > 0 && (
                          <div className="p-4 bg-white border border-stone-200 rounded-xl">
                            <div className="flex items-center gap-2 mb-3">
                              <Globe className="w-3.5 h-3.5 text-stone-400" />
                              <span className="text-xs font-sans text-stone-400 font-medium">Connected Endpoints</span>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {agent.connectedEndpoints.map((ep, i) => (
                                <span key={i} className="px-2.5 py-1 bg-stone-50 border border-stone-200 rounded-lg font-mono text-xs text-stone-600">
                                  {ep}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Remaining balance from on-chain */}
                        {agent.remainingBalanceMist !== undefined && (
                          <div className="p-4 bg-white border border-stone-200 rounded-xl">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-sans text-stone-400 font-medium">On-chain Stream Balance</span>
                              <span className="font-sans text-lg font-bold text-[#8C2C16]">
                                {(agent.remainingBalanceMist / 1_000_000_000).toFixed(4)} SUI
                              </span>
                            </div>
                          </div>
                        )}

                        {/* Agent Config Code Block */}
                        <div className="bg-[#1C1A17] text-[#8AF2D0] p-4 rounded-xl font-mono text-[10px] space-y-0.5 overflow-x-auto whitespace-pre">
                          <p className="text-white/40">// Agent Config</p>
                          <p>id: "{agent.id}"</p>
                          <p>name: "{agent.name}"</p>
                          <p>purpose: {agent.purpose}</p>
                          <p>budget: {agent.maxBudgetSui} SUI</p>
                          <p>spent: {agent.currentSpendSui.toFixed(6)} SUI</p>
                          <p>wallet: {agent.walletAddress || "pending..."}</p>
                          <p>stream: {agent.activeStreamId || "null"}</p>
                          <p>created: {agent.createdAt}</p>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Stream Balance Polling */}
                {agent.activeStreamId && (
                  <StreamBalancePoller
                    streamId={agent.activeStreamId}
                    onBalanceUpdate={(balanceSui) => {
                      const spent = agent.maxBudgetSui - balanceSui;
                      if (Math.abs(spent - agent.currentSpendSui) > 0.000001) {
                        onUpdateAgent(agent.id, { currentSpendSui: spent });
                      }
                    }}
                  />
                )}
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}
