import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import { getStreamState, fetchStreamData, StreamState } from "../lib/api";
import { useToast } from "../lib/toast-context";
import {
  Radio,
  Clock,
  ArrowDownToLine,
  RefreshCw,
  ExternalLink,

  Server,
  ChevronDown,
  ChevronUp,
  Trash2,
} from "lucide-react";

interface ScrapedItem {
  id: string;
  fetchedAt: string;
  sizeBytes: number;
  provider: string;
  itemCount: number;
  preview: string;
}

interface StreamingSessionPanelProps {
  agentId: string;
  ownerAddress: string | null;
  streamId: string;
  providerName: string;
  onClose?: () => void;
  onStatusChange?: (streamId: string, status: "streaming" | "depleted") => void;
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

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export default function StreamingSessionPanel({
  agentId,
  ownerAddress,
  streamId,
  providerName,
  onClose,
  onStatusChange,
}: StreamingSessionPanelProps) {
  const { addToast } = useToast();
  const [streamState, setStreamState] = useState<StreamState | null>(null);
  const [scrapedItems, setScrapedItems] = useState<ScrapedItem[]>([]);
  const [isFetching, setIsFetching] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [dataExpanded, setDataExpanded] = useState(false);

  // Poll stream state every 5 seconds
  const pollState = useCallback(async () => {
    if (!ownerAddress) return;
    try {
      const state = await getStreamState(agentId, streamId, ownerAddress);
      setStreamState(state);
      onStatusChange?.(streamId, state.status);
      // Cap elapsed so pollState doesn't overshoot past totalDurationSec
      const capped = state.totalDurationSec > 0
        ? Math.min(state.elapsedSec, state.totalDurationSec)
        : state.elapsedSec;
      setElapsed(capped);
    } catch {
      // silent
    }
  }, [agentId, ownerAddress, streamId]);

  useEffect(() => {
    pollState();
    const interval = setInterval(pollState, 5000);
    return () => clearInterval(interval);
  }, [pollState]);

  // Client-side elapsed timer (ticks every second for smooth updates, stops when stream finishes)
  useEffect(() => {
    if (!streamState || streamState.status !== "streaming") return;
    const totalSec = streamState.totalDurationSec || 0;
    const timer = setInterval(() => {
      setElapsed((prev) => {
        if (totalSec > 0 && prev >= totalSec) return totalSec; // cap at total
        return prev + 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [streamState?.elapsedSec, streamState?.status, streamState?.totalDurationSec]);

  const handleFetchData = async () => {
    if (!ownerAddress) {
      addToast({
        variant: "error",
        title: "Wallet required",
        message: "Connect your wallet to fetch stream data.",
      });
      return;
    }
    setIsFetching(true);
    try {
      const result = await fetchStreamData(agentId, streamId, ownerAddress);

      let preview = "";
      let itemCount = 0;
      let provider = providerName;

      if (result.data?.data && Array.isArray(result.data.data)) {
        itemCount = result.data.data.length;
        if (result.data.data[0]) {
          const item = result.data.data[0];
          if (item.author) provider = item.author;
          if (item.content) preview = item.content.substring(0, 120);
          else if (item.title) preview = item.title.substring(0, 120);
          else if (item.headline) preview = item.headline.substring(0, 120);
        }
      } else if (result.data?.provider) {
        provider = result.data.provider;
      }

      const newItem: ScrapedItem = {
        id: `scrape-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        fetchedAt: result.fetchedAt,
        sizeBytes: result.sizeBytes,
        provider,
        itemCount,
        preview: preview || "Data fetched successfully",
      };

      setScrapedItems((prev) => [newItem, ...prev].slice(0, 20));
      setDataExpanded(true);

      addToast({
        variant: "success",
        title: "Data fetched",
        message: `${itemCount || "—"} items from ${providerName} (${(result.sizeBytes / 1024).toFixed(1)}KB)`,
      });
    } catch (err: any) {
      addToast({
        variant: "error",
        title: "Fetch failed",
        message: err.message,
      });
    } finally {
      setIsFetching(false);
    }
  };

  if (!streamState) {
    return (
      <div className="p-4 bg-[#FAF9F6] border border-stone-200 rounded-xl animate-pulse">
        <div className="flex items-center gap-2 mb-3">
          <Radio className="w-4 h-4 text-stone-300" />
          <span className="text-xs font-sans text-stone-300 font-medium">
            Loading stream session...
          </span>
        </div>
        <div className="h-16 bg-stone-100 rounded-lg" />
      </div>
    );
  }

  const isStreaming = streamState.status === "streaming";
  const totalSec = streamState.totalDurationSec || 0;
  const cappedElapsed = totalSec > 0 ? Math.min(elapsed, totalSec) : elapsed;
  const progressPercent = totalSec > 0 ? Math.min((cappedElapsed / totalSec) * 100, 100) : 0;
  const isComplete = !isStreaming || progressPercent >= 100;
  const timeRemaining = Math.max(totalSec - cappedElapsed, 0);
  const isLow = progressPercent > 80 && !isComplete;
  const isCritical = progressPercent > 95 && !isComplete;

  return (
    <div className="p-4 bg-[#FAF9F6] border border-stone-200 rounded-xl">
      {/* Row 1: Provider + Status + Timer + Close */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <div className="relative shrink-0">
            <Radio
              className={`w-4 h-4 ${isStreaming ? "text-emerald-500" : "text-stone-400"}`}
            />
            {isStreaming && (
              <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-emerald-500 rounded-full animate-ping" />
            )}
          </div>
          <span className="font-sans text-sm font-bold text-[#1C1A17] truncate">
            {providerName}
          </span>
          <span
            className={`px-1.5 py-0.5 text-[10px] font-mono font-bold rounded-full shrink-0 ${
              isStreaming
                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                : "bg-stone-100 text-stone-600 border border-stone-300"
            }`}
          >
            {isStreaming ? "ACTIVE" : "FINISHED"}
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <div className="flex items-center gap-1 text-[#8C2C16]">
            <Clock className="w-3 h-3" />
            <span className="text-[10px] font-mono font-bold">
              {isComplete ? formatDuration(elapsed) : `~${formatDuration(timeRemaining)} left`}
            </span>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="p-1.5 text-stone-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              title="Close stream"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Row 2: Progress bar with time fraction */}
      <div className="mb-3">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[10px] font-mono font-bold text-[#8C2C16]">
            {progressPercent.toFixed(1)}%
          </span>
          <span className="text-[10px] font-mono font-bold text-[#1C1A17]">
            {formatDuration(elapsed)} / {formatDuration(totalSec)}
          </span>
        </div>
        <div className="w-full h-2.5 bg-white border border-stone-200 rounded-full overflow-hidden">
          <motion.div
            className="h-full rounded-full"
            style={{
              background: isComplete
                ? "linear-gradient(90deg, #6b7280, #4b5563)"
                : isCritical
                  ? "linear-gradient(90deg, #ef4444, #dc2626)"
                  : isLow
                    ? "linear-gradient(90deg, #f59e0b, #d97706)"
                    : "linear-gradient(90deg, #22c55e, #16a34a)",
            }}
            initial={{ width: "0%" }}
            animate={{ width: `${progressPercent}%` }}
            transition={{ duration: 0.5 }}
          />
        </div>
      </div>

      {/* Row 3: Rate + Drained + Balance in one line */}
      <div className="flex items-center gap-4 mb-3 text-[10px] font-mono">
        <span className="text-stone-400">
          Rate:{" "}
          <span className="font-bold text-[#8C2C16]">
            {streamState.rateSuiPerSec < 0.001
              ? `${streamState.ratePerSecondMist.toLocaleString()} MIST/s`
              : `${streamState.rateSuiPerSec.toFixed(6)} SUI/s`}
          </span>
        </span>
        <span className="text-stone-400">
          Drained:{" "}
          <span className="font-bold text-[#8C2C16]">
            {streamState.drainedSui.toFixed(6)} SUI
          </span>
        </span>
        <span className="text-stone-400">
          Balance:{" "}
          <span className="font-bold text-[#1C1A17]">
            {streamState.balanceSui.toFixed(6)} SUI
          </span>
        </span>
      </div>

      {/* Row 4: Fetch + Consumed Data toggle */}
      <div className="flex items-center gap-2">
        <button
          onClick={handleFetchData}
          disabled={isFetching || !isStreaming}
          className="flex-1 px-3 py-2 bg-[#1C1A17] hover:bg-[#2C2A27] disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg text-[11px] font-sans font-bold transition-all flex items-center justify-center gap-1.5"
        >
          {isFetching ? (
            <>
              <RefreshCw className="w-3 h-3 animate-spin" />
              Fetching...
            </>
          ) : (
            <>
              <ArrowDownToLine className="w-3 h-3" />
              Fetch Data
            </>
          )}
        </button>
        {scrapedItems.length > 0 && (
          <button
            onClick={() => setDataExpanded(!dataExpanded)}
            className="flex items-center gap-1 px-3 py-2 bg-white border border-stone-200 hover:border-stone-300 rounded-lg text-[11px] font-sans font-bold text-stone-600 transition-all"
          >
            <Server className="w-3 h-3" />
            {scrapedItems.length}
            {dataExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
        )}
      </div>

      {/* Collapsible Consumed Data */}
      <AnimatePresence>
        {dataExpanded && scrapedItems.length > 0 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="mt-3 space-y-1.5 max-h-48 overflow-y-auto">
              {scrapedItems.map((item) => (
                <div
                  key={item.id}
                  className="flex items-start gap-2 py-2 px-2.5 bg-white border border-stone-100 rounded-lg"
                >
                  <div className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 bg-emerald-500" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="font-sans text-[11px] font-bold text-[#1C1A17]">
                        {item.provider}
                      </span>
                      <span className="text-[10px] text-stone-400 font-mono">
                        {item.itemCount} items • {(item.sizeBytes / 1024).toFixed(1)}KB
                      </span>
                    </div>
                    <p className="text-[10px] text-stone-500 font-mono line-clamp-1 leading-relaxed">
                      {item.preview}
                    </p>
                  </div>
                  <span className="text-[10px] font-mono text-stone-300 shrink-0">
                    {formatTime(item.fetchedAt)}
                  </span>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Stream ID footer */}
      <div className="flex items-center justify-between mt-2 pt-2 border-t border-stone-100">
        <span className="text-[10px] font-mono text-stone-300 truncate">
          {streamId.substring(0, 20)}…
        </span>
        <a
          href={`https://suiscan.xyz/testnet/object/${streamId}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[10px] font-mono text-[#8C2C16] hover:underline inline-flex items-center gap-0.5 shrink-0"
        >
          on-chain
          <ExternalLink className="w-2.5 h-2.5" />
        </a>
      </div>
    </div>
  );
}
