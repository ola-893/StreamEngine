import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useCurrentAccount, useDAppKit } from "@mysten/dapp-kit-react";
import { Transaction } from "@mysten/sui/transactions";
import { API_BASE } from "../types";
import {
  Wallet,
  AlertTriangle,
  Loader2,
  Check,
  X,
  Rss,
  Plus,
} from "lucide-react";

interface PremiumFeed {
  id: string;
  name: string;
  provider: string;
  endpoint: string;
  description: string;
  icon: string;
}

const PREMIUM_FEEDS: PremiumFeed[] = [
  {
    id: "x-social",
    name: "X (Twitter) Feed",
    provider: "X (Twitter)",
    endpoint: "/api/premium/x-social/feed",
    description: "Real-time posts, trending topics, and human interactions from X.com",
    icon: "𝕏",
  },
  {
    id: "reddit",
    name: "Reddit Feed",
    provider: "Reddit",
    endpoint: "/api/premium/reddit/feed",
    description: "Upvoted threads, community discussions, and niche subreddit data",
    icon: "r/",
  },
  {
    id: "bloomberg",
    name: "Bloomberg Feed",
    provider: "Bloomberg",
    endpoint: "/api/premium/bloomberg/feed",
    description: "Proprietary financial news, earnings call transcripts, and market commentary",
    icon: "B%",
  },
];

interface PaymentRequired {
  provider: string;
  providerId?: string;
  ratePerSecond: string;
  ratePerSecondMist: number;
  minimumDeposit: string;
  packageId: string;
  instructions: string;
}

interface FeedState {
  status: "idle" | "loading" | "payment_required" | "paying" | "success" | "error";
  paymentInfo?: PaymentRequired;
  data?: any;
  error?: string;
  txDigest?: string;
}

export default function PremiumFeedsPage() {
  const navigate = useNavigate();
  const currentAccount = useCurrentAccount();
  const isWalletConnected = !!currentAccount;
  const dAppKit = useDAppKit();

  const [feedStates, setFeedStates] = useState<Record<string, FeedState>>({});

  const updateFeedState = (feedId: string, state: Partial<FeedState>) => {
    setFeedStates((prev) => ({ ...prev, [feedId]: { ...prev[feedId], ...state } }));
  };

  const handleFetch = async (feed: PremiumFeed) => {
    if (!isWalletConnected) return;

    updateFeedState(feed.id, { status: "loading", error: undefined, data: undefined });

    try {
      const res = await fetch(`${API_BASE}${feed.endpoint}`);

      if (res.status === 402) {
        const body = await res.json();
        updateFeedState(feed.id, {
          status: "payment_required",
          paymentInfo: body.x402,
        });
        return;
      }

      if (!res.ok) {
        throw new Error(`Request failed: ${res.status}`);
      }

      const data = await res.json();
      updateFeedState(feed.id, { status: "success", data });
    } catch (err: any) {
      updateFeedState(feed.id, { status: "error", error: err.message || "Request failed" });
    }
  };

  const handlePayAndFetch = async (feed: PremiumFeed) => {
    const state = feedStates[feed.id];
    if (!state?.paymentInfo || !currentAccount?.address) return;

    updateFeedState(feed.id, { status: "paying", error: undefined });

    try {
      const amountMist = Number(state.paymentInfo.minimumDeposit);

      // Build a direct SUI transfer to the provider
      const tx = new Transaction();
      const [coin] = tx.splitCoins(tx.gas, [amountMist]);
      tx.transferObjects([coin], tx.pure.address(state.paymentInfo.provider));

      const result = await dAppKit.signAndExecuteTransaction({
        transaction: tx,
      });

      if (result.$kind !== "Transaction") {
        throw new Error("Transaction failed");
      }

      const txDigest = result.Transaction.digest;
      updateFeedState(feed.id, { txDigest });

      // Retry the request with the tx digest header
      const res = await fetch(`${API_BASE}${feed.endpoint}`, {
        headers: { "X-StreamEngine-Tx-Digest": txDigest },
      });

      if (!res.ok) {
        throw new Error(`Retry failed: ${res.status}`);
      }

      const data = await res.json();
      updateFeedState(feed.id, { status: "success", data });
    } catch (err: any) {
      updateFeedState(feed.id, { status: "error", error: err.message || "Payment failed" });
    }
  };

  const handleDismiss = (feedId: string) => {
    updateFeedState(feedId, { status: "idle", paymentInfo: undefined, error: undefined, data: undefined, txDigest: undefined });
  };

  const renderFeedCard = (feed: PremiumFeed) => {
    const state = feedStates[feed.id] || { status: "idle" };

    return (
      <div key={feed.id} className="border border-stone-200 bg-white p-6 shadow-sm flex flex-col gap-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#1C1A17] text-[#FAF9F5] flex items-center justify-center font-mono text-xs font-bold shrink-0">
              {feed.icon}
            </div>
            <div>
              <h3 className="font-sans font-bold text-lg text-[#1C1A17]">{feed.name}</h3>
              <span className="text-xs font-sans text-stone-400">{feed.provider}</span>
            </div>
          </div>
          <span className="px-2.5 py-0.5 border border-amber-300 text-amber-800 bg-amber-50 font-sans text-[10px] font-bold uppercase shrink-0">
            Premium
          </span>
        </div>

        <p className="text-sm font-sans text-stone-500 leading-relaxed">{feed.description}</p>

        {/* Content area based on state */}
        {state.status === "idle" && (
          <button
            onClick={() => handleFetch(feed)}
            disabled={!isWalletConnected}
            className="w-full py-3 bg-[#1C1A17] hover:bg-[#2E2E38] disabled:opacity-40 disabled:cursor-not-allowed text-[#FAF9F5] font-sans text-sm font-bold rounded-full transition-all flex items-center justify-center gap-2 shadow-md cursor-pointer"
          >
            <Rss className="w-4 h-4" />
            Fetch Feed Data
          </button>
        )}

        {state.status === "loading" && (
          <div className="flex items-center justify-center gap-2 py-3 text-sm font-sans text-stone-500">
            <Loader2 className="w-4 h-4 animate-spin" />
            Requesting feed...
          </div>
        )}

        {state.status === "payment_required" && state.paymentInfo && (
          <div className="flex flex-col gap-3">
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl flex flex-col gap-2">
              <div className="flex items-center gap-2 text-amber-800 font-sans text-sm font-bold">
                <AlertTriangle className="w-4 h-4" />
                402 Payment Required
              </div>
              <div className="flex flex-col gap-1.5 text-xs font-sans text-amber-900/80">
                <div className="flex justify-between">
                  <span>Rate:</span>
                  <span className="font-mono font-bold">{state.paymentInfo.ratePerSecond} SUI/sec</span>
                </div>
                <div className="flex justify-between">
                  <span>Provider:</span>
                  <span className="font-mono truncate max-w-[180px]" title={state.paymentInfo.provider}>
                    {state.paymentInfo.provider.slice(0, 10)}...{state.paymentInfo.provider.slice(-4)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Minimum deposit:</span>
                  <span className="font-mono font-bold">
                    {(Number(state.paymentInfo.minimumDeposit) / 1_000_000_000).toFixed(4)} SUI
                  </span>
                </div>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => handlePayAndFetch(feed)}
                className="flex-1 py-3 bg-[#8C2C16] hover:bg-[#A63A23] text-white font-sans text-sm font-bold rounded-full transition-all flex items-center justify-center gap-2 shadow-md cursor-pointer"
              >
                <Wallet className="w-4 h-4" />
                Pay & Fetch
              </button>
              <button
                onClick={() => handleDismiss(feed.id)}
                className="px-4 py-3 border border-stone-300 hover:bg-stone-50 text-stone-600 font-sans text-sm font-bold rounded-full transition-all cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {state.status === "paying" && (
          <div className="flex items-center justify-center gap-2 py-3 text-sm font-sans text-[#8C2C16]">
            <Loader2 className="w-4 h-4 animate-spin" />
            Signing transaction...
          </div>
        )}

        {state.status === "success" && state.data && (
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2 text-emerald-700 font-sans text-sm font-bold">
              <Check className="w-4 h-4" />
              Feed Data Retrieved
              {state.txDigest && (
                <span className="text-[10px] font-mono text-stone-400 font-normal ml-auto">
                  TX: {state.txDigest.slice(0, 10)}...
                </span>
              )}
            </div>
            <div className="border border-stone-200 bg-[#FAF9F5] p-4 rounded-xl max-h-[240px] overflow-y-auto custom-scrollbar">
              <pre className="text-[11px] font-mono text-stone-800 leading-relaxed whitespace-pre-wrap">
                <code>{JSON.stringify(state.data, null, 2)}</code>
              </pre>
            </div>
            <button
              onClick={() => handleDismiss(feed.id)}
              className="w-full py-2 border border-stone-200 hover:bg-stone-50 text-stone-500 font-sans text-xs font-bold rounded-full transition-all cursor-pointer"
            >
              Clear & Re-fetch
            </button>
          </div>
        )}

        {state.status === "error" && (
          <div className="flex flex-col gap-3">
            <div className="p-3 bg-red-50 border border-red-200 text-xs font-sans text-red-700 rounded-xl">
              {state.error}
            </div>
            <button
              onClick={() => handleDismiss(feed.id)}
              className="w-full py-2 border border-stone-200 hover:bg-stone-50 text-stone-500 font-sans text-xs font-bold rounded-full transition-all cursor-pointer"
            >
              Try Again
            </button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="pb-16">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-xs font-sans text-stone-500 mb-6">
        <span onClick={() => navigate("/")} className="hover:text-black cursor-pointer transition-colors font-semibold">Flowgate</span>
        <span>/</span>
        <span className="text-stone-400">Premium Feeds</span>
      </div>

      {/* Header */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 mb-10 border-b border-stone-300 pb-6">
        <div>
          <h1 className="font-sans text-3xl font-bold text-[#1C1A17]">Premium Feeds</h1>
          <p className="text-sm text-stone-500 mt-1">
            Access x402-protected data feeds by signing micropayment transactions with your Sui wallet.
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {!isWalletConnected && (
            <div className="px-4 py-2 bg-amber-50 border border-amber-200 text-xs font-sans text-amber-800 font-medium rounded-full">
              Connect wallet to access premium feeds
            </div>
          )}
          <button onClick={() => navigate("/register")} className="px-5 py-2.5 bg-[#8C2C16] hover:bg-[#A63A23] text-white rounded-full text-sm font-sans font-bold transition-all flex items-center gap-2 shadow-md hover:shadow-lg active:scale-95 cursor-pointer shrink-0">
            <Plus className="w-4 h-4" />Register New Endpoint
          </button>
        </div>
      </div>

      {/* How it works */}
      <div className="mb-8 p-5 bg-[#FAF9F5] border border-stone-200 rounded-2xl flex flex-col gap-3">
        <span className="text-xs font-sans text-[#8C2C16] font-bold uppercase tracking-wider">How x402 Payment Works</span>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs font-sans text-stone-600">
          <div className="flex items-start gap-2">
            <span className="w-5 h-5 rounded-full bg-[#1C1A17] text-[#FAF9F5] flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">1</span>
            <span>Click <strong>Fetch Feed Data</strong> — the server returns HTTP 402 with payment requirements.</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="w-5 h-5 rounded-full bg-[#1C1A17] text-[#FAF9F5] flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">2</span>
            <span>Review the rate and click <strong>Pay & Fetch</strong> — your wallet signs a SUI transfer to the provider.</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="w-5 h-5 rounded-full bg-[#1C1A17] text-[#FAF9F5] flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">3</span>
            <span>The transaction digest is sent as proof of payment and the feed data is returned.</span>
          </div>
        </div>
      </div>

      {/* Feed cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {PREMIUM_FEEDS.map(renderFeedCard)}
      </div>
    </div>
  );
}
