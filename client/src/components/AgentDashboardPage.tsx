import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
import { Agent } from "../types";
import { getAgentBalance, listAgentStreams, AgentBalance, AgentStreamsResponse } from "../lib/api";
import {
  Bot,
  Plus,
  Activity,
  DollarSign,
  Globe,
  ArrowRight,
} from "lucide-react";

function AgentCardBalancePoller({
  agentId,
  onBalanceUpdate,
}: {
  agentId: string;
  onBalanceUpdate: (balance: AgentBalance) => void;
}) {
  const onUpdateRef = React.useRef(onBalanceUpdate);
  useEffect(() => {
    onUpdateRef.current = onBalanceUpdate;
  }, [onBalanceUpdate]);

  useEffect(() => {
    let isActive = true;
    const poll = async () => {
      try {
        const data = await getAgentBalance(agentId);
        if (isActive) onUpdateRef.current(data);
      } catch {
        // silent
      }
    };
    poll();
    const interval = setInterval(poll, 12000);
    return () => {
      isActive = false;
      clearInterval(interval);
    };
  }, [agentId]);

  return null;
}

interface AgentDashboardPageProps {
  agents: Agent[];
  onUpdateAgent?: (id: string, updates: Partial<Agent>) => void;
}

export default function AgentDashboardPage({
  agents,
}: AgentDashboardPageProps) {
  const navigate = useNavigate();

  const [agentStreams, setAgentStreams] = useState<
    Record<string, AgentStreamsResponse["streams"]>
  >({});
  const [agentBalances, setAgentBalances] = useState<
    Record<string, AgentBalance>
  >({});

  const fetchStreams = useCallback(async (agentId: string) => {
    try {
      const data = await listAgentStreams(agentId);
      setAgentStreams((prev) => ({ ...prev, [agentId]: data.streams }));
    } catch {
      // silent
    }
  }, []);

  useEffect(() => {
    agents.forEach((a) => fetchStreams(a.id));
  }, [agents, fetchStreams]);

  const totalAgents = agents.length;
  const totalSpend = agents.reduce((sum, a) => sum + a.currentSpendSui, 0);
  const totalBudget = agents.reduce((sum, a) => sum + a.maxBudgetSui, 0);

  // Empty state
  if (agents.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6">
        <div className="w-20 h-20 rounded-full bg-stone-100 border border-stone-200 flex items-center justify-center">
          <Bot className="w-10 h-10 text-stone-300" />
        </div>
        <div className="text-center flex flex-col gap-2">
          <h2 className="font-serif text-2xl font-bold text-[#1C1A17]">
            No agents deployed
          </h2>
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
            Click an agent to view details, streams, and activity.
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
          {
            label: "Total Agents",
            value: totalAgents.toString(),
            icon: <Bot className="w-4 h-4" />,
          },
          {
            label: "Total Spent",
            value: `${totalSpend.toFixed(4)} SUI`,
            icon: <DollarSign className="w-4 h-4 text-[#8C2C16]" />,
            accent: "text-[#8C2C16]",
          },
          {
            label: "Total Budget",
            value: `${totalBudget.toFixed(2)} SUI`,
            icon: <Activity className="w-4 h-4" />,
          },
        ].map((stat, i) => (
          <div
            key={i}
            className="p-4 bg-[#FAF9F6] border border-stone-200 rounded-xl"
          >
            <div className="flex items-center gap-2 mb-2 text-stone-400">
              {stat.icon}
              <span className="text-xs font-sans text-stone-400 font-medium">
                {stat.label}
              </span>
            </div>
            <span
              className={`font-sans text-xl font-bold ${stat.accent || "text-[#1C1A17]"}`}
            >
              {stat.value}
            </span>
          </div>
        ))}
      </div>

      {/* Agent Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <AnimatePresence>
          {agents.map((agent) => {
            const spendPercent =
              agent.maxBudgetSui > 0
                ? (agent.currentSpendSui / agent.maxBudgetSui) * 100
                : 0;
            const balance = agentBalances[agent.id];
            const streams = agentStreams[agent.id] || [];

            return (
              <motion.div
                key={agent.id}
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="group bg-[#FAF9F6] border border-stone-200 rounded-2xl overflow-hidden cursor-pointer hover:border-stone-300 hover:shadow-md transition-all duration-200"
                onClick={() => navigate(`/agent/${agent.id}`)}
              >
                <AgentCardBalancePoller
                  agentId={agent.id}
                  onBalanceUpdate={(b) =>
                    setAgentBalances((prev) => ({ ...prev, [agent.id]: b }))
                  }
                />

                {/* Card Header */}
                <div className="p-5 flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full flex items-center justify-center shrink-0 bg-emerald-50 border border-emerald-200 group-hover:bg-emerald-100 transition-colors">
                    <Bot className="w-6 h-6 text-emerald-600" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2.5">
                      <span className="font-sans text-sm font-bold uppercase truncate">
                        {agent.name}
                      </span>
                      <span className="px-2 py-0.5 text-xs font-sans font-bold rounded-full border bg-emerald-50 text-emerald-700 border-emerald-200">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block mr-1" />
                        active
                      </span>
                    </div>
                    <p className="text-xs text-stone-500 mt-0.5 truncate">
                      {agent.description || agent.purpose}
                    </p>
                  </div>

                  <ArrowRight className="w-4 h-4 text-stone-300 group-hover:text-[#8C2C16] group-hover:translate-x-0.5 transition-all shrink-0" />
                </div>

                {/* Stats Row */}
                <div className="px-5 pb-2 flex items-center gap-4">
                  <div>
                    <span className="text-[10px] font-sans text-stone-400 block">
                      Spent
                    </span>
                    <span className="font-sans text-xs font-bold text-[#8C2C16]">
                      {agent.currentSpendSui.toFixed(4)}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] font-sans text-stone-400 block">
                      Budget
                    </span>
                    <span className="font-sans text-xs font-bold text-[#1C1A17]">
                      {agent.maxBudgetSui.toFixed(2)} SUI
                    </span>
                  </div>
                  {balance && (
                    <div>
                      <span className="text-[10px] font-sans text-stone-400 block">
                        Wallet
                      </span>
                      <span className="font-sans text-xs font-bold text-emerald-700">
                        {balance.balanceSui.toFixed(4)}
                      </span>
                    </div>
                  )}
                  <div className="ml-auto">
                    <span className="text-[10px] font-sans text-stone-400 block">
                      Streams
                    </span>
                    <span className="font-sans text-xs font-bold text-[#1C1A17]">
                      {streams.length}
                    </span>
                  </div>
                </div>

                {/* Spend Bar */}
                <div className="px-5 pb-5 pt-2">
                  <div className="w-full h-1.5 bg-stone-200 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        spendPercent > 90
                          ? "bg-red-500"
                          : spendPercent > 70
                            ? "bg-amber-500"
                            : "bg-[#8C2C16]"
                      }`}
                      style={{ width: `${Math.min(spendPercent, 100)}%` }}
                    />
                  </div>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}
