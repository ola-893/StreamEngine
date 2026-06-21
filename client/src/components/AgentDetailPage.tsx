import React, { useState, useEffect, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
import { Agent } from "../types";
import { useToast } from "../lib/toast-context";
import {
  getAgentBalance,
  listAgentStreams,
  closeAgentStream,
  startAgent,
  fundAgent,
  withdrawAgent,
  deleteAgent,
  discoverProviders,
  AgentBalance,
  AgentStreamsResponse,
  DiscoveryCandidate,
  listProviders,
  ProviderListing,
} from "../lib/api";
import StreamingSessionPanel from "./StreamingSessionPanel";
import {
  Bot,
  ArrowLeft,
  Activity,
  DollarSign,
  Wallet,
  Key,
  Play,
  Trash2,
  RefreshCw,
  Zap,
  ArrowDownToLine,
  Send,
  Copy,
  Check,
  Terminal,
  ExternalLink,
  Clock,
  AlertTriangle,
  Radio,
  ShieldCheck,
  Database,
} from "lucide-react";

function formatDuration(totalSec: number): string {
  if (totalSec < 60) return `${totalSec}s`;
  if (totalSec < 3600) {
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${m}m ${s}s`;
  }
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  return `${h}h ${m}m`;
}

function AgentBalancePoller({
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
        if (isActive) {
          onUpdateRef.current(data);
        }
      } catch {
        // silent — agent may not have funds yet
      }
    };

    poll();
    const interval = setInterval(poll, 8000);
    return () => {
      isActive = false;
      clearInterval(interval);
    };
  }, [agentId]);

  return null;
}

interface AgentDetailPageProps {
  agents: Agent[];
  onUpdateAgent: (id: string, updates: Partial<Agent>) => void;
  onDeleteAgent: (id: string) => void;
  walletAddress: string | null;
}

interface ActivityLogEntry {
  id: string;
  timestamp: string;
  agentId: string;
  agentName: string;
  type: "start" | "fund" | "stream" | "close" | "error";
  title: string;
  detail: string;
  meta?: Record<string, string>;
}

export default function AgentDetailPage({
  agents,
  onUpdateAgent,
  onDeleteAgent,
  walletAddress,
}: AgentDetailPageProps) {
  const navigate = useNavigate();
  const { id: agentId } = useParams<{ id: string }>();
  const { addToast } = useToast();

  const agent = agents.find((a) => a.id === agentId);

  // Per-agent data
  const [balance, setBalance] = useState<AgentBalance | null>(null);
  const [streams, setStreams] = useState<
    AgentStreamsResponse["streams"]
  >([]);
  const [providers, setProviders] = useState<ProviderListing[]>([]);

  // Loading states
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Fund modal
  const [fundModalOpen, setFundModalOpen] = useState(false);
  const [fundAmountSui, setFundAmountSui] = useState<number>(1);
  const [copiedAddress, setCopiedAddress] = useState(false);

  // Discovery
  const [discoveryResults, setDiscoveryResults] = useState<DiscoveryCandidate[] | null>(null);
  const [discoveryLoading, setDiscoveryLoading] = useState(false);
  const [discoveryError, setDiscoveryError] = useState<string | null>(null);

  // Start modal with duration selector
  const [startModalOpen, setStartModalOpen] = useState(false);
  const [selectedDuration, setSelectedDuration] = useState<number>(3600);

  // Withdraw modal
  const [withdrawModalOpen, setWithdrawModalOpen] = useState(false);

  // Delete confirmation
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");

  // Activity log
  // Stream filter + pagination
  const [streamFilter, setStreamFilter] = useState<"all" | "active" | "finished">("all");
  const [streamPage, setStreamPage] = useState(1);
  const STREAMS_PER_PAGE = 5;

  // Activity log pagination
  const [activityPage, setActivityPage] = useState(1);
  const ACTIVITY_PER_PAGE = 8;
  const [streamStatuses, setStreamStatuses] = useState<Record<string, "streaming" | "depleted">>({});

  // Activity log
  const [activityLog, setActivityLog] = useState<ActivityLogEntry[]>([]);

  const addLogEntry = (entry: Omit<ActivityLogEntry, "id" | "timestamp">) => {
    setActivityLog((prev) => [
      {
        ...entry,
        id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        timestamp: new Date().toISOString(),
      },
      ...prev,
    ].slice(0, 50));
  };

  const fetchStreams = useCallback(async (id: string) => {
    try {
      const data = await listAgentStreams(id);
      setStreams(data.streams);
    } catch {
      // silent
    }
  }, []);

  useEffect(() => {
    if (agentId) {
      fetchStreams(agentId);
    }
  }, [agentId, fetchStreams]);

  useEffect(() => {
    let isActive = true;
    listProviders()
      .then((data) => {
        if (isActive) setProviders(data.providers);
      })
      .catch(() => {
        if (isActive) setProviders([]);
      });
    return () => {
      isActive = false;
    };
  }, []);

  // Redirect if agent not found
  if (!agent) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <Bot className="w-12 h-12 text-stone-300" />
        <p className="text-sm text-stone-500 font-sans">Agent not found.</p>
        <button
          onClick={() => navigate("/agent/dashboard")}
          className="px-4 py-2 text-xs font-sans border border-stone-300 bg-white hover:bg-stone-100 rounded-full transition-all"
        >
          Back to Dashboard
        </button>
      </div>
    );
  }

  const agentName = agent.name;
  const spendPercent =
    agent.maxBudgetSui > 0
      ? (agent.currentSpendSui / agent.maxBudgetSui) * 100
      : 0;
  const liveBalanceSui = balance?.balanceSui ?? 0;
  const totalStreamBalanceSui = streams.reduce(
    (sum, stream) => sum + (stream.balanceSui ?? 0),
    0
  );
  const providerRateMist = providers.length > 0 ? providers[0].ratePerSecond : 100_000;

  const formatMistRate = (rateMist: number) =>
    `${(rateMist / 1_000_000_000).toFixed(9).replace(/0+$/, "").replace(/\.$/, "")} SUI/s`;

  const providerNameForEndpoint = (endpoint: string) =>
    providers.find((provider) => provider.endpoint === endpoint)?.name ||
    endpoint.replace("/api/premium/", "").replace("/feed", "");

  // ─── Handlers ──────────────────────────────────────────────────────────

  const handleDiscover = async () => {
    setDiscoveryLoading(true);
    setDiscoveryError(null);
    try {
      const result = await discoverProviders(agent.id);
      setDiscoveryResults(result.recommendations);
      addLogEntry({
        agentId: agent.id,
        agentName,
        type: "stream",
        title: `Discovered ${result.recommendations.length} providers`,
        detail: `Top pick: ${result.recommendations[0]?.name || 'none'} (score ${result.recommendations[0]?.score || 0})`,
        meta: {
          balance: `${result.balanceSui.toFixed(4)} SUI`,
          total: `${result.totalProviders} providers scanned`,
        },
      });
    } catch (err: any) {
      setDiscoveryError(err.message);
      addToast({ variant: "error", title: "Discovery failed", message: err.message });
    } finally {
      setDiscoveryLoading(false);
    }
  };

  const handleStartAgent = async (durationSeconds: number) => {
    setStartModalOpen(false);
    setLoadingAction("start");
    setActionError(null);
    try {
      addLogEntry({
        agentId: agent.id,
        agentName,
        type: "start",
        title: "Starting agent...",
        detail: `Requesting stream for ${agentName} (${durationSeconds ? `${durationSeconds}s` : 'default'} duration)`,
      });
      const result = await startAgent(agent.id, durationSeconds);
      if (result.started) {
        await fetchStreams(agent.id);
        const b = await getAgentBalance(agent.id);
        setBalance(b);
        onUpdateAgent(agent.id, {});
        addLogEntry({
          agentId: agent.id,
          agentName,
          type: "stream",
          title: `Stream opened via ${result.provider || "unknown provider"}`,
          detail: `Deposited ${(result.depositMist || 0) / 1_000_000_000} SUI for stream access`,
          meta: {
            provider: result.provider || "—",
            streamId: result.streamId || "—",
            tx: result.creationTx || "—",
            deposit: `${((result.depositMist || 0) / 1_000_000_000).toFixed(4)} SUI`,
          },
        });
        addToast({
          variant: "success",
          title: `Connected to ${result.provider || "provider"}`,
          message: `Stream ${result.streamId?.substring(0, 12) || ""}… created — ${((result.depositMist || 0) / 1_000_000_000).toFixed(4)} SUI deposited`,
        });
      } else {
        addLogEntry({
          agentId: agent.id,
          agentName,
          type: "error",
          title: "Start failed",
          detail: result.message || "No matching providers found.",
        });
        setActionError(
          result.message || "Agent could not start — no matching providers"
        );
        addToast({
          variant: "error",
          title: "Agent failed to start",
          message: result.message || "No matching providers found.",
        });
      }
    } catch (err: any) {
      addLogEntry({
        agentId: agent.id,
        agentName,
        type: "error",
        title: "Start error",
        detail: err.message,
      });
      setActionError(err.message);
      addToast({ variant: "error", title: "Start failed", message: err.message });
    } finally {
      setLoadingAction(null);
    }
  };

  const handleFundAgent = async () => {
    setLoadingAction("fund");
    setActionError(null);
    try {
      const amountMist = Math.floor(fundAmountSui * 1_000_000_000);
      addLogEntry({
        agentId: agent.id,
        agentName,
        type: "fund",
        title: `Funding ${fundAmountSui} SUI...`,
        detail: "Depositing to agent wallet",
      });
      const result = await fundAgent(agent.id, amountMist);
      if (result.success) {
        const b = await getAgentBalance(agent.id);
        setBalance(b);
        onUpdateAgent(agent.id, {});
        setFundModalOpen(false);
        addLogEntry({
          agentId: agent.id,
          agentName,
          type: "fund",
          title: `Funded ${fundAmountSui} SUI`,
          detail: `Tx: ${result.digest?.substring(0, 16) || "—"}…`,
          meta: {
            digest: result.digest || "—",
            amount: `${fundAmountSui} SUI`,
          },
        });
        addToast({
          variant: "success",
          title: "Agent funded",
          message: `${fundAmountSui} SUI deposited successfully.`,
        });
      } else {
        addLogEntry({
          agentId: agent.id,
          agentName,
          type: "error",
          title: "Funding failed",
          detail: "Server returned an unsuccessful response.",
        });
        addToast({
          variant: "error",
          title: "Funding failed",
          message: "Server returned an unsuccessful response.",
        });
      }
    } catch (err: any) {
      const errorMessage = err.message || "Unknown error";
      addLogEntry({
        agentId: agent.id,
        agentName,
        type: "error",
        title: "Funding error",
        detail: errorMessage,
      });
      setActionError(errorMessage);
      addToast({
        variant: "error",
        title: "Funding failed",
        message: errorMessage,
      });
    } finally {
      setLoadingAction(null);
    }
  };

  const handleCloseStream = async (streamId: string) => {
    setLoadingAction(`close-${streamId}`);
    setActionError(null);
    try {
      addLogEntry({
        agentId: agent.id,
        agentName,
        type: "close",
        title: "Closing stream...",
        detail: `Stream ${streamId.substring(0, 12)}…`,
      });
      const result = await closeAgentStream(agent.id, streamId);
      await fetchStreams(agent.id);
      const b = await getAgentBalance(agent.id);
      setBalance(b);
      addLogEntry({
        agentId: agent.id,
        agentName,
        type: "close",
        title: "Stream closed",
        detail: `Refund tx: ${result.refundTx?.substring(0, 16) || "—"}…`,
        meta: { refundTx: result.refundTx || "—" },
      });
      addToast({
        variant: "success",
        title: "Stream closed",
        message: "The stream has been terminated.",
      });
    } catch (err: any) {
      addLogEntry({
        agentId: agent.id,
        agentName,
        type: "error",
        title: "Close failed",
        detail: err.message,
      });
      setActionError(err.message);
      addToast({
        variant: "error",
        title: "Close failed",
        message: err.message,
      });
    } finally {
      setLoadingAction(null);
    }
  };

  const handleWithdraw = async () => {
    setLoadingAction("withdraw");
    setActionError(null);
    try {
      if (!walletAddress) {
        throw new Error("Connect your wallet first — owner address is required");
      }
      addLogEntry({
        agentId: agent.id,
        agentName,
        type: "stream",
        title: "Withdrawing SUI...",
        detail: `Transferring remaining balance to ${walletAddress.substring(0, 10)}…`,
      });
      const result = await withdrawAgent(agent.id, walletAddress);
      if (result.success) {
        const b = await getAgentBalance(agent.id);
        setBalance(b);
        onUpdateAgent(agent.id, {});
        setWithdrawModalOpen(false);
        addLogEntry({
          agentId: agent.id,
          agentName,
          type: "stream",
          title: `Withdrew ${result.withdrawnSui.toFixed(4)} SUI`,
          detail: `Tx: ${result.digest?.substring(0, 16) || "—"}…`,
          meta: {
            digest: result.digest || "—",
            amount: `${result.withdrawnSui.toFixed(4)} SUI`,
            remaining: `${result.remainingSui.toFixed(4)} SUI`,
          },
        });
        addToast({
          variant: "success",
          title: "Withdrawal successful",
          message: `${result.withdrawnSui.toFixed(4)} SUI transferred to your wallet.`,
        });
      }
    } catch (err: any) {
      const errorMessage = err.message || "Unknown error";
      addLogEntry({
        agentId: agent.id,
        agentName,
        type: "error",
        title: "Withdrawal failed",
        detail: errorMessage,
      });
      setActionError(errorMessage);
      addToast({
        variant: "error",
        title: "Withdrawal failed",
        message: errorMessage,
      });
    } finally {
      setLoadingAction(null);
    }
  };

  const handleRefreshBalance = async () => {
    setLoadingAction("refresh");
    try {
      const b = await getAgentBalance(agent.id);
      setBalance(b);
      addToast({
        variant: "success",
        title: "Balance refreshed",
        message: `Wallet: ${b.balanceSui.toFixed(4)} SUI`,
      });
    } catch {
      addToast({
        variant: "error",
        title: "Refresh failed",
        message: "Could not fetch balance.",
      });
    }
    setLoadingAction(null);
  };

  const handleDeleteAgent = async () => {
    setLoadingAction("delete");
    setActionError(null);
    try {
      await deleteAgent(agent.id);
      onDeleteAgent(agent.id);
      addToast({
        variant: "success",
        title: "Agent deleted",
        message: `"${agent.name}" has been removed.`,
      });
      navigate("/agent/dashboard");
    } catch (err: any) {
      setActionError(err.message);
      addToast({
        variant: "error",
        title: "Delete failed",
        message: err.message,
      });
    } finally {
      setLoadingAction(null);
      setDeleteModalOpen(false);
      setDeleteConfirmText("");
    }
  };

  // ─── Render ────────────────────────────────────────────────────────────

  return (
    <div className="space-y-8">
      {/* Balance Poller */}
      <AgentBalancePoller
        agentId={agent.id}
        onBalanceUpdate={(b) => setBalance(b)}
      />

      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3 sm:gap-4">
          <button
            onClick={() => navigate("/agent/dashboard")}
            className="p-2 rounded-lg border border-stone-200 text-stone-500 hover:bg-stone-100 transition-all"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <div className="flex items-center gap-2 text-[#8C2C16] font-sans text-sm font-semibold mb-1">
              <span className="w-1.5 h-1.5 bg-[#8C2C16]" />
              Agent Detail
            </div>
            <h1 className="font-sans text-2xl sm:text-3xl font-bold text-[#1C1A17]">
              {agent.name}
            </h1>
            <p className="text-xs sm:text-sm text-stone-500 mt-1">
              {agent.description || agent.purpose}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="px-2.5 py-1 text-xs font-sans font-bold rounded-full border bg-emerald-50 text-emerald-700 border-emerald-200">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block mr-1" />
            active
          </span>
        </div>
      </div>

      {/* Global error */}
      {actionError && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-xs font-sans text-red-700 flex items-center justify-between">
          <span>{actionError}</span>
          <button
            onClick={() => setActionError(null)}
            className="text-red-500 hover:text-red-700"
          >
            <span className="text-xs">dismiss</span>
          </button>
        </div>
      )}

      {/* Overview */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
        {[
          { label: "Wallet", value: `${liveBalanceSui.toFixed(4)} SUI`, icon: Wallet, tone: "text-[#8C2C16]" },
          { label: "Streams", value: String(streams.length), icon: Radio, tone: streams.length > 0 ? "text-emerald-600" : "text-stone-500" },
          { label: "Stream Escrow", value: `${totalStreamBalanceSui.toFixed(6)} SUI`, icon: ShieldCheck, tone: "text-[#1C1A17]" },
          { label: "Purpose", value: agent.purpose, icon: Activity, tone: "text-[#1C1A17]" },
        ].map((item) => {
          const Icon = item.icon;
          return (
            <div key={item.label} className="p-4 bg-[#FAF9F6] border border-stone-200 rounded-lg">
              <div className="flex items-center gap-2 text-stone-400 mb-2">
                <Icon className="w-4 h-4" />
                <span className="text-xs font-sans font-medium">{item.label}</span>
              </div>
              <div className={`font-sans text-lg font-bold capitalize ${item.tone}`}>
                {item.value}
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px] xl:grid-cols-[minmax(0,1fr)_360px] gap-5 sm:gap-6 items-start">
        <main className="space-y-5 min-w-0">
          <section>              <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Radio className={`w-4 h-4 ${streams.length > 0 ? "text-emerald-500 animate-pulse" : "text-stone-300"}`} />
                <span className="text-xs font-sans text-stone-400 font-medium">Live Operation</span>
              </div>
              <div className="flex items-center gap-1">
                {([
                  { key: 'all' as const, label: 'All' },
                  { key: 'active' as const, label: 'Active' },
                  { key: 'finished' as const, label: 'Done' },
                ]).map(({ key, label }) => {
                  const count = key === 'all'
                    ? streams.length
                    : streams.filter((s) => {
                        const st = streamStatuses[s.streamId];
                        return key === 'active' ? st !== 'depleted' : st === 'depleted';
                      }).length;
                  return (
                    <button
                      key={key}
                      onClick={() => { setStreamFilter(key); setStreamPage(1); }}
                      className={`px-2.5 py-1 text-[10px] font-sans font-bold rounded-md transition-all ${
                        streamFilter === key
                          ? key === 'active'
                            ? 'bg-emerald-50 text-emerald-700 shadow-sm'
                            : key === 'finished'
                              ? 'bg-stone-100 text-stone-600 shadow-sm'
                              : 'bg-white text-[#1C1A17] shadow-sm'
                          : 'text-stone-400 hover:text-stone-600'
                      }`}
                    >
                      {label} <span className="opacity-60">{count}</span>
                    </button>
                  );
                })}
              </div>
            </div>
            {(() => {
              const filteredStreams = streams.filter((s) => {
                const st = streamStatuses[s.streamId];
                if (streamFilter === 'all') return true;
                return streamFilter === "active" ? st !== "depleted" : st === "depleted";
              });
              if (streams.length === 0) {
                return (
                  <div className="p-8 bg-[#FAF9F6] border border-stone-200 rounded-lg text-center">
                    <Radio className="w-9 h-9 text-stone-200 mx-auto mb-3" />
                    <p className="text-sm font-sans font-bold text-[#1C1A17]">No stream open</p>
                    <p className="text-xs text-stone-400 mt-1">Start the agent to create a Sui stream and unlock a protected feed.</p>
                  </div>
                );
              }
              if (filteredStreams.length === 0) {
                return (
                  <div className="p-6 bg-[#FAF9F6] border border-stone-200 rounded-lg text-center">
                    <p className="text-xs font-sans text-stone-400">
                      No {streamFilter === 'all' ? '' : streamFilter === "active" ? "active" : "finished"} streams yet.
                    </p>
                  </div>
                );
              }
              const shownStreams = filteredStreams.slice(0, streamPage * STREAMS_PER_PAGE);
              return (
                <>
                  <div className="space-y-4">
                    {shownStreams.map((stream) => (
                      <StreamingSessionPanel
                        key={stream.streamId}
                        agentId={agent.id}
                        streamId={stream.streamId}
                        providerName={providerNameForEndpoint(stream.endpoint)}
                        onClose={() => handleCloseStream(stream.streamId)}
                        onStatusChange={(sid, status) => setStreamStatuses((prev) => ({ ...prev, [sid]: status }))}
                      />
                    ))}
                  </div>
                  {filteredStreams.length > shownStreams.length && (
                    <button
                      onClick={() => setStreamPage((p) => p + 1)}
                      className="w-full mt-3 py-2 text-[10px] font-sans font-bold text-stone-400 hover:text-[#8C2C16] bg-[#FAF9F6] border border-stone-200 rounded-lg hover:border-[#8C2C16] transition-all"
                    >
                      Show more ({filteredStreams.length - shownStreams.length} remaining)
                    </button>
                  )}
                </>
              );
            })()}
          </section>

          <section className="p-5 bg-[#FAF9F6] border border-stone-200 rounded-lg">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Terminal className="w-4 h-4 text-stone-400" />
                <span className="text-xs font-sans text-stone-400 font-medium">Activity</span>
                <span className="px-1.5 py-0.5 text-[10px] font-mono font-bold bg-stone-100 text-stone-500 rounded">
                  {activityLog.length}
                </span>
              </div>
              {activityLog.length > 0 && (                  <button
                  onClick={() => { setActivityLog([]); setActivityPage(1); }}
                  className="text-[10px] font-sans text-stone-400 hover:text-stone-600 transition-colors"
                >
                  clear
                </button>
              )}
            </div>
            {activityLog.length === 0 ? (
              <div className="py-7 text-center">
                <Terminal className="w-8 h-8 text-stone-200 mx-auto mb-2" />
                <p className="text-xs text-stone-400 font-sans">No activity yet.</p>
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  {activityLog.slice(0, activityPage * ACTIVITY_PER_PAGE).map((entry) => (
                    <div key={entry.id} className="grid grid-cols-[8px_minmax(0,1fr)_auto] gap-3 p-3 bg-white border border-stone-100 rounded-lg">
                    <div
                      className={`w-2 h-2 rounded-full mt-1.5 ${
                        entry.type === "error"
                          ? "bg-red-500"
                          : entry.type === "stream"
                            ? "bg-emerald-500"
                            : entry.type === "fund"
                              ? "bg-amber-500"
                              : entry.type === "close"
                                ? "bg-orange-500"
                                : "bg-blue-500"
                      }`}
                    />
                    <div className="min-w-0">
                      <p className="font-sans text-xs font-bold text-[#1C1A17]">{entry.title}</p>
                      <p className="text-[10px] text-stone-500 font-mono mt-0.5 truncate">{entry.detail}</p>
                      {entry.meta && (
                        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1.5">
                          {Object.entries(entry.meta).map(([k, v]) => {
                            const isChainRef = ["tx", "digest", "refundTx", "streamId"].includes(k) && v !== "—";
                            const href = k === "streamId"
                              ? `https://suiscan.xyz/testnet/object/${v}`
                              : `https://suiscan.xyz/testnet/tx/${v}`;
                            return (
                              <span key={k} className="text-[10px] text-stone-400 font-mono">
                                <span className="text-stone-500">{k}:</span>{" "}
                                {isChainRef ? (
                                  <a href={href} target="_blank" rel="noopener noreferrer" className="text-[#8C2C16] hover:underline inline-flex items-center gap-0.5">
                                    {v.substring(0, 12)}…
                                    <ExternalLink className="w-2.5 h-2.5" />
                                  </a>
                                ) : (
                                  v
                                )}
                              </span>
                            );
                          })}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-1 text-stone-300 shrink-0">
                      <Clock className="w-2.5 h-2.5" />
                      <span className="text-[10px] font-mono">
                        {new Date(entry.timestamp).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                          second: "2-digit",
                        })}
                      </span>
                    </div>
                  </div>
                ))}
                </div>
                {activityLog.length > activityPage * ACTIVITY_PER_PAGE && (
                  <button
                    onClick={() => setActivityPage((p) => p + 1)}
                    className="w-full mt-2 py-2 text-[10px] font-sans font-bold text-stone-400 hover:text-[#8C2C16] bg-white border border-stone-200 rounded-lg hover:border-[#8C2C16] transition-all"
                  >
                    Show more ({activityLog.length - activityPage * ACTIVITY_PER_PAGE} remaining)
                  </button>
                )}
              </>
            )}
          </section>

          {/* Discovery Results */}
          {discoveryResults && discoveryResults.length > 0 && (
            <section className="p-4 bg-blue-50/50 border border-blue-200 rounded-lg">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Database className="w-4 h-4 text-blue-500" />
                  <span className="text-xs font-sans text-blue-700 font-medium">Discovery Results</span>
                </div>
                <button onClick={() => setDiscoveryResults(null)} className="text-[10px] font-sans text-blue-400 hover:text-blue-600">clear</button>
              </div>
              <div className="space-y-2">
                {discoveryResults.slice(0, 5).map((c, i) => (
                  <div key={c.providerId} className="p-3 bg-white border border-blue-100 rounded-lg">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-[10px] font-bold shrink-0">{i + 1}</span>
                        <span className="font-sans text-xs font-bold text-[#1C1A17] truncate">{c.name}</span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="px-1.5 py-0.5 text-[10px] font-mono font-bold bg-blue-100 text-blue-700 rounded">score {c.score}</span>
                        <span className="text-[10px] font-mono text-[#8C2C16]">{c.rateSuiPerSec.toFixed(6)} SUI/s</span>
                      </div>
                    </div>
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {c.reasons.map((r, j) => (
                        <span key={j} className="px-1.5 py-0.5 text-[9px] font-sans bg-stone-100 text-stone-500 rounded">{r}</span>
                      ))}
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      <button
                        onClick={() => setStartModalOpen(true)}
                        className="px-2.5 py-1 text-[10px] font-sans font-bold bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded transition-all"
                      >
                        Stream →
                      </button>
                      <span className="text-[10px] font-mono text-stone-400">{c.maxStreamSeconds}s max</span>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
          {discoveryError && (
            <section className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-xs font-sans text-red-600">{discoveryError}</p>
            </section>
          )}
        </main>

        <aside className="space-y-5 xl:sticky xl:top-4">
          <section className="p-4 bg-[#FAF9F6] border border-stone-200 rounded-lg">
            <div className="flex items-center gap-2 mb-3">
              <Zap className="w-4 h-4 text-stone-400" />
              <span className="text-xs font-sans text-stone-400 font-medium">Controls</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setStartModalOpen(true)}
                disabled={loadingAction === "start"}
                className="px-3 py-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-lg text-xs font-sans font-bold transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                {loadingAction === "start" ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
                Start
              </button>
              <button
                onClick={handleDiscover}
                disabled={discoveryLoading}
                className="px-3 py-2.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-lg text-xs font-sans font-bold transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                {discoveryLoading ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Database className="w-3 h-3" />}
                Discover
              </button>
              <button
                onClick={() => setFundModalOpen(true)}
                className="px-3 py-2.5 bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 rounded-lg text-xs font-sans font-bold transition-all flex items-center justify-center gap-1.5"
              >
                <DollarSign className="w-3 h-3" />
                Fund
              </button>
              <button
                onClick={() => setWithdrawModalOpen(true)}
                disabled={liveBalanceSui <= 0.01}
                title={liveBalanceSui <= 0.01 ? 'Insufficient balance to withdraw' : 'Withdraw SUI to your wallet'}
                className="px-3 py-2.5 bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 rounded-lg text-xs font-sans font-bold transition-all flex items-center justify-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ArrowDownToLine className="w-3 h-3" />
                Withdraw
              </button>
              <button
                onClick={handleRefreshBalance}
                disabled={loadingAction === "refresh"}
                className="px-3 py-2.5 bg-white hover:bg-stone-100 text-stone-600 border border-stone-200 rounded-lg text-xs font-sans font-bold transition-all flex items-center justify-center gap-1.5"
              >
                <RefreshCw className={`w-3 h-3 ${loadingAction === "refresh" ? "animate-spin" : ""}`} />
                Refresh
              </button>
              <button
                onClick={() => setDeleteModalOpen(true)}
                disabled={loadingAction === "delete"}
                className="px-3 py-2.5 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 rounded-lg text-xs font-sans font-bold transition-all flex items-center justify-center gap-1.5"
              >
                <Trash2 className="w-3 h-3" />
                Delete
              </button>
            </div>
          </section>

          {agent.walletAddress && (
            <section className="p-4 bg-[#FAF9F6] border border-stone-200 rounded-lg">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Key className="w-4 h-4 text-stone-400" />
                  <span className="text-xs font-sans text-stone-400 font-medium">Wallet</span>
                </div>
                <span className="font-sans text-sm font-bold text-[#8C2C16]">{liveBalanceSui.toFixed(4)} SUI</span>
              </div>
              <div className="flex items-center gap-2 font-mono text-xs text-[#1C1A17] bg-white p-2.5 rounded-lg border border-stone-100">
                <Wallet className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                <span className="truncate flex-1 min-w-0">{agent.walletAddress}</span>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(agent.walletAddress || "");
                    setCopiedAddress(true);
                    addToast({ variant: "success", title: "Copied to clipboard" });
                    setTimeout(() => setCopiedAddress(false), 2000);
                  }}
                  className="shrink-0 p-1 text-stone-400 hover:text-stone-700 transition-colors cursor-pointer"
                  title="Copy wallet address"
                >
                  {copiedAddress ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
              <div className="mt-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-sans text-stone-400">Budget usage</span>
                  <span className="text-xs font-mono text-stone-500">{spendPercent.toFixed(1)}%</span>
                </div>
                <div className="w-full h-2 bg-stone-200 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all duration-500 ${
                      spendPercent > 90 ? "bg-red-500" : spendPercent > 70 ? "bg-amber-500" : "bg-[#8C2C16]"
                    }`}
                    style={{ width: `${Math.min(spendPercent, 100)}%` }}
                  />
                </div>
                <div className="flex items-center justify-between mt-2 text-[10px] font-mono text-stone-400">
                  <span>{agent.currentSpendSui.toFixed(4)} SUI spent</span>
                  <span>{agent.maxBudgetSui.toFixed(2)} SUI budget</span>
                </div>
              </div>
            </section>
          )}

          {/* <section className="p-4 bg-[#FAF9F6] border border-stone-200 rounded-lg">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Database className="w-4 h-4 text-stone-400" />
                <span className="text-xs font-sans text-stone-400 font-medium">Available Endpoints</span>
              </div>
              <span className="px-2 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 rounded text-[10px] font-sans font-bold">
                Demo feeds
              </span>
            </div>
            <div className="space-y-2">
              {providers.map((provider) => (
                <div key={provider.id} className="p-3 bg-white border border-stone-100 rounded-lg">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-sans text-xs font-bold text-[#1C1A17] truncate">{provider.name}</span>
                    <span className="text-[10px] font-mono text-[#8C2C16] shrink-0">{formatMistRate(provider.ratePerSecond)}</span>
                  </div>
                  <div className="mt-1 flex items-center gap-1 text-[10px] font-mono text-stone-400 min-w-0">
                    <ShieldCheck className="w-3 h-3 text-emerald-500 shrink-0" />
                    <span className="truncate">{provider.endpoint}</span>
                  </div>
                </div>
              ))}
              {providers.length === 0 && (
                <div className="py-5 text-center text-xs text-stone-400 font-sans">
                  Registry unavailable.
                </div>
              )}
            </div>
            <p className="text-[10px] font-sans text-stone-400 leading-relaxed mt-3">
              On-chain stream creation and access checks are real Sui testnet calls. Feed payloads are seeded demo data, not live scrapes from X, Reddit, or Bloomberg.
            </p>
          </section> */}

          <section className="bg-[#1C1A17] text-[#8AF2D0] p-4 rounded-lg font-mono text-[10px] space-y-1 overflow-x-auto">
            <p className="text-white/40">agent</p>
            <p>id: "{agent.id}"</p>
            <p>created: {agent.createdAt}</p>
            <p>streams: {streams.length}</p>
          </section>
        </aside>
      </div>

      {/* Start Modal — Duration Selector */}
      <AnimatePresence>
        {startModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
            onClick={() => setStartModalOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-[#FAF9F6] border border-stone-200 rounded-2xl p-6 w-full max-w-md shadow-xl"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-sans text-lg font-bold text-[#1C1A17]">
                  Start Agent
                </h3>
                <button
                  onClick={() => setStartModalOpen(false)}
                  className="p-1.5 text-stone-400 hover:text-stone-600"
                >
                  ✕
                </button>
              </div>

              <p className="text-sm text-stone-500 mb-4">
                Choose how long {agentName} should scrape data. The stream deposit is calculated at the provider rate.
              </p>

              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-sans text-stone-500 font-medium">
                    Duration
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { label: "1 min", seconds: 60 },
                      { label: "10 min", seconds: 600 },
                      { label: "1 hour", seconds: 3600 },
                      { label: "6 hours", seconds: 21600 },
                      { label: "1 day", seconds: 86400 },
                      { label: "1 week", seconds: 604800 },
                      { label: "2 weeks", seconds: 1209600 },
                    ].map((opt) => (
                      <button
                        key={opt.label}
                        onClick={() => setSelectedDuration(opt.seconds)}
                        className={`py-2 border rounded-lg text-xs font-sans font-bold transition-all ${
                          selectedDuration === opt.seconds
                            ? "border-[#8C2C16] bg-[#8C2C16]/5 text-[#8C2C16]"
                            : "border-stone-200 bg-white text-stone-500 hover:border-stone-300"
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                  <div className="mt-2">
                    <label className="text-[10px] font-sans text-stone-400 font-medium block mb-1">
                      Custom (seconds)
                    </label>
                    <input
                      type="number"
                      min="60"
                      step="60"
                      value={selectedDuration}
                      onChange={(e) => {
                        const val = parseInt(e.target.value);
                        setSelectedDuration(val >= 60 ? val : 60);
                      }}
                      className="w-full px-4 py-3 bg-white border border-stone-200 rounded-xl font-sans text-sm text-[#1C1A17] focus:outline-none focus:border-[#8C2C16] focus:ring-1 focus:ring-[#8C2C16]/20 transition-all"
                    />
                    <p className="text-[10px] text-stone-400 mt-1 font-mono">
                      {(selectedDuration / 60).toFixed(0)} minutes ({(selectedDuration / 3600).toFixed(1)} hours)
                    </p>
                  </div>
                </div>

                <div className="p-3 bg-white border border-stone-100 rounded-lg">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-sans text-stone-400">Estimated deposit</span>
                    <span className="font-sans text-sm font-bold text-[#8C2C16]">
                      {((providerRateMist * selectedDuration) / 1_000_000_000).toFixed(4)} SUI
                    </span>
                  </div>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-[10px] font-mono text-stone-400">{providerRateMist.toLocaleString()} MIST/s × {selectedDuration}s</span>
                    <span className="text-[10px] font-mono text-stone-400">
                      {formatDuration(selectedDuration)}
                    </span>
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => setStartModalOpen(false)}
                    className="flex-1 py-3 px-6 bg-transparent hover:bg-[#1C1A17]/5 text-[#1C1A17] border border-[#1C1A17]/30 rounded-full text-sm font-sans font-bold transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => handleStartAgent(selectedDuration)}
                    className="flex-1 py-3 px-6 bg-emerald-600 hover:bg-emerald-700 text-white font-sans text-sm font-bold rounded-full flex items-center justify-center gap-2 transition-all"
                  >
                    <Play className="w-4 h-4" />
                    Start Agent
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {deleteModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
            onClick={() => { setDeleteModalOpen(false); setDeleteConfirmText(""); }}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-[#FAF9F6] border border-red-200 rounded-2xl p-6 w-full max-w-md shadow-xl"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-red-50 border border-red-200 flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-5 h-5 text-red-600" />
                </div>
                <div>
                  <h3 className="font-sans text-lg font-bold text-[#1C1A17]">
                    Delete Agent
                  </h3>
                  <p className="text-xs text-stone-500">
                    This action cannot be undone.
                  </p>
                </div>
              </div>

              <p className="text-sm text-stone-600 mb-4">
                Are you sure you want to permanently delete <span className="font-bold">{agent.name}</span>? Any active streams will remain on-chain but will no longer be tracked.
              </p>

              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-sans text-stone-500 font-medium">
                    Type <span className="font-mono font-bold text-red-600">{agent.name}</span> to confirm
                  </label>
                  <input
                    type="text"
                    value={deleteConfirmText}
                    onChange={(e) => setDeleteConfirmText(e.target.value)}
                    placeholder={agent.name}
                    className="w-full px-4 py-3 bg-white border border-stone-200 rounded-xl font-sans text-sm text-[#1C1A17] focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500/20 transition-all"
                  />
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => { setDeleteModalOpen(false); setDeleteConfirmText(""); }}
                    className="flex-1 py-3 px-6 bg-transparent hover:bg-[#1C1A17]/5 text-[#1C1A17] border border-[#1C1A17]/30 rounded-full text-sm font-sans font-bold transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleDeleteAgent}
                    disabled={
                      loadingAction === "delete" ||
                      deleteConfirmText !== agent.name
                    }
                    className="flex-1 py-3 px-6 bg-red-600 hover:bg-red-700 disabled:opacity-40 text-white font-sans text-sm font-bold rounded-full flex items-center justify-center gap-2 transition-all"
                  >
                    {loadingAction === "delete" ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <Trash2 className="w-4 h-4" />
                    )}
                    Delete
                    
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Withdraw Modal */}
      <AnimatePresence>
        {withdrawModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
            onClick={() => setWithdrawModalOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-[#FAF9F6] border border-stone-200 rounded-2xl p-6 w-full max-w-md shadow-xl"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-sans text-lg font-bold text-[#1C1A17]">
                  Withdraw SUI
                </h3>
                <button
                  onClick={() => setWithdrawModalOpen(false)}
                  className="p-1.5 text-stone-400 hover:text-stone-600"
                >
                  ✕
                </button>
              </div>

              <p className="text-sm text-stone-500 mb-4">
                Transfer remaining SUI from <span className="font-bold">{agentName}</span>'s wallet back to your connected wallet.
              </p>

              <div className="space-y-4">
                <div className="p-4 bg-white border border-stone-100 rounded-lg space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-sans text-stone-400">Agent wallet balance</span>
                    <span className="font-sans text-sm font-bold text-[#1C1A17]">
                      {liveBalanceSui.toFixed(4)} SUI
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-sans text-stone-400">Gas reserve (kept)</span>
                    <span className="text-xs font-mono text-stone-500">~0.01 SUI</span>
                  </div>
                  <div className="h-px bg-stone-100" />
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-sans text-stone-500 font-medium">You will receive</span>
                    <span className="font-sans text-sm font-bold text-purple-700">
                      {Math.max(0, liveBalanceSui - 0.01).toFixed(4)} SUI
                    </span>
                  </div>
                </div>

                {walletAddress && (
                  <div className="p-3 bg-purple-50 border border-purple-200 rounded-lg">
                    <div className="flex items-center gap-2">
                      <Wallet className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                      <span className="text-[10px] font-mono text-purple-700 truncate">{walletAddress}</span>
                    </div>
                    <p className="text-[10px] font-sans text-purple-500 mt-1">Recipient: your connected wallet</p>
                  </div>
                )}

                {!walletAddress && (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                      <span className="text-xs font-sans text-amber-700">Connect your wallet first</span>
                    </div>
                  </div>
                )}

                <div className="flex gap-2">
                  <button
                    onClick={() => setWithdrawModalOpen(false)}
                    className="flex-1 py-3 px-6 bg-transparent hover:bg-[#1C1A17]/5 text-[#1C1A17] border border-[#1C1A17]/30 rounded-full text-sm font-sans font-bold transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleWithdraw}
                    disabled={loadingAction === "withdraw" || liveBalanceSui <= 0.01 || !walletAddress}
                    className="flex-1 py-3 px-6 bg-purple-600 hover:bg-purple-700 disabled:opacity-40 text-white font-sans text-sm font-bold rounded-full flex items-center justify-center gap-2 transition-all"
                  >
                    {loadingAction === "withdraw" ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <ArrowDownToLine className="w-4 h-4" />
                    )}
                    Withdraw
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Fund Modal */}
      <AnimatePresence>
        {fundModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
            onClick={() => setFundModalOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-[#FAF9F6] border border-stone-200 rounded-2xl p-6 w-full max-w-md shadow-xl"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-sans text-lg font-bold text-[#1C1A17]">
                  Fund Agent Wallet
                </h3>
                <button
                  onClick={() => setFundModalOpen(false)}
                  className="p-1.5 text-stone-400 hover:text-stone-600"
                >
                  ✕
                </button>
              </div>

              <p className="text-sm text-stone-500 mb-4">
                This will transfer SUI from a test wallet to the agent's wallet
                for demo purposes.
              </p>

              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-sans text-stone-500 font-medium">
                    Amount (SUI)
                  </label>
                  <div className="flex gap-2">
                    {[0.5, 1, 2, 5].map((amt) => (
                      <button
                        key={amt}
                        onClick={() => setFundAmountSui(amt)}
                        className={`flex-1 py-2 border rounded-lg text-xs font-sans font-bold transition-all ${
                          fundAmountSui === amt
                            ? "border-[#8C2C16] bg-[#8C2C16]/5 text-[#8C2C16]"
                            : "border-stone-200 bg-white text-stone-500 hover:border-stone-300"
                        }`}
                      >
                        {amt} SUI
                      </button>
                    ))}
                  </div>
                  <input
                    type="number"
                    min="0.1"
                    step="0.1"
                    value={fundAmountSui}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      setFundAmountSui(val > 0 ? val : 0.1);
                    }}
                    className="w-full px-4 py-3 bg-white border border-stone-200 rounded-xl font-sans text-sm text-[#1C1A17] focus:outline-none focus:border-[#8C2C16] focus:ring-1 focus:ring-[#8C2C16]/20 transition-all"
                  />
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => setFundModalOpen(false)}
                    className="flex-1 py-3 px-6 bg-transparent hover:bg-[#1C1A17]/5 text-[#1C1A17] border border-[#1C1A17]/30 rounded-full text-sm font-sans font-bold transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleFundAgent}
                    disabled={
                      loadingAction === "fund" || fundAmountSui <= 0
                    }
                    className="flex-1 py-3 px-6 bg-[#8C2C16] hover:bg-[#A63A23] disabled:opacity-40 text-white font-sans text-sm font-bold rounded-full flex items-center justify-center gap-2 transition-all"
                  >
                    {loadingAction === "fund" ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <Send className="w-4 h-4" />
                    )}
                    Fund {fundAmountSui} SUI
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
