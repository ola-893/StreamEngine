/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from "react";
import { Routes, Route, useNavigate, useLocation, Navigate } from "react-router-dom";
import { Endpoint, Agent, HealthStatus, API_BASE, mapProviderToEndpoint, ProviderListing } from "./types";
import { useCurrentAccount } from "@mysten/dapp-kit-react";
import { ConnectButton } from "@mysten/dapp-kit-react/ui";
import { dAppKit } from "./dapp-kit-config";
import {
  Menu,
  X,
  Wallet,
  ChevronRight
} from "lucide-react";

import { ToastProvider } from "./lib/toast-context";
import LandingPage from "./components/LandingPage";
import OnboardingPage from "./components/OnboardingPage";
import AgentCreatePage from "./components/AgentCreatePage";
import AgentDashboardPage from "./components/AgentDashboardPage";
import AgentDetailPage from "./components/AgentDetailPage";
import RegisterPage from "./components/RegisterPage";
import ProviderPage from "./components/ProviderPage";
import DeveloperPage from "./components/DeveloperPage";
import PremiumFeedsPage from "./components/PremiumFeedsPage";



export default function App() {
  const navigate = useNavigate();
  const location = useLocation();

  const currentAccount = useCurrentAccount();
  const isWalletConnected = !!currentAccount;
  const walletAddress = currentAccount?.address ?? null;

  // Real SUI balance fetched from chain
  const [suiBalance, setSuiBalance] = useState<number>(0);
  const [balanceLoading, setBalanceLoading] = useState(false);

  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);

  // Agent state management (declared early so routing effects can reference them)
  const [agents, setAgents] = useState<Agent[]>([]);
  const [agentsLoaded, setAgentsLoaded] = useState(false);
  const [serverReachable, setServerReachable] = useState<boolean | null>(null);

  const fetchAgents = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/agents`);
      if (res.ok) {
        setServerReachable(true);
        const data = await res.json();
        const mapped = data.map((a: any) => ({
          id: a.id,
          name: a.name,
          description: a.description || "",
          purpose: a.purpose,
          maxBudgetSui: a.budgetMist / 1_000_000_000,
          currentSpendSui: a.spentMist / 1_000_000_000,
          createdAt: a.createdAt,
          activeStreamId: a.activeStreamId || a.activeStreams?.[0]?.streamId,
          remainingBalanceMist: a.remainingBalanceMist,
          walletAddress: a.walletAddress,
          connectedEndpoints: a.connectedEndpoints || a.activeStreams?.map((s: any) => s.endpoint) || [],
        }));
        setAgents(mapped);
      }
    } catch (e) {
      console.error(e);
      setServerReachable(false);
    } finally {
      setAgentsLoaded(true);
    }
  }, []);

  useEffect(() => {
    fetchAgents();
  }, [fetchAgents]);

  const handleAddAgent = (agent: Agent) => {
    setAgents((prev) => [agent, ...prev]);
  };

  const handleUpdateAgent = (id: string, updates: Partial<Agent>) => {
    setAgents((prev) => prev.map((a) => (a.id === id ? { ...a, ...updates } : a)));
  };

  const handleDeleteAgent = (id: string) => {
    setAgents((prev) => prev.filter((a) => a.id !== id));
  };

  // Auto-navigate when wallet connects on landing page
  // Has agents → premium, no agents → onboarding
  // Gated on agentsLoaded AND serverReachable (not false) to avoid redirecting to
  // /onboarding when the server is simply unreachable (agents still exist in the DB)
  const prevConnectedRef = React.useRef(isWalletConnected);
  useEffect(() => {
    if (isWalletConnected && !prevConnectedRef.current && location.pathname === "/" && agentsLoaded && serverReachable !== false) {
      navigate(agents.length > 0 ? "/premium" : "/onboarding");
    }
    prevConnectedRef.current = isWalletConnected;
  }, [isWalletConnected, location.pathname, navigate, agents.length, agentsLoaded, serverReachable]);

  // If a connected user lands on / (e.g. sidebar Home button), route appropriately
  useEffect(() => {
    if (isWalletConnected && location.pathname === "/" && agentsLoaded && serverReachable !== false) {
      navigate(agents.length > 0 ? "/premium" : "/onboarding", { replace: true });
    }
  }, [isWalletConnected, location.pathname, agents.length, navigate, agentsLoaded, serverReachable]);

  // Fetch real SUI balance from chain — tries mainnet, falls back to testnet
  useEffect(() => {
    if (!isWalletConnected || !walletAddress) {
      setSuiBalance(0);
      setBalanceLoading(false);
      return;
    }
    setBalanceLoading(true);

    const RPC_ENDPOINTS = [
      "https://fullnode.testnet.sui.io:443",
      "https://fullnode.mainnet.sui.io:443",
    ];

    async function fetchBalance() {
      for (const rpcUrl of RPC_ENDPOINTS) {
        try {
          const res = await fetch(rpcUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              jsonrpc: "2.0",
              id: 1,
              method: "suix_getBalance",
              params: [walletAddress, "0x2::sui::SUI"],
            }),
          });
          const json = await res.json();
          const balance = Number(json.result?.totalBalance || "0") / 1_000_000_000;
          if (balance > 0) {
            setSuiBalance(balance);
            setBalanceLoading(false);
            return;
          }
        } catch {
          // Try next endpoint
        }
      }
      setSuiBalance(0);
      setBalanceLoading(false);
    }

    fetchBalance();
  }, [isWalletConnected, walletAddress]);

  // Backend health status (polls every 30s)
  const [healthStatus, setHealthStatus] = useState<HealthStatus | null>(null);

  useEffect(() => {
    const checkHealth = () => {
      fetch(`${API_BASE}/api/health`)
        .then((res) => res.json())
        .then((data: HealthStatus) => setHealthStatus(data))
        .catch(() => setHealthStatus(null));
    };
    checkHealth();
    const interval = setInterval(checkHealth, 30_000);
    return () => clearInterval(interval);
  }, []);

  // Backend-backed provider state
  const [providers, setProviders] = useState<Endpoint[]>([]);
  const [providersLoading, setProvidersLoading] = useState(false);

  // Fetch providers from backend
  const fetchProviders = useCallback(async () => {
    setProvidersLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/providers`);
      const data: { providers: ProviderListing[] } = await res.json();
      if (data.providers) {
        setProviders(data.providers.map(mapProviderToEndpoint));
      }
    } catch {
      // Fallback to hardcoded demo data if server is offline
      setProviders(getDefaultEndpoints());
    } finally {
      setProvidersLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProviders();
  }, [fetchProviders]);

  // Wallet disconnect handler
  const handleDisconnectWallet = async () => {
    await dAppKit.disconnectWallet();
    setSuiBalance(0);
    setBalanceLoading(false);
    navigate("/");
  };

  // State modifying Handlers
  const handleAddEndpoint = (newEp: Endpoint) => {
    setProviders((prev) => [newEp, ...prev]);
  };

  // Check if we're on the landing or onboarding page (no sidebar)
  const isFullscreenPage = location.pathname === "/" || location.pathname === "/onboarding" || location.pathname === "/agent/create";

  // Add AgentSpace to categories
  const categories = ["Core Markets", "Agent Space", "Resources"];

  // Sidebar navigation items
  const navigationTabs = [
    { path: "/premium", label: "Premium Feeds", num: "01", category: "Core Markets" },
    { path: "/provider", label: "Provider Dashboard", num: "02", category: "Core Markets" },
    { path: "/agent/dashboard", label: "My Agents", num: "03", category: "Agent Space" },
    { path: "/developer", label: "Developer Tools", num: "04", category: "Resources" }
  ];

  // Full-bleed pages (landing, onboarding) render without sidebar
  if (isFullscreenPage) {
    return (
      <ToastProvider>
      <div className="bg-[#E5E5ED] min-h-screen">
        <Routes>
          <Route path="/" element={
            <LandingPage
              isWalletConnected={isWalletConnected}
              walletAddress={walletAddress}
              onDisconnectWallet={handleDisconnectWallet}
            />
          } />
          <Route path="/onboarding" element={
            <OnboardingPage
              isWalletConnected={isWalletConnected}
              walletAddress={walletAddress}
              suiBalance={suiBalance}
            />
          } />
          <Route path="/agent/create" element={
            isWalletConnected ? (
              <AgentCreatePage
                isWalletConnected={isWalletConnected}
                walletAddress={walletAddress}
                suiBalance={suiBalance}
                onDeploy={handleAddAgent}
              />
            ) : (
              <Navigate to="/" replace />
            )
          } />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
      </ToastProvider>
    );
  }

  // App pages with sidebar
  return (
    <ToastProvider>
    <div className="flex flex-col md:flex-row min-h-screen bg-[#E5E5ED] text-[#1C1A17] antialiased font-sans selection:bg-[#E8DCC4] selection:text-black">

      {/* MOBILE HEADER BAR */}
      <div className="md:hidden flex items-center justify-between px-6 py-4 bg-[#E5E5ED] border-b border-stone-200">
        <div className="flex flex-col">
          <span className="font-sans font-bold text-lg">Flowgate</span>
          <span className="text-xs text-[#7C7567]">Workspace</span>
        </div>
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="p-1.5 border border-stone-300 bg-stone-50 select-none text-stone-700"
        >
          {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* SIDEBAR */}
      <aside className={`
        ${mobileMenuOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}
        fixed md:sticky inset-y-0 md:inset-y-auto left-0 z-40 transition-transform duration-300 ease-in-out
        w-80 md:w-72 bg-[#E5E5ED] border-r border-stone-250 flex flex-col justify-between p-6 shrink-0
        h-full md:h-screen md:top-0 overflow-y-auto
      `}>
        <div className="flex flex-col gap-6">
          {/* Brand */}            <div className="flex items-center gap-3 pb-4 border-b border-stone-200">
              <img src="/logo.svg" alt="FlowGate" className="w-9 h-9" />
              <div className="flex flex-col">
                <span className="font-sans font-bold text-xl text-[#1C1A17]">Flowgate</span>
                <span className="text-[10px] font-sans text-[#7C7567]">Node Workspace v0.16</span>
              </div>
              <button
                onClick={() => { navigate("/"); setMobileMenuOpen(false); }}
                className="ml-auto px-3 py-1.5 text-[10px] font-mono border border-stone-300 bg-[#FAF9F5] hover:border-[#1C1A17] hover:bg-[#1C1A17]/5 uppercase transition-all rounded-full shadow-sm cursor-pointer"
              >
                Home
              </button>
            </div>

          {/* Wallet Card */}
          <div className="p-4 bg-[#FAF9F5] border border-stone-200/80">
            <div className="flex items-center justify-between mb-2 pb-2 border-b border-stone-200/60">
              <span className="text-xs font-sans text-[#7C7567] font-medium">Wallet</span>
              <span className={`w-2 h-2 rounded-full ${isWalletConnected ? "bg-emerald-600" : "bg-stone-300"}`} />
            </div>

            {isWalletConnected ? (
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-1.5 font-mono text-xs text-[#1C1A17] font-semibold">
                  <Wallet className="w-3.5 h-3.5 text-stone-500" />
                  <span>{walletAddress ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}` : "Sui Handshake"}</span>
                </div>
                <div className="flex justify-between items-baseline mt-1 font-mono">
                  <span className="text-xs text-[#7C7567]">SUI Balance</span>
                  <span className=" text-sm font-bold text-[#1C1A17]">
                    {balanceLoading ? "..." : `${suiBalance.toFixed(4)} SUI`}
                  </span>
                </div>
                <button
                  onClick={handleDisconnectWallet}
                  className="w-full mt-2 py-1.5 bg-transparent hover:bg-stone-200/50 border border-stone-300 text-[10px] text-stone-600 font-mono uppercase text-center rounded-full transition-all cursor-pointer"
                >
                  Disconnect Account
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-2 py-1">
                <p className="text-[11px] font-serif text-stone-600 leading-normal mb-1">
                  Connect Sui wallet to access escrow operations.
                </p>
                <div className="w-full flex justify-center overflow-hidden rounded-full" style={{ transform: "scale(0.85)" }}>
                  <ConnectButton />
                </div>
              </div>
            )}
          </div>

          {/* Navigation Links */}
          <div className="flex flex-col gap-4 mt-2">
            {categories.map((category) => (
              <div key={category} className="flex flex-col gap-1">
                <span className="text-[10px] font-sans text-stone-400 font-medium pl-1">
                  {category}
                </span>
                <div className="flex flex-col gap-1.5">
                  {navigationTabs
                    .filter((tab) => tab.category === category)
                    .map((tab) => {
                      const isActive = location.pathname.startsWith(tab.path);
                      return (
                        <button
                          key={tab.path}
                          onClick={() => { navigate(tab.path); setMobileMenuOpen(false); }}
                          className={`w-full text-left p-2.5 flex items-center justify-between border transition-all rounded-full ${
                            isActive
                              ? "bg-[#1C1A17] text-[#E5E5ED] border-[#1C1A17]"
                              : "bg-[#E5E5ED] hover:bg-stone-300/45 text-stone-700 border-transparent"
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <span className={`text-[10px] font-mono font-bold ${isActive ? "text-stone-400" : "text-[#8C2C16]"}`}>
                              {tab.num}
                            </span>
                            <span className="text-[11.5px] font-sans font-semibold">
                              {tab.label}
                            </span>
                          </div>
                          <ChevronRight className={`w-3.5 h-3.5 shrink-0 ${isActive ? "text-stone-400" : "text-stone-300"}`} />
                        </button>
                      );
                    })}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Sidebar Footer */}
        <div className="mt-8 pt-4 border-t border-stone-200">
          <div className="p-3 bg-white/65 border border-stone-200 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-sans text-stone-400">Network Status</span>
              <span className={`w-2 h-2 rounded-full ${healthStatus?.status === "ok" ? "bg-emerald-500" : "bg-stone-300"}`} />
            </div>
            <div className="flex justify-between items-baseline font-mono mt-1">
              <span className="text-xs text-stone-500">Registered Endpoints</span>
              <span className="font-sans text-sm font-bold text-[#8C2C16]">{healthStatus?.providers ?? providers.length}</span>
            </div>
          </div>
          <div className="text-[10px] text-stone-400 font-sans mt-3 text-center">
            Flowgate Protocol • 2026
          </div>
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <main className="flex-1 bg-[#E5E5ED] min-h-screen text-[#1C1A17] relative p-6 md:p-10 lg:p-14 overflow-x-hidden">
        <div className="absolute top-0 right-1/4 w-[1px] h-full bg-stone-200/45 pointer-events-none hidden lg:block" />
        <div className="max-w-6xl mx-auto relative z-10">
          <Routes>
            {/* Protected: wallet required */}
            <Route path="/premium" element={
              isWalletConnected ? <PremiumFeedsPage /> : <Navigate to="/" replace />
            } />
            <Route path="/register" element={
              isWalletConnected ? (
                <RegisterPage
                  onAddEndpoint={handleAddEndpoint}
                  walletAddress={walletAddress}
                  isWalletConnected={isWalletConnected}
                  suiBalance={suiBalance}
                />
              ) : (
                <Navigate to="/" replace />
              )
            } />
            <Route path="/provider" element={
              isWalletConnected ? (
                <ProviderPage endpoints={providers} isWalletConnected={isWalletConnected} walletAddress={walletAddress} />
              ) : (
                <Navigate to="/" replace />
              )
            } />
            {/* Protected: wallet required + must have agents */}
            <Route path="/agent/dashboard" element={
              !isWalletConnected ? (
                <Navigate to="/" replace />
              ) : !agentsLoaded ? (
                <div className="flex items-center justify-center min-h-[60vh]"><span className="text-sm text-stone-400 font-sans">Loading agents...</span></div>
              ) : !serverReachable ? (
                <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
                  <p className="text-sm text-stone-500 font-sans">Server is unreachable. Your agents are stored in the database.</p>
                  <p className="text-xs text-stone-400 font-mono">Start the server with <code className="bg-stone-200 px-1.5 py-0.5 rounded">bash dev.sh</code></p>
                  <button onClick={fetchAgents} className="px-4 py-2 text-xs font-mono border border-stone-300 bg-white hover:bg-stone-100 rounded-full transition-all cursor-pointer">Retry</button>
                </div>
              ) : agents.length === 0 ? (
                <Navigate to="/onboarding" replace />
              ) : (
                <AgentDashboardPage
                  agents={agents}
                  onUpdateAgent={handleUpdateAgent}
                />
              )
            } />
            <Route path="/agent/:id" element={
              !isWalletConnected ? (
                <Navigate to="/" replace />
              ) : !agentsLoaded ? (
                <div className="flex items-center justify-center min-h-[60vh]"><span className="text-sm text-stone-400 font-sans">Loading agents...</span></div>
              ) : (
                <AgentDetailPage
                  agents={agents}
                  onUpdateAgent={handleUpdateAgent}
                  onDeleteAgent={handleDeleteAgent}
                />
              )
            } />
            <Route path="/developer" element={<DeveloperPage />} />
            <Route path="*" element={
              <Navigate to={isWalletConnected ? "/premium" : "/"} replace />
            } />
          </Routes>
        </div>
      </main>

      {/* Mobile backdrop */}
      {mobileMenuOpen && (
        <div
          onClick={() => setMobileMenuOpen(false)}
          className="fixed inset-0 bg-[#121210]/40 z-30 md:hidden transition-opacity"
        />
      )}
    </div>
    </ToastProvider>
  );
}

// Fallback demo endpoints when backend is offline
function getDefaultEndpoints(): Endpoint[] {
  return [
    {
      id: "x-social", name: "X (Twitter)", type: "api", status: "active",
      price: 0.0001, unit: "sec of access", dataProvider: "X (Twitter)",
      latency: 12, throughput: "42.4 MB/s", rating: 4.95, uptime: 99.99,
      description: "Real-time posts, trending topics, and human interactions from X.com",
      endpointUrl: "https://x.com", inputs: [], outputs: [],
      apiKeyRequired: false, totalRequests: 140392, activeConsumers: 5, gasSui: 0.002
    },
    {
      id: "reddit", name: "Reddit", type: "api", status: "active",
      price: 0.0001, unit: "sec of access", dataProvider: "Reddit",
      latency: 15, throughput: "38.2 MB/s", rating: 4.88, uptime: 99.85,
      description: "Upvoted threads, community discussions, and niche subreddit data",
      endpointUrl: "https://reddit.com", inputs: [], outputs: [],
      apiKeyRequired: true, totalRequests: 89422, activeConsumers: 12, gasSui: 0.015
    },
    {
      id: "bloomberg", name: "Bloomberg", type: "api", status: "active",
      price: 0.0001, unit: "sec of access", dataProvider: "Bloomberg",
      latency: 8, throughput: "120.8 MB/s", rating: 4.91, uptime: 99.72,
      description: "Proprietary financial news, earnings call transcripts, and market commentary",
      endpointUrl: "https://bloomberg.com", inputs: [], outputs: [],
      apiKeyRequired: true, totalRequests: 110291, activeConsumers: 2, gasSui: 0.02
    }
  ];
}
