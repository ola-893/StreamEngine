import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import { getStreamState, fetchStreamData, StreamState } from "../lib/api";
import { useToast } from "../lib/toast-context";
import {
  Radio,
  Clock,
  DollarSign,
  Zap,
  ArrowDownToLine,
  RefreshCw,
  ExternalLink,
  Activity,
  TrendingDown,
  Server,
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
  streamId: string;
  providerName: string;
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
  streamId,
  providerName,
}: StreamingSessionPanelProps) {
  const { addToast } = useToast();
  const [streamState, setStreamState] = useState<StreamState | null>(null);
  const [scrapedItems, setScrapedItems] = useState<ScrapedItem[]>([]);
  const [isFetching, setIsFetching] = useState(false);
  const [elapsed, setElapsed] = useState(0);


  // Poll stream state every 5 seconds
  const pollState = useCallback(async () => {
    try {
      const state = await getStreamState(agentId, streamId);
      setStreamState(state);
      setElapsed(state.elapsedSec);
    } catch {
      // silent
    }
  }, [agentId, streamId]);

  useEffect(() => {
    pollState();
    const interval = setInterval(pollState, 5000);
    return () => clearInterval(interval);
  }, [pollState]);

  // Client-side elapsed timer (ticks every second for smooth updates)
  useEffect(() => {
    if (!streamState) return;
    const timer = setInterval(() => {
      setElapsed((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [streamState?.elapsedSec]);

  const handleFetchData = async () => {
    setIsFetching(true);
    try {
      const result = await fetchStreamData(agentId, streamId);

      // Extract preview from the data
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
      <div className="p-5 bg-[#FAF9F6] border border-stone-200 rounded-xl animate-pulse">
        <div className="flex items-center gap-2 mb-4">
          <Radio className="w-4 h-4 text-stone-300" />
          <span className="text-xs font-sans text-stone-300 font-medium">
            Loading stream session...
          </span>
        </div>
        <div className="h-20 bg-stone-100 rounded-lg" />
      </div>
    );
  }

  const isStreaming = streamState.status === "streaming";
  const balancePercent =
    streamState.balanceMist > 0
      ? Math.max(
          0,
          (streamState.balanceMist /
            (streamState.ratePerSecondMist * 3600)) *
            100
        )
      : 0;
  const drainRate = streamState.rateSuiPerSec;

  return (
    <div className="space-y-4">
      {/* Live Stream Header */}
      <div className="p-5 bg-[#FAF9F6] border border-stone-200 rounded-xl">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="relative">
              <Radio
                className={`w-4 h-4 ${isStreaming ? "text-emerald-500" : "text-red-400"}`}
              />
              {isStreaming && (
                <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-emerald-500 rounded-full animate-ping" />
              )}
            </div>
            <span className="text-xs font-sans text-stone-400 font-medium">
              Streaming Session
            </span>
            <span
              className={`px-1.5 py-0.5 text-[10px] font-mono font-bold rounded-full ${
                isStreaming
                  ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                  : "bg-red-50 text-red-600 border border-red-200"
              }`}
            >
              {isStreaming ? "LIVE" : "DEPLETED"}
            </span>
          </div>
          <div className="flex items-center gap-1 text-stone-400">
            <Clock className="w-3 h-3" />
            <span className="text-[10px] font-mono">
              {formatDuration(elapsed)} elapsed
            </span>
          </div>
        </div>

        {/* Balance Drain Visualization */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <DollarSign className="w-3.5 h-3.5 text-[#8C2C16]" />
              <span className="text-xs font-sans text-stone-400 font-medium">
                Stream Escrow
              </span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-[10px] font-mono text-stone-400">
                <TrendingDown className="w-2.5 h-2.5 inline mr-0.5" />
                {drainRate.toFixed(8)} SUI/s
              </span>
              <span className="text-xs font-sans font-bold text-[#8C2C16]">
                {streamState.balanceSui.toFixed(6)} SUI
              </span>
            </div>
          </div>
          <div className="w-full h-3 bg-stone-200 rounded-full overflow-hidden relative">
            <motion.div
              className="h-full rounded-full"
              style={{
                background:
                  balancePercent > 50
                    ? "linear-gradient(90deg, #22c55e, #16a34a)"
                    : balancePercent > 20
                      ? "linear-gradient(90deg, #f59e0b, #d97706)"
                      : "linear-gradient(90deg, #ef4444, #dc2626)",
              }}
              initial={{ width: "100%" }}
              animate={{ width: `${Math.max(balancePercent, 0)}%` }}
              transition={{ duration: 0.5 }}
            />
          </div>
          <div className="flex items-center justify-between mt-1.5">
            <span className="text-[10px] font-mono text-stone-400">
              {balancePercent.toFixed(1)}% remaining
            </span>
            <span className="text-[10px] font-mono text-stone-400">
              ~{formatDuration(streamState.remainingSec)} remaining
            </span>
          </div>
        </div>

        {/* Stream Info Row */}
        <div className="grid grid-cols-3 gap-3">
          <div className="p-2.5 bg-white border border-stone-100 rounded-lg">
            <span className="text-[10px] font-sans text-stone-400 block mb-0.5">
              Provider
            </span>
            <span className="text-xs font-sans font-bold text-[#1C1A17]">
              {providerName}
            </span>
          </div>
          <div className="p-2.5 bg-white border border-stone-100 rounded-lg">
            <span className="text-[10px] font-sans text-stone-400 block mb-0.5">
              Rate
            </span>
            <span className="text-xs font-sans font-bold text-[#1C1A17]">
              {(streamState.ratePerSecondMist / 1_000_000_000).toFixed(6)} SUI/s
            </span>
          </div>
          <div className="p-2.5 bg-white border border-stone-100 rounded-lg">
            <span className="text-[10px] font-sans text-stone-400 block mb-0.5">
              Drained
            </span>
            <span className="text-xs font-sans font-bold text-[#8C2C16]">
              {streamState.drainedSui.toFixed(6)} SUI
            </span>
          </div>
        </div>

        {/* Fetch Data Button */}
        <button
          onClick={handleFetchData}
          disabled={isFetching || !isStreaming}
          className="mt-4 w-full px-4 py-2.5 bg-[#1C1A17] hover:bg-[#2C2A27] disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg text-xs font-sans font-bold transition-all flex items-center justify-center gap-2"
        >
          {isFetching ? (
            <>
              <RefreshCw className="w-3 h-3 animate-spin" />
              Fetching data...
            </>
          ) : (
            <>
              <ArrowDownToLine className="w-3 h-3" />
              Fetch Data from {providerName}
            </>
          )}
        </button>
      </div>

      {/* Scraped Data Feed */}
      <div className="p-5 bg-[#FAF9F6] border border-stone-200 rounded-xl">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Server className="w-4 h-4 text-stone-400" />
            <span className="text-xs font-sans text-stone-400 font-medium">
              Consumed Data
            </span>
            <span className="px-1.5 py-0.5 text-[10px] font-mono font-bold bg-stone-100 text-stone-500 rounded">
              {scrapedItems.length}
            </span>
          </div>
          {scrapedItems.length > 0 && (
            <button
              onClick={() => setScrapedItems([])}
              className="text-[10px] font-sans text-stone-400 hover:text-stone-600 transition-colors"
            >
              clear
            </button>
          )}
        </div>

        {scrapedItems.length === 0 ? (
          <div className="text-center py-8">
            <Activity className="w-8 h-8 text-stone-200 mx-auto mb-2" />
            <p className="text-xs text-stone-400 font-sans">
              No data consumed yet. Click "Fetch Data" to start streaming.
            </p>
            <p className="text-[10px] text-stone-300 font-sans mt-1">
              Each fetch deducts from the stream escrow in real-time.
            </p>
          </div>
        ) : (
          <div className="space-y-1.5 max-h-80 overflow-y-auto">
            <AnimatePresence initial={false}>
              {scrapedItems.map((item) => (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, y: -10, height: 0 }}
                  animate={{ opacity: 1, y: 0, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="flex items-start gap-3 py-3 px-3 bg-white border border-stone-100 rounded-lg"
                >
                  <div className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 bg-emerald-500" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-sans text-xs font-bold text-[#1C1A17]">
                        {item.provider}
                      </span>
                      <span className="text-[10px] text-stone-400 font-mono">
                        {item.itemCount} items • {(item.sizeBytes / 1024).toFixed(1)}KB
                      </span>
                    </div>
                    <p className="text-[10px] text-stone-500 font-mono line-clamp-2 leading-relaxed">
                      {item.preview}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 text-stone-300 shrink-0">
                    <Clock className="w-2.5 h-2.5" />
                    <span className="text-[10px] font-mono">
                      {formatTime(item.fetchedAt)}
                    </span>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Stream ID Footer */}
      <div className="flex items-center justify-between px-1">
        <span className="text-[10px] font-mono text-stone-300">
          Stream: {streamId.substring(0, 20)}…
        </span>
        <a
          href={`https://suiscan.xyz/testnet/object/${streamId}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[10px] font-mono text-[#8C2C16] hover:underline inline-flex items-center gap-0.5"
        >
          View on-chain
          <ExternalLink className="w-2.5 h-2.5" />
        </a>
      </div>
    </div>
  );
}
