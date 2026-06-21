import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
import { Transaction } from "@mysten/sui/transactions";
import { dAppKit } from "../dapp-kit-config";
import { Endpoint, API_BASE, ProviderListing } from "../types";
import {
  listProviders,

  getProviderConsumers,
  getProviderStreams,
  updateProvider,
  deleteProvider,
  ProviderConsumer,
  ProviderStream,
  ProviderStreamsResponse,
} from "../lib/api";
import { useToast } from "../lib/toast-context";
import {
  ArrowLeft,
  Wallet,
  ExternalLink,
  TrendingUp,
  Users,
  RefreshCw,
  Activity,
  Radio,
  Clock,
  DollarSign,
  Zap,
  Save,
  Edit3,
  Trash2,
  ChevronRight,
  Download,
  ArrowDownToLine,
  CircleDollarSign,
} from "lucide-react";

const PACKAGE_ID = import.meta.env.VITE_SUI_DATA_GATE_PACKAGE_ID || "0xb05b3964df8b88a86cda6b192893399966014af9dd6fc6beb26f1343a0495495";

interface ProviderPageProps {
  endpoints: Endpoint[];
  isWalletConnected: boolean;
  walletAddress: string | null;
}

// ─── Earnings Chart (pure SVG, no dependencies) ──────────────────
function EarningsChart({ consumers, totalEarnedMist }: { consumers: ProviderConsumer[]; totalEarnedMist: number }) {
  const now = Date.now();
  const WIDTH = 600;
  const HEIGHT = 180;
  const PAD = { top: 16, right: 16, bottom: 28, left: 48 };
  const plotW = WIDTH - PAD.left - PAD.right;
  const plotH = HEIGHT - PAD.top - PAD.bottom;

  if (consumers.length === 0 || totalEarnedMist === 0) {
    return (
      <div className="p-5 bg-[#FAF9F6] border border-stone-200 rounded-lg">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="w-4 h-4 text-stone-400" />
          <span className="text-xs font-sans text-stone-400 font-medium">Earnings Over Time</span>
        </div>
        <div className="flex items-center justify-center h-[140px] text-xs font-sans text-stone-300">
          No earnings data yet
        </div>
      </div>
    );
  }

  // Build time-series data points: cumulative earnings at each stream start + now
  interface Point { t: number; cumMist: number; label: string; }
  const events: { t: number; deltaMist: number }[] = [];

  for (const c of consumers) {
    const opened = new Date(c.openedAt).getTime();
    // Earnings accrued by this stream so far
    const effectiveElapsed = Math.min(c.elapsedSec, c.durationSeconds || c.elapsedSec);
    const earned = effectiveElapsed * c.ratePerSecondMist;
    events.push({ t: opened, deltaMist: earned });
  }

  // Sort by time
  events.sort((a, b) => a.t - b.t);

  // Build cumulative points
  const points: Point[] = [];
  let cum = 0;
  for (const e of events) {
    points.push({ t: e.t, cumMist: cum, label: '' });
    cum += e.deltaMist;
    points.push({ t: e.t + 1, cumMist: cum, label: '' });
  }
  // Add final point at now
  points.push({ t: now, cumMist: cum, label: '' });

  // Deduplicate consecutive same-time points
  const deduped: Point[] = [points[0]];
  for (let i = 1; i < points.length; i++) {
    const prev = deduped[deduped.length - 1];
    if (points[i].t > prev.t || points[i].cumMist !== prev.cumMist) {
      deduped.push(points[i]);
    } else {
      // Merge: keep the higher cum value
      prev.cumMist = Math.max(prev.cumMist, points[i].cumMist);
    }
  }

  const tMin = deduped[0].t;
  const tMax = deduped[deduped.length - 1].t;
  const tRange = Math.max(tMax - tMin, 1);
  const cumMax = Math.max(deduped[deduped.length - 1].cumMist, 1);

  const toX = (t: number) => PAD.left + ((t - tMin) / tRange) * plotW;
  const toY = (cum: number) => PAD.top + plotH - (cum / cumMax) * plotH;

  // Build SVG path
  const pathD = deduped.map((p, i) => {
    const x = toX(p.t);
    const y = toY(p.cumMist);
    return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');

  // Fill area path (close to bottom)
  const areaD = pathD + ` L${toX(tMax).toFixed(1)},${(PAD.top + plotH).toFixed(1)} L${toX(tMin).toFixed(1)},${(PAD.top + plotH).toFixed(1)} Z`;

  // Y-axis ticks (4 evenly spaced)
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map(frac => {
    const val = cumMax * frac;
    const y = toY(val);
    const suiVal = val / 1_000_000_000;
    return { y, label: suiVal < 0.001 ? `${(suiVal * 1_000_000).toFixed(0)}μ` : `${suiVal.toFixed(4)}` };
  });

  // X-axis labels
  const formatTime = (t: number) => {
    const d = new Date(t);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };
  const xLabels = deduped.length <= 4
    ? deduped.map(p => ({ x: toX(p.t), label: formatTime(p.t) }))
    : [
        { x: toX(tMin), label: formatTime(tMin) },
        { x: toX(tMin + tRange * 0.5), label: formatTime(tMin + tRange * 0.5) },
        { x: toX(tMax), label: formatTime(tMax) },
      ];

  const totalSui = totalEarnedMist / 1_000_000_000;

  return (
    <div className="p-5 bg-[#FAF9F6] border border-stone-200 rounded-lg">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-emerald-600" />
          <span className="text-xs font-sans text-stone-400 font-medium">Earnings Over Time</span>
        </div>
        <span className="text-xs font-mono font-bold text-emerald-700">
          {totalSui < 0.001 ? `${(totalSui * 1_000_000).toFixed(0)} μSUI` : `${totalSui.toFixed(4)} SUI`}
        </span>
      </div>
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="w-full h-auto" preserveAspectRatio="xMidYMid meet">
        {/* Grid lines */}
        {yTicks.map((tick, i) => (
          <g key={i}>
            <line
              x1={PAD.left} y1={tick.y} x2={WIDTH - PAD.right} y2={tick.y}
              stroke="#e5e5e5" strokeWidth={0.5} strokeDasharray="3,3"
            />
            <text
              x={PAD.left - 4} y={tick.y + 3}
              textAnchor="end" fontSize={8} fontFamily="monospace" fill="#a8a29e"
            >{tick.label}</text>
          </g>
        ))}
        {/* X-axis labels */}
        {xLabels.map((xl, i) => (
          <text
            key={i}
            x={xl.x} y={HEIGHT - 4}
            textAnchor="middle" fontSize={8} fontFamily="monospace" fill="#a8a29e"
          >{xl.label}</text>
        ))}
        {/* Area fill */}
        <path d={areaD} fill="url(#earningsGrad)" opacity={0.3} />
        {/* Line */}
        <path d={pathD} fill="none" stroke="#16a34a" strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
        {/* End dot */}
        {deduped.length > 0 && (
          <circle
            cx={toX(deduped[deduped.length - 1].t)}
            cy={toY(deduped[deduped.length - 1].cumMist)}
            r={3} fill="#16a34a" stroke="white" strokeWidth={1.5}
          />
        )}
        {/* Gradient definition */}
        <defs>
          <linearGradient id="earningsGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#16a34a" />
            <stop offset="100%" stopColor="#16a34a" stopOpacity={0} />
          </linearGradient>
        </defs>
      </svg>
    </div>
  );
}

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

export default function ProviderPage({
  endpoints,
  isWalletConnected,
  walletAddress,
}: ProviderPageProps) {
  const navigate = useNavigate();
  const { addToast } = useToast();

  const [providers, setProviders] = useState<ProviderListing[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Detail view state
  const [consumers, setConsumers] = useState<ProviderConsumer[]>([]);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Provider streams (on-chain balance + claimable)
  const [providerStreams, setProviderStreams] = useState<ProviderStreamsResponse | null>(null);
  const [loadingStreams, setLoadingStreams] = useState(false);
  const [withdrawingStreamId, setWithdrawingStreamId] = useState<string | null>(null);
  const [withdrawingAll, setWithdrawingAll] = useState(false);

  // Pagination & filtering for Consuming Agents
  const [consumerPage, setConsumerPage] = useState(1);
  const [consumerFilter, setConsumerFilter] = useState<'all' | 'streaming' | 'depleted'>('all');
  const CONSUMERS_PER_PAGE = 8;

  // Pagination for Withdraw Earnings streams
  const [streamPage, setStreamPage] = useState(1);
  const STREAMS_PER_PAGE = 6;


  // Edit state
  const [editing, setEditing] = useState(false);
  const [editRate, setEditRate] = useState<number>(0);
  const [editDescription, setEditDescription] = useState("");
  const [saving, setSaving] = useState(false);

  // Fetch providers owned by this wallet
  const fetchProviders = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listProviders(walletAddress || undefined);
      setProviders(data.providers);
    } catch {
      setProviders([]);
    } finally {
      setLoading(false);
    }
  }, [walletAddress]);

  useEffect(() => {
    fetchProviders();
  }, [fetchProviders]);

  // Fetch detail data when selecting a provider + poll every 8s for real-time updates
  useEffect(() => {
    if (!selectedId) {
  
      return;
    }
    let isActive = true;
    const fetchDetail = async () => {
      try {
        const [consumersData] = await Promise.all([
          getProviderConsumers(selectedId).catch(() => ({ consumers: [] })),
        ]);
        if (isActive) {
          setConsumers(consumersData.consumers);
          setLoadingDetail(false);
        }
      } catch {
        if (isActive) setLoadingDetail(false);
      }
    };
    setLoadingDetail(true);
    fetchDetail();
    const interval = setInterval(fetchDetail, 8000);
    return () => { isActive = false; clearInterval(interval); };
  }, [selectedId]);

  // Fetch on-chain stream data for withdrawal
  const fetchProviderStreams = useCallback(async () => {
    if (!selectedId) return;
    setLoadingStreams(true);
    try {
      const data = await getProviderStreams(selectedId);
      setProviderStreams(data);
    } catch {
      setProviderStreams(null);
    } finally {
      setLoadingStreams(false);
    }
  }, [selectedId]);

  // Poll on-chain stream balances every 10s for real-time withdrawal amounts
  useEffect(() => {
    if (!selectedId) return;
    let isActive = true;
    const pollStreams = async () => {
      try {
        const data = await getProviderStreams(selectedId);
        if (isActive) setProviderStreams(data);
      } catch {
        // silent — keep previous data
      }
    };
    pollStreams();
    const interval = setInterval(pollStreams, 10000);
    return () => { isActive = false; clearInterval(interval); };
  }, [selectedId]);

  // Withdraw from a single stream
  const handleWithdrawStream = async (stream: ProviderStream) => {
    if (!isWalletConnected) {
      addToast({ variant: "error", title: "Wallet not connected", message: "Connect your wallet to withdraw" });
      return;
    }
    if (stream.claimableMist <= 0) {
      addToast({ variant: "error", title: "Nothing to withdraw", message: "No claimable balance on this stream" });
      return;
    }
    setWithdrawingStreamId(stream.streamId);
    try {
      const tx = new Transaction();
      tx.moveCall({
        target: `${PACKAGE_ID}::stream::withdraw`,
        typeArguments: ["0x2::sui::SUI"],
        arguments: [
          tx.object(stream.streamId),
          tx.object("0x6"),
        ],
      });
      const result = await dAppKit.signAndExecuteTransaction({ transaction: tx });
      console.log(`[withdraw] Single stream tx: ${(result as any)?.digest}`);
      addToast({
        variant: "success",
        title: "Withdrawal successful",
        message: `Withdrew ${stream.claimableSui.toFixed(6)} SUI from stream`,
      });
      // Refresh stream data
      fetchProviderStreams();
      fetchProviders();
    } catch (err: any) {
      addToast({
        variant: "error",
        title: "Withdrawal failed",
        message: err?.message || "Transaction failed",
      });
    } finally {
      setWithdrawingStreamId(null);
    }
  };

  // Withdraw from all streams in a single PTB
  const handleWithdrawAll = async () => {
    if (!isWalletConnected || !providerStreams) return;
    const withdrawable = providerStreams.streams.filter(s => s.claimableMist > 0);
    if (withdrawable.length === 0) {
      addToast({ variant: "error", title: "Nothing to withdraw", message: "No claimable balance across any streams" });
      return;
    }
    setWithdrawingAll(true);
    try {
      const tx = new Transaction();
      for (const stream of withdrawable) {
        tx.moveCall({
          target: `${PACKAGE_ID}::stream::withdraw`,
          typeArguments: ["0x2::sui::SUI"],
          arguments: [
            tx.object(stream.streamId),
            tx.object("0x6"),
          ],
        });
      }
      const result = await dAppKit.signAndExecuteTransaction({ transaction: tx });
      console.log(`[withdraw] Bulk withdraw tx: ${(result as any)?.digest}`);
      addToast({
        variant: "success",
        title: "Bulk withdrawal successful",
        message: `Withdrew from ${withdrawable.length} streams (${providerStreams.totalClaimableSui.toFixed(6)} SUI total)`,
      });
      fetchProviderStreams();
      fetchProviders();
    } catch (err: any) {
      addToast({
        variant: "error",
        title: "Bulk withdrawal failed",
        message: err?.message || "Transaction failed",
      });
    } finally {
      setWithdrawingAll(false);
    }
  };

  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Reset pages when provider changes
  useEffect(() => { setConsumerPage(1); setConsumerFilter('all'); setStreamPage(1); }, [selectedId]);

  const selectedProvider = providers.find((p) => p.id === selectedId);

  const handleStartEdit = () => {
    if (!selectedProvider) return;
    setEditRate(selectedProvider.ratePerSecond);
    setEditDescription(selectedProvider.description || "");
    setEditing(true);
  };

  const handleSaveEdit = async () => {
    if (!selectedId) return;
    setSaving(true);
    try {
      await updateProvider(selectedId, {
        ratePerSecond: editRate,
        description: editDescription,
      });
      setProviders((prev) =>
        prev.map((p) =>
          p.id === selectedId
            ? { ...p, ratePerSecond: editRate, description: editDescription }
            : p
        )
      );
      setEditing(false);
      addToast({
        variant: "success",
        title: "Provider updated",
        message: `Rate set to ${editRate.toLocaleString()} MIST/s`,
      });
    } catch (err: any) {
      addToast({
        variant: "error",
        title: "Update failed",
        message: err.message,
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteProvider = async () => {
    if (!selectedId) return;
    setDeleting(true);
    try {
      await deleteProvider(selectedId);
      setProviders((prev) => prev.filter((p) => p.id !== selectedId));
      setSelectedId(null);
      setDeleteModalOpen(false);
      addToast({
        variant: "success",
        title: "Provider deleted",
        message: `"${selectedProvider?.name}" has been removed.`,
      });
    } catch (err: any) {
      addToast({
        variant: "error",
        title: "Delete failed",
        message: err.message,
      });
    } finally {
      setDeleting(false);
    }
  };

  // Wallet gate
  if (!isWalletConnected) {
    return (
      <div className="pb-16">
        <div className="flex items-center gap-2 text-xs font-sans text-stone-500 mb-6">
          <span
            onClick={() => navigate("/")}
            className="hover:text-black cursor-pointer transition-colors font-semibold"
          >
            Flowgate
          </span>
          <span>/</span>
          <span className="text-stone-400">Provider Dashboard</span>
        </div>
        <div className="py-12 text-center max-w-xl mx-auto border border-dashed border-stone-300 bg-white p-8">
          <div className="w-14 h-14 rounded-full bg-stone-100 flex items-center justify-center mx-auto mb-4">
            <Wallet className="w-7 h-7 text-stone-400" />
          </div>
          <h2 className="font-sans text-xl font-bold text-[#1C1A17] mb-2">
            Connect your wallet
          </h2>
          <p className="text-sm font-sans text-stone-500 max-w-md mx-auto leading-relaxed">
            You need to connect a Sui wallet to access the Provider Dashboard
            and manage your APIs.
          </p>
        </div>
      </div>
    );
  }

  // ─── Detail View ────────────────────────────────────────────────
  if (selectedProvider) {
    // Calculate live earnings from consumer data instead of stored DB value
    const liveTotalEarnedMist = consumers.reduce(
      (sum, c) => sum + Math.min(c.elapsedSec, c.durationSeconds || c.elapsedSec) * c.ratePerSecondMist,
      0
    );
    const totalEarnedSui = liveTotalEarnedMist / 1_000_000_000;
    const activeConsumers = consumers.filter((c) => c.status === "streaming");
    const depletedConsumers = consumers.filter((c) => c.status === "depleted");
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
          <span
            onClick={() => setSelectedId(null)}
            className="hover:text-black cursor-pointer transition-colors font-semibold"
          >
            Provider Dashboard
          </span>
          <span>/</span>
          <span className="text-stone-400">{selectedProvider.name}</span>
        </div>

        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6 sm:mb-8">
          <div className="flex items-center gap-3 sm:gap-4">
            <button
              onClick={() => setSelectedId(null)}
              className="p-2 rounded-lg border border-stone-200 text-stone-500 hover:bg-stone-100 transition-all"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div>
              <div className="flex items-center gap-2 text-[#8C2C16] font-sans text-sm font-semibold mb-1">
                <span className="w-1.5 h-1.5 bg-[#8C2C16]" />
                API Detail
              </div>
              <h1 className="font-sans text-3xl font-bold text-[#1C1A17]">
                {selectedProvider.name}
              </h1>
              <p className="text-sm text-stone-500 mt-1">
                {selectedProvider.description || selectedProvider.category}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 text-xs font-sans font-bold rounded-full border bg-emerald-50 text-emerald-700 border-emerald-200">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block mr-1" />
              Active
            </span>
            <button
              onClick={() => setDeleteModalOpen(true)}
              className="p-2 text-stone-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              title="Delete endpoint"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Metrics */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3 mb-6 sm:mb-8">
          {[
            {
              label: "Total Earned",
              value: `${totalEarnedSui.toFixed(4)} SUI`,
              icon: DollarSign,
              tone: "text-emerald-700",
            },
            {
              label: "Active Consumers",
              value: String(activeConsumers.length),
              icon: Users,
              tone: activeConsumers.length > 0 ? "text-emerald-600" : "text-stone-500",
            },
            {
              label: "Rate",
              value: `${selectedProvider.ratePerSecond.toLocaleString()} MIST/s`,
              icon: Zap,
              tone: "text-[#8C2C16]",
            },
            {
              label: "Total Streams",
              value: String(consumers.length),
              icon: Radio,
              tone: consumers.length > 0 ? "text-[#1C1A17]" : "text-stone-500",
            },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <div
                key={item.label}
                className="p-4 bg-[#FAF9F6] border border-stone-200 rounded-lg"
              >
                <div className="flex items-center gap-2 text-stone-400 mb-2">
                  <Icon className="w-4 h-4" />
                  <span className="text-xs font-sans font-medium">
                    {item.label}
                  </span>
                </div>
                <div
                  className={`font-sans text-lg font-bold ${item.tone}`}
                >
                  {item.value}
                </div>
              </div>
            );
          })}
        </div>

        {/* Earnings Chart */}
        <div className="mb-6">
          <EarningsChart consumers={consumers} totalEarnedMist={liveTotalEarnedMist} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px] xl:grid-cols-[minmax(0,1fr)_360px] gap-5 sm:gap-6 items-start">
          <main className="space-y-5 min-w-0">
            {/* Consumers List */}
            <section>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Users
                    className={`w-4 h-4 ${
                      activeConsumers.length > 0
                        ? "text-emerald-500"
                        : "text-stone-300"
                    }`}
                  />
                  <span className="text-xs font-sans text-stone-400 font-medium">
                    Consuming Agents
                  </span>
                  <span className="px-1.5 py-0.5 text-[10px] font-mono font-bold bg-stone-100 text-stone-500 rounded">
                    {consumers.length}
                  </span>
                </div>
                {/* Status filter tabs */}
                <div className="flex items-center gap-1 bg-stone-100 rounded-lg p-0.5">
                  {([
                    { key: 'all' as const, label: 'All', count: consumers.length },
                    { key: 'streaming' as const, label: 'Active', count: activeConsumers.length },
                    { key: 'depleted' as const, label: 'Done', count: depletedConsumers.length },
                  ]).map((tab) => (
                    <button
                      key={tab.key}
                      onClick={() => { setConsumerFilter(tab.key); setConsumerPage(1); }}
                      className={`px-2.5 py-1 text-[10px] font-sans font-bold rounded-md transition-all ${
                        consumerFilter === tab.key
                          ? 'bg-white text-[#1C1A17] shadow-sm'
                          : 'text-stone-400 hover:text-stone-600'
                      }`}
                    >
                      {tab.label}
                      <span className="ml-1 opacity-60">{tab.count}</span>
                    </button>
                  ))}
                </div>
              </div>
              {loadingDetail ? (
                <div className="p-8 bg-[#FAF9F6] border border-stone-200 rounded-lg animate-pulse">
                  <div className="h-16 bg-stone-100 rounded-lg" />
                </div>
              ) : consumers.length > 0 ? (
                <>
                  {/* Compact table */}
                  <div className="bg-[#FAF9F6] border border-stone-200 rounded-lg overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left">
                        <thead>
                          <tr className="border-b border-stone-200 bg-stone-50">
                            <th className="px-3 py-2 text-[10px] font-sans font-bold text-stone-400 uppercase tracking-wider">Agent</th>
                            <th className="px-3 py-2 text-[10px] font-sans font-bold text-stone-400 uppercase tracking-wider">Status</th>
                            <th className="px-3 py-2 text-[10px] font-sans font-bold text-stone-400 uppercase tracking-wider">Time</th>
                            <th className="px-3 py-2 text-[10px] font-sans font-bold text-stone-400 uppercase tracking-wider">Rate</th>
                            <th className="px-3 py-2 text-[10px] font-sans font-bold text-stone-400 uppercase tracking-wider">Deposit</th>
                            <th className="px-3 py-2 text-[10px] font-sans font-bold text-stone-400 uppercase tracking-wider text-right">Stream</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(() => {
                            const filtered = consumers.filter((c) => consumerFilter === 'all' || c.status === consumerFilter);
                            const totalPages = Math.ceil(filtered.length / CONSUMERS_PER_PAGE);
                            const pageItems = filtered.slice(0, consumerPage * CONSUMERS_PER_PAGE);
                            return pageItems.map((consumer) => (
                              <tr
                                key={consumer.streamId}
                                className="border-b border-stone-100 last:border-b-0 hover:bg-white transition-colors"
                              >
                                <td className="px-3 py-2.5">
                                  <div className="flex items-center gap-2 min-w-0">
                                    <div className="relative shrink-0">
                                      <Radio
                                        className={`w-3.5 h-3.5 ${
                                          consumer.status === "streaming"
                                            ? "text-emerald-500"
                                            : "text-stone-300"
                                        }`}
                                      />
                                      {consumer.status === "streaming" && (
                                        <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 bg-emerald-500 rounded-full animate-ping" />
                                      )}
                                    </div>
                                    <div className="min-w-0">
                                      <div className="text-xs font-sans font-bold text-[#1C1A17] truncate">
                                        {consumer.agentName}
                                      </div>
                                      <div className="text-[10px] font-sans text-stone-400 truncate">
                                        {consumer.agentPurpose}
                                      </div>
                                    </div>
                                  </div>
                                </td>
                                <td className="px-3 py-2.5">
                                  <span
                                    className={`px-1.5 py-0.5 text-[10px] font-mono font-bold rounded-full ${
                                      consumer.status === "streaming"
                                        ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                        : "bg-stone-100 text-stone-600 border border-stone-300"
                                    }`}
                                  >
                                    {consumer.status === "streaming" ? "LIVE" : "END"}
                                  </span>
                                </td>
                                <td className="px-3 py-2.5">
                                  <div className="flex items-center gap-1 text-[#8C2C16]">
                                    <Clock className="w-3 h-3" />
                                    <span className="text-[10px] font-mono font-bold">
                                      {formatDuration(consumer.elapsedSec)}
                                      {consumer.status === "streaming" &&
                                        ` / ${formatDuration(consumer.durationSeconds)}`}
                                    </span>
                                  </div>
                                </td>
                                <td className="px-3 py-2.5">
                                  <span className="text-[10px] font-mono font-bold text-[#8C2C16]">
                                    {consumer.ratePerSecondMist.toLocaleString()}
                                  </span>
                                </td>
                                <td className="px-3 py-2.5">
                                  <span className="text-[10px] font-mono font-bold text-[#1C1A17]">
                                    {(consumer.depositMist / 1_000_000_000).toFixed(4)} SUI
                                  </span>
                                </td>
                                <td className="px-3 py-2.5 text-right">
                                  <a
                                    href={`https://suiscan.xyz/testnet/object/${consumer.streamId}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-[10px] font-mono text-[#8C2C16] hover:underline inline-flex items-center gap-0.5"
                                  >
                                    {consumer.streamId.substring(0, 8)}…
                                    <ExternalLink className="w-2.5 h-2.5" />
                                  </a>
                                </td>
                              </tr>
                            ));
                          })()}
                        </tbody>
                      </table>
                    </div>
                  </div>
                  {/* Load more */}
                  {(() => {
                    const filtered = consumers.filter((c) => consumerFilter === 'all' || c.status === consumerFilter);
                    const shown = consumerPage * CONSUMERS_PER_PAGE;
                    if (shown < filtered.length) {
                      return (
                        <button
                          onClick={() => setConsumerPage((p) => p + 1)}
                          className="w-full mt-2 py-2 text-[10px] font-sans font-bold text-stone-400 hover:text-[#8C2C16] bg-[#FAF9F6] border border-stone-200 rounded-lg hover:border-[#8C2C16] transition-all"
                        >
                          Show more ({filtered.length - shown} remaining)
                        </button>
                      );
                    }
                    return null;
                  })()}
                </>
              ) : (
                <div className="p-8 bg-[#FAF9F6] border border-stone-200 rounded-lg text-center">
                  <Users className="w-9 h-9 text-stone-200 mx-auto mb-3" />
                  <p className="text-sm font-sans font-bold text-[#1C1A17]">
                    {consumerFilter !== 'all' ? 'No matching agents' : 'No consumers yet'}
                  </p>
                  <p className="text-xs text-stone-400 mt-1">
                    {consumerFilter !== 'all'
                      ? 'Try a different filter'
                      : 'Agents will appear here once they start streaming from your API.'}
                  </p>
                </div>
              )}
            </section>

            {/* Endpoint Info */}
            <section className="p-5 bg-[#FAF9F6] border border-stone-200 rounded-lg">
              <div className="flex items-center gap-2 mb-4">
                <Activity className="w-4 h-4 text-stone-400" />
                <span className="text-xs font-sans text-stone-400 font-medium">
                  Endpoint Details
                </span>
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between py-2 border-b border-stone-100">
                  <span className="text-xs font-sans text-stone-500">
                    Endpoint Path
                  </span>
                  <span className="font-mono text-xs text-[#1C1A17]">
                    {selectedProvider.endpoint}
                  </span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-stone-100">
                  <span className="text-xs font-sans text-stone-500">
                    Website
                  </span>
                  <a
                    href={selectedProvider.websiteUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-mono text-xs text-[#8C2C16] hover:underline inline-flex items-center gap-0.5"
                  >
                    {selectedProvider.websiteUrl}
                    <ExternalLink className="w-2.5 h-2.5" />
                  </a>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-stone-100">
                  <span className="text-xs font-sans text-stone-500">
                    Category
                  </span>
                  <span className="text-xs font-sans font-bold text-[#1C1A17]">
                    {selectedProvider.category}
                  </span>
                </div>
                <div className="flex items-center justify-between py-2">
                  <span className="text-xs font-sans text-stone-500">
                    Provider Address
                  </span>
                  <span className="font-mono text-xs text-stone-500 truncate max-w-[200px]">
                    {selectedProvider.providerAddress}
                  </span>
                </div>
              </div>
            </section>
          </main>

          <aside className="space-y-5 xl:sticky xl:top-4">
            {/* Earnings Card */}
            <section className="p-4 bg-[#FAF9F6] border border-stone-200 rounded-lg">
              <div className="flex items-center gap-2 mb-3">
                <TrendingUp className="w-4 h-4 text-emerald-600" />
                <span className="text-xs font-sans text-stone-400 font-medium">
                  Earnings Summary
                </span>
              </div>
              <div className="text-center py-4">
                <div className="font-sans text-3xl font-bold text-emerald-700 mb-1">
                  {totalEarnedSui.toFixed(4)}
                </div>
                <div className="text-xs font-mono text-stone-400">
                  SUI earned (live)
                </div>
              </div>
              <div className="border-t border-stone-200 pt-3 mt-3">
                <div className="flex items-center justify-between text-[10px] font-mono text-stone-400 mb-1">
                  <span>Active revenue streams</span>
                  <span className="font-bold text-emerald-700">
                    {activeConsumers.length}
                  </span>
                </div>
                <div className="flex items-center justify-between text-[10px] font-mono text-stone-400">
                  <span>Completed streams</span>
                  <span className="font-bold text-stone-500">
                    {depletedConsumers.length}
                  </span>
                </div>
              </div>
            </section>

            {/* Withdraw Earnings Panel */}
            <section className="p-4 bg-[#FAF9F6] border border-stone-200 rounded-lg">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <CircleDollarSign className="w-4 h-4 text-emerald-600" />
                  <span className="text-xs font-sans text-stone-400 font-medium">
                    Withdraw Earnings
                  </span>
                </div>
                <button
                  onClick={() => fetchProviderStreams()}
                  disabled={loadingStreams}
                  className="p-1 text-stone-400 hover:text-[#8C2C16] transition-colors"
                  title="Refresh on-chain balances"
                >
                  <RefreshCw className={`w-3 h-3 ${loadingStreams ? 'animate-spin' : ''}`} />
                </button>
              </div>

              {loadingStreams ? (
                <div className="py-4 text-center">
                  <RefreshCw className="w-4 h-4 text-stone-300 animate-spin mx-auto mb-2" />
                  <span className="text-[10px] text-stone-400">Reading on-chain balances...</span>
                </div>
              ) : providerStreams && providerStreams.streams.length > 0 ? (
                <>
                  {/* Total claimable */}
                  <div className="text-center py-3 mb-3 bg-emerald-50 border border-emerald-200 rounded-lg">
                    <div className="font-mono text-xl font-bold text-emerald-700">
                      {providerStreams.totalClaimableSui < 0.001
                        ? `${(providerStreams.totalClaimableSui * 1_000_000).toFixed(0)} μSUI`
                        : `${providerStreams.totalClaimableSui.toFixed(6)} SUI`}
                    </div>
                    <div className="text-[10px] font-mono text-emerald-600 mt-0.5">
                      {providerStreams.totalOnChainBalanceSui.toFixed(6)} SUI on-chain total
                    </div>
                  </div>

                  {/* Withdraw All button */}
                  {providerStreams.totalClaimableMist > 0 && (
                    <button
                      onClick={handleWithdrawAll}
                      disabled={withdrawingAll || !isWalletConnected}
                      className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white rounded-lg text-xs font-sans font-bold transition-all flex items-center justify-center gap-2 mb-3"
                    >
                      {withdrawingAll ? (
                        <>
                          <RefreshCw className="w-3 h-3 animate-spin" />
                          Withdrawing...
                        </>
                      ) : (
                        <>
                          <ArrowDownToLine className="w-3 h-3" />
                          Withdraw All ({providerStreams.totalClaimableSui.toFixed(6)} SUI)
                        </>
                      )}
                    </button>
                  )}

                  {/* Per-stream compact table */}
                  <div className="bg-white border border-stone-200 rounded-lg overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left">
                        <thead>
                          <tr className="border-b border-stone-200 bg-stone-50">
                            <th className="px-2.5 py-1.5 text-[9px] font-sans font-bold text-stone-400 uppercase">Agent</th>
                            <th className="px-2.5 py-1.5 text-[9px] font-sans font-bold text-stone-400 uppercase">Balance</th>
                            <th className="px-2.5 py-1.5 text-[9px] font-sans font-bold text-stone-400 uppercase">Claimable</th>
                            <th className="px-2.5 py-1.5 text-[9px] font-sans font-bold text-stone-400 uppercase text-right">Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(() => {
                            const streamPageItems = providerStreams.streams.slice(0, streamPage * STREAMS_PER_PAGE);
                            return streamPageItems.map((stream) => (
                              <tr key={stream.streamId} className="border-b border-stone-50 last:border-b-0 hover:bg-stone-50 transition-colors">
                                <td className="px-2.5 py-2">
                                  <div className="flex items-center gap-1.5 min-w-0">
                                    <Radio className={`w-2.5 h-2.5 shrink-0 ${stream.status === 'streaming' ? 'text-emerald-500' : 'text-stone-300'}`} />
                                    <span className="text-[10px] font-sans font-bold text-[#1C1A17] truncate">
                                      {stream.agentName}
                                    </span>
                                  </div>
                                </td>
                                <td className="px-2.5 py-2">
                                  <span className="text-[10px] font-mono text-stone-500">
                                    {stream.onChainBalanceSui.toFixed(4)}
                                  </span>
                                </td>
                                <td className="px-2.5 py-2">
                                  <span className={`text-[10px] font-mono font-bold ${stream.claimableMist > 0 ? 'text-emerald-700' : 'text-stone-400'}`}>
                                    {stream.claimableSui < 0.001 && stream.claimableMist > 0
                                      ? `${stream.claimableMist}μ`
                                      : `${stream.claimableSui.toFixed(4)}`}
                                  </span>
                                </td>
                                <td className="px-2.5 py-2 text-right">
                                  {stream.claimableMist > 0 ? (
                                    <button
                                      onClick={() => handleWithdrawStream(stream)}
                                      disabled={withdrawingStreamId === stream.streamId || !isWalletConnected}
                                      className="px-2 py-1 text-[9px] font-sans font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded transition-all flex items-center justify-center gap-1 disabled:opacity-40 ml-auto"
                                    >
                                      {withdrawingStreamId === stream.streamId ? (
                                        <RefreshCw className="w-2 h-2 animate-spin" />
                                      ) : (
                                        <Download className="w-2 h-2" />
                                      )}
                                      {withdrawingStreamId === stream.streamId ? '...' : 'Withdraw'}
                                    </button>
                                  ) : (
                                    <span className="text-[9px] font-mono text-stone-300">
                                      {stream.status === 'streaming' ? '● Live' : '○ Done'}
                                    </span>
                                  )}
                                </td>
                              </tr>
                            ));
                          })()}
                        </tbody>
                      </table>
                    </div>
                  </div>
                  {/* Load more streams */}
                  {providerStreams.streams.length > streamPage * STREAMS_PER_PAGE && (
                    <button
                      onClick={() => setStreamPage((p) => p + 1)}
                      className="w-full mt-2 py-1.5 text-[10px] font-sans font-bold text-stone-400 hover:text-[#8C2C16] bg-white border border-stone-200 rounded-lg hover:border-[#8C2C16] transition-all"
                    >
                      Show more ({providerStreams.streams.length - streamPage * STREAMS_PER_PAGE} remaining)
                    </button>
                  )}
                </>
              ) : (
                <div className="py-4 text-center">
                  <CircleDollarSign className="w-8 h-8 text-stone-200 mx-auto mb-2" />
                  <p className="text-[10px] font-sans text-stone-400">
                    No streams found for this provider
                  </p>
                  <p className="text-[9px] text-stone-300 mt-1">
                    Streams appear here when agents access your API
                  </p>
                </div>
              )}

              {/* Withdrawal info */}
              <div className="mt-3 pt-3 border-t border-stone-100">
                <p className="text-[9px] font-mono text-stone-400 leading-relaxed">
                  Withdrawals are executed on-chain via the{' '}<span className="text-[#8C2C16] font-bold">stream::withdraw</span>{' '}
                  Move function. Your connected wallet signs the transaction. Claimable
                  amounts accrue at your configured rate per second.
                </p>
              </div>
            </section>

            {/* API Management */}
            <section className="p-4 bg-[#FAF9F6] border border-stone-200 rounded-lg">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Edit3 className="w-4 h-4 text-stone-400" />
                  <span className="text-xs font-sans text-stone-400 font-medium">
                    API Management
                  </span>
                </div>
                {!editing && (
                  <button
                    onClick={handleStartEdit}
                    className="text-[10px] font-sans text-[#8C2C16] hover:underline font-bold"
                  >
                    Edit
                  </button>
                )}
              </div>
              {editing ? (
                <div className="space-y-3">
                  <div>
                    <label className="text-[10px] font-sans text-stone-400 font-medium block mb-1">
                      Rate (MIST/sec)
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={editRate}
                      onChange={(e) => setEditRate(Number(e.target.value))}
                      className="w-full px-3 py-2 bg-white border border-stone-200 rounded-lg font-mono text-xs text-[#1C1A17] focus:outline-none focus:border-[#8C2C16] transition-all"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-sans text-stone-400 font-medium block mb-1">
                      Description
                    </label>
                    <textarea
                      value={editDescription}
                      onChange={(e) => setEditDescription(e.target.value)}
                      rows={3}
                      className="w-full px-3 py-2 bg-white border border-stone-200 rounded-lg font-sans text-xs text-[#1C1A17] focus:outline-none focus:border-[#8C2C16] transition-all resize-none"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setEditing(false)}
                      className="flex-1 py-2 text-xs font-sans font-bold text-stone-500 border border-stone-200 rounded-lg hover:bg-stone-100 transition-all"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSaveEdit}
                      disabled={saving}
                      className="flex-1 py-2 text-xs font-sans font-bold text-white bg-[#8C2C16] hover:bg-[#A63A23] rounded-lg transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
                    >
                      {saving ? (
                        <RefreshCw className="w-3 h-3 animate-spin" />
                      ) : (
                        <Save className="w-3 h-3" />
                      )}
                      Save
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center justify-between py-1.5 border-b border-stone-100">
                    <span className="text-[10px] font-sans text-stone-400">
                      Rate
                    </span>
                    <span className="font-mono text-xs font-bold text-[#8C2C16]">
                      {selectedProvider.ratePerSecond.toLocaleString()} MIST/s
                    </span>
                  </div>
                  <div className="flex items-center justify-between py-1.5 border-b border-stone-100">
                    <span className="text-[10px] font-sans text-stone-400">
                      SUI equivalent
                    </span>
                    <span className="font-mono text-xs text-[#1C1A17]">
                      {(selectedProvider.ratePerSecond / 1_000_000_000).toFixed(9)} SUI/s
                    </span>
                  </div>
                  <div className="flex items-center justify-between py-1.5">
                    <span className="text-[10px] font-sans text-stone-400">
                      Category
                    </span>
                    <span className="text-xs font-sans font-bold text-[#1C1A17]">
                      {selectedProvider.category}
                    </span>
                  </div>
                </div>
              )}
            </section>
          </aside>
        </div>

        {/* Delete Confirmation Modal */}
        <AnimatePresence>
          {deleteModalOpen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
              onClick={() => setDeleteModalOpen(false)}
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
                    <Trash2 className="w-5 h-5 text-red-600" />
                  </div>
                  <div>
                    <h3 className="font-sans text-lg font-bold text-[#1C1A17]">Delete Endpoint</h3>
                    <p className="text-xs text-stone-500">This action cannot be undone.</p>
                  </div>
                </div>
                <p className="text-sm text-stone-600 mb-4">
                  Are you sure you want to permanently delete <span className="font-bold">{selectedProvider?.name}</span>? Consumers will lose access to this endpoint.
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setDeleteModalOpen(false)}
                    className="flex-1 py-3 px-6 bg-transparent hover:bg-[#1C1A17]/5 text-[#1C1A17] border border-[#1C1A17]/30 rounded-full text-sm font-sans font-bold transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleDeleteProvider}
                    disabled={deleting}
                    className="flex-1 py-3 px-6 bg-red-600 hover:bg-red-700 disabled:opacity-40 text-white font-sans text-sm font-bold rounded-full flex items-center justify-center gap-2 transition-all"
                  >
                    {deleting ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <Trash2 className="w-4 h-4" />
                    )}
                    Delete
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  // ─── List View ──────────────────────────────────────────────────
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
        <span className="text-stone-400">Provider Dashboard</span>
      </div>        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6 sm:mb-8 border-b border-stone-300 pb-6">
          <div>
            <h1 className="font-sans text-2xl sm:text-3xl font-bold text-[#1C1A17]">
              Provider Dashboard
            </h1>
            <p className="text-xs sm:text-sm text-stone-500 mt-0.5">
              Manage your APIs and monitor agent consumption.
            </p>
          </div>
          <button
            onClick={() => navigate("/register")}
            className="px-4 py-2.5 bg-[#8C2C16] hover:bg-[#A63A23] text-white rounded-full text-xs font-sans font-bold transition-all flex items-center gap-2 shrink-0"
          >
            Register New API
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>        {/* Provider Cards */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="p-6 bg-[#FAF9F6] border border-stone-200 rounded-xl animate-pulse"
            >
              <div className="h-6 bg-stone-100 rounded w-1/2 mb-3" />
              <div className="h-4 bg-stone-100 rounded w-3/4 mb-4" />
              <div className="h-8 bg-stone-100 rounded" />
            </div>
          ))}
        </div>
      ) : providers.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4">
          {providers.map((provider) => (
            <button
              key={provider.id}
              onClick={() => setSelectedId(provider.id)}
              className="text-left p-5 bg-[#FAF9F6] border border-stone-200 rounded-xl hover:border-[#8C2C16] hover:shadow-md transition-all group"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2 min-w-0">
                  <Radio className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span className="font-sans text-sm font-bold text-[#1C1A17] truncate">
                    {provider.name}
                  </span>
                </div>
                <span className="px-1.5 py-0.5 text-[10px] font-mono font-bold rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 shrink-0">
                  ACTIVE
                </span>
              </div>
              <p className="text-xs text-stone-500 font-sans mb-4 line-clamp-2">
                {provider.description || provider.category}
              </p>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1">
                  <Zap className="w-3 h-3 text-[#8C2C16]" />
                  <span className="text-xs font-mono font-bold text-[#8C2C16]">
                    {provider.ratePerSecond.toLocaleString()} MIST/s
                  </span>
                </div>
                <span className="text-[10px] font-sans text-stone-400">
                  {provider.category}
                </span>
              </div>
              <div className="mt-3 pt-3 border-t border-stone-100 flex items-center justify-between">
                <span className="text-[10px] font-mono text-stone-400 truncate">
                  {provider.endpoint}
                </span>
                <ChevronRight className="w-3.5 h-3.5 text-stone-300 group-hover:text-[#8C2C16] transition-colors shrink-0" />
              </div>
            </button>
          ))}
        </div>
      ) : (
        <div className="py-12 text-center max-w-xl mx-auto border border-dashed border-stone-300 bg-white p-8">
          <Radio className="w-9 h-9 text-stone-200 mx-auto mb-3" />
          <p className="text-sm font-sans font-bold text-[#1C1A17]">
            No registered APIs
          </p>
          <p className="text-xs text-stone-400 mt-1">
            Register your first API to start earning from agent consumption.
          </p>
          <button
            onClick={() => navigate("/register")}
            className="mt-4 px-4 py-2.5 bg-[#8C2C16] hover:bg-[#A63A23] text-white rounded-full text-xs font-sans font-bold transition-all"
          >
            Register API
          </button>
        </div>
      )}
    </div>
  );
}
