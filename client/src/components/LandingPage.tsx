import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
import { ConnectButton } from "@mysten/dapp-kit-react/ui";
import {
  ArrowRight,
  ChevronRight,
  Wallet,
  X,
  Check,
  Shield,
  Activity,
  Cpu,
  Globe
} from "lucide-react";

interface LandingPageProps {
  isWalletConnected: boolean;
  walletAddress: string | null;
  onDisconnectWallet: () => void;
}

export default function LandingPage({
  isWalletConnected,
  walletAddress,
  onDisconnectWallet
}: LandingPageProps) {
  const navigate = useNavigate();
  const [useFallbackImg, setUseFallbackImg] = useState(false);
  const [activeWorkflowStep, setActiveWorkflowStep] = useState(1);
  const [activeTabSection, setActiveTabSection] = useState<"home" | "benefits" | "flow" | "stats">("home");

  const scrollToSection = (id: string, sectionKey: "home" | "benefits" | "flow" | "stats") => {
    setActiveTabSection(sectionKey);
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  return (
    <div className="min-h-screen bg-[#E5E5ED] text-[#1C1A17] font-sans antialiased overflow-x-hidden selection:bg-[#1C1A17] selection:text-[#E5E5ED] relative pb-12">
      
      {/* Background ambient light effects */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-[#8AF2D0]/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-1/3 right-1/4 w-[500px] h-[500px] bg-[#9F9FEF]/15 rounded-full blur-[150px] pointer-events-none" />

      {/* TOP BAR */}
      <header className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between relative z-50">
        <div className="flex items-center gap-2.5 cursor-pointer" onClick={() => navigate("/")}>
          <img src="/logo.svg" alt="FlowGate" className="w-8 h-8" />
          <span className="font-mono text-xs tracking-widest font-black uppercase">FLOWGATE</span>
        </div>

        {/* Central Pills menu */}
        <nav className="hidden md:flex items-center gap-1.5 bg-[#FAF9F6]/80 backdrop-blur-md border border-[#1C1A17]/10 p-1 rounded-full shadow-sm">
      

          <button onClick={() => scrollToSection("protocol-stats", "stats")} className={`px-4 py-1.5 rounded-full text-[11px] font-medium transition-all ${activeTabSection === "stats" ? "bg-[#1C1A17] text-[#FAF9F5]" : "text-[#1C1A17]/65 hover:text-[#1C1A17] hover:bg-[#1C1A17]/5"}`}>Features</button>
          <button onClick={() => scrollToSection("consensus-flow", "flow")} className={`px-4 py-1.5 rounded-full text-[11px] font-medium transition-all ${activeTabSection === "flow" ? "bg-[#1C1A17] text-[#FAF9F5]" : "text-[#1C1A17]/65 hover:text-[#1C1A17] hover:bg-[#1C1A17]/5"}`}>How It Works</button>
        </nav>

        {/* Right Wallet / Entry buttons */}
        <div className="flex items-center gap-3">
          {isWalletConnected ? (
            <div className="flex items-center gap-1.5">
              <div className="px-3.5 py-2 bg-[#FAF9F6] border border-[#1C1A17]/15 rounded-full font-mono text-[10.5px] font-bold text-[#1C1A17] flex items-center gap-2 shadow-sm">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                {walletAddress ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}` : "SUI Connected"}
              </div>
              <button onClick={onDisconnectWallet} className="p-2 bg-red-50 hover:bg-red-100 text-red-700 rounded-full border border-red-200 text-[10px] font-mono transition-all uppercase" title="Disconnect Wallet">
                <X className="w-3 h-3" />
              </button>
            </div>
          ) : (
            <div className="flex items-center" style={{ transform: "scale(0.85)", transformOrigin: "right center" }}>
              <ConnectButton />
            </div>
          )}

          {isWalletConnected ? (
            <button onClick={() => navigate("/onboarding")} className="px-4.5 py-2.5 bg-[#8C2C16] hover:bg-[#A63A23] text-white rounded-full text-[10px] font-mono font-bold tracking-wider transition-all flex items-center gap-1.5 shadow-md">
              Get Started<ArrowRight className="w-3.5 h-3.5" />
            </button>
          ) : (
            <></>
            // <button onClick={() => navigate("/directory")} className="hidden lg:block px-4 py-2 bg-transparent hover:bg-[#1C1A17]/5 text-[#1C1A17] border border-[#1C1A17]/30 rounded-full text-[10px] font-mono font-bold transition-all uppercase cursor-pointer">
            //   Guest Access
            // </button>
          )}
        </div>
      </header>

      {/* HERO */}
      <main id="hero-section" className="max-w-7xl mx-auto px-6 pt-10 pb-16 relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
        <div className="lg:col-span-6 flex flex-col items-start justify-center gap-8 relative z-25">
          <div className="flex flex-col gap-5">
            <motion.div initial={{ opacity: 0, x: -15 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.6 }} className="flex items-center gap-2 text-[#8C2C16] font-mono text-[10px] tracking-[0.25em] uppercase font-bold">
              <span className="w-1.5 h-1.5 bg-[#8C2C16]" />
              DECENTRALIZED AGENTIC PAYMENT RAIL // SUI TESTNET
            </motion.div>

            <h1 className="font-sans text-5xl sm:text-6xl xl:text-7xl font-semibold tracking-tighter text-[#1C1A17] leading-[0.92] select-none">
              <motion.span initial={{ opacity: 0, y: 35 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.1 }} className="block">Web APIs <span className="font-light text-[#1C1A17]/65">—</span></motion.span>
              <motion.span initial={{ opacity: 0, y: 35 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.2 }} className="block text-[#1C1A17]/85">monetized</motion.span>
              <motion.span initial={{ opacity: 0, y: 35 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.3 }} className="flex flex-wrap items-center gap-3.5 mt-2 text-2xl sm:text-3xl xl:text-4xl font-light tracking-tight text-[#1C1A17]">
                <span className="flex items-center -space-x-2 bg-[#1C1A17] px-3.5 py-1.5 rounded-full inline-flex shadow-sm py-1">
                  <span className="w-4 h-4 rounded-full border border-white/50 bg-[#8AF2D0]/20 animate-pulse" />
                  <span className="w-4 h-4 rounded-full border border-white/50 bg-[#9F9FEF]/20 animate-pulse" />
                  <span className="w-4 h-4 rounded-full border border-white/50 bg-white/20 animate-pulse" />
                </span>
                <span className="italic font-normal font-serif text-[#1C1A17]/70 font-medium">for autonomous AI agents</span>
              </motion.span>
            </h1>
          </div>

          <motion.div initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.4 }} className="w-full max-w-sm bg-[#FAF9F6]/90 backdrop-blur-md p-5 border border-[#1C1A17]/10 rounded-3xl shadow-sm flex flex-col gap-3 group hover:border-[#1C1A17]/20 transition-all duration-300 hover:shadow-md">
            <div className="flex items-center justify-between">
              <span className="px-3.5 py-1 bg-[#1C1A17] text-[#FAF9F5] rounded-full font-mono text-[9px] font-bold uppercase tracking-wider">+144,390 Queries Cleared</span>
              <div className="w-6 h-6 rounded-full bg-[#1C1A17]/5 flex items-center justify-center group-hover:bg-[#1C1A17]/10 transition-colors">
                <Activity className="w-3 h-3 text-[#1C1A17]/50 group-hover:text-[#1C1A17] transition-colors" />
              </div>
            </div>
            <p className="text-[11.5px] text-[#1C1A17]/70 leading-relaxed font-sans">Voluntarily register your website endpoints or APIs. AI agents pay you micro-fractions of SUI in real-time as they scrape, fetch, and digest your data.</p>
            <div className="flex items-center gap-1.5 text-[9px] font-mono text-[#8C2C16] font-bold uppercase mt-1 tracking-wider">
              <span className="w-1.5 h-1.5 rounded-full bg-[#8C2C16] animate-ping" />
              <span>PAYMENTS: REAL-TIME LEDGER MICRO-STREAMING ACTIVE</span>
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.5 }} className="flex items-center gap-4 group">
            <button onClick={() => navigate("/onboarding")} className="py-4.5 px-7 bg-[#1C1A17] hover:bg-[#2E2E38] text-[#FAF9F5] font-mono font-bold text-xs tracking-wider uppercase rounded-full flex items-center gap-3 shadow-lg hover:shadow-xl hover:translate-y-[-1px] transition-all cursor-pointer">
              <span>{isWalletConnected ? "SETUP YOUR AGENT" : "REGISTER YOUR WEBSITE"}</span>
              <div className="w-5 h-5 bg-white/10 rounded-full flex items-center justify-center group-hover:translate-x-1 transition-transform">
                <ChevronRight className="w-3.5 h-3.5 text-white" />
              </div>
            </button>
            <div className="text-[10px] font-mono text-[#1C1A17]/55 leading-tight uppercase font-semibold">
              settlement<br/><span className="text-[#8C2C16] font-black">IMMEDIATE / ON-CHAIN</span>
            </div>
          </motion.div>
        </div>

        {/* RIGHT COLUMN - Hero visual */}
        <div className="lg:col-span-6 min-h-[460px] lg:min-h-[580px] relative flex items-center justify-center z-10 pt-8 lg:pt-0">
          <div className="absolute w-[280px] h-[280px] sm:w-[380px] sm:h-[380px] rounded-full bg-gradient-to-tr from-[#9F9FEF]/20 to-[#8AF2D0]/10 border border-white/40 shadow-inner blur-[2px] pointer-events-none" />
          <motion.div animate={{ y: [0, -12, 0] }} transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }} className="w-full max-w-[340px] sm:max-w-[420px] relative z-20 flex justify-center items-center">
            <div className="w-[300px] h-[360px] sm:w-[380px] sm:h-[420px] bg-gradient-to-b from-[#FAF9F6]/90 to-[#E1E0E8]/90 rounded-3xl border border-[#1C1A17]/15 shadow-2xl relative p-8 overflow-hidden group">
              <div className="absolute top-4 left-4 font-mono text-[8px] text-[#1C1A17]/40 tracking-widest uppercase font-bold">VIRTUAL_CORE_01</div>
              <svg viewBox="0 0 100 120" className="w-full h-full text-[#1C1A17]/85 opacity-75">
                <path d="M15,40 C20,15 80,15 85,40 C80,42 60,35 50,42 C40,35 20,42 15,40" fill="none" stroke="currentColor" strokeWidth="1.5" strokeDasharray="1 1" />
                <path d="M22,42 C20,60 25,85 50,110 C75,85 80,60 78,42" fill="none" stroke="currentColor" strokeWidth="1.5" />
                <path d="M25,50 L45,55 L45,75" fill="none" stroke="currentColor" strokeWidth="1" strokeDasharray="2 2" />
                <path d="M75,50 L55,55 L55,75" fill="none" stroke="currentColor" strokeWidth="1" strokeDasharray="2 2"/>
                <circle cx="38" cy="65" r="4" fill="none" stroke="currentColor" strokeWidth="1.5" />
                <circle cx="38" cy="65" r="1.5" fill="#8AF2D0" />
                <circle cx="62" cy="65" r="4" fill="none" stroke="currentColor" strokeWidth="1.5" />
                <circle cx="62" cy="65" r="1.5" fill="#8AF2D0" />
                <line x1="10" y1="65" x2="90" y2="65" stroke="#8AF2D0" strokeWidth="1" className="animate-pulse" />
                <path d="M40,95 L35,115 M60,95 L65,115 M50,98 L50,118" stroke="currentColor" strokeWidth="1" />
              </svg>
              <div className="absolute top-1/2 left-1/4 w-2 h-2 rounded-full bg-[#8AF2D0] animate-ping" />
              <div className="absolute bottom-1/4 right-1/4 w-1.5 h-1.5 rounded-full bg-[#8C2C16] animate-pulse" />
            </div>
          </motion.div>
        </div>
      </main>

      {/* STATS */}
      <section id="protocol-stats" className="max-w-7xl mx-auto px-6 mt-12 grid grid-cols-1 md:grid-cols-3 gap-8 relative z-30">
        {[
          { num: "01", icon: <Globe className="w-3.5 h-3.5 text-[#1C1A17]/30" />, title: "Voluntary Payout Handshake", desc: "Website and API owners voluntarily register their endpoints, specify custom per-query rules or token prices, and bind their Sui payment coffer address instantly." },
          { num: "02", icon: <Cpu className="w-3.5 h-3.5 text-[#1C1A17]/30" />, title: "Continuous Micropayments", desc: "Every time an autonomous scraper, crawlbot, or LLM agent fetches your api endpoint, microsec payments clear directly into your wallet with zero intermediaries." },
          { num: "03", icon: <Shield className="w-3.5 h-3.5 text-[#1C1A17]/30" />, title: "Modern Agentic Web Economy", desc: "Escape restrictive signups, advertising blocks, and paywalls. Authorize programmatic data query requests seamlessly and monetize AI traffic directly on-chain." },
        ].map((s, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.6, delay: i * 0.15 }} className="bg-[#FAF9F6]/60 border border-[#1C1A17]/8 p-6 hover:bg-[#FAF9F6] transition-colors duration-300 rounded-3xl flex flex-col gap-3">
            <div className="flex items-center justify-between pb-2 border-b border-[#1C1A17]/8">
              <span className="font-mono text-[9px] text-[#1C1A17]/50 uppercase tracking-widest font-black">REGISTRATION // {s.num}</span>
              {s.icon}
            </div>
            <h3 className="font-sans text-xl font-bold text-[#1C1A17]">{s.title}</h3>
            <p className="text-[12px] text-[#1C1A17]/70 leading-relaxed">{s.desc}</p>
          </motion.div>
        ))}
      </section>

      {/* OPERATIONAL FLOW */}
      <section id="consensus-flow" className="max-w-7xl mx-auto px-6 mt-20 relative z-30">
        <div className="border border-[#1C1A17]/10 bg-[#FAF9F6] p-8 md:p-12 rounded-[32px] shadow-sm">
          <div className="flex flex-col lg:flex-row gap-12 items-start justify-between">
            <div className="lg:w-5/12 flex flex-col gap-6">
              <span className="font-mono text-[9px] text-[#8C2C16] uppercase tracking-widest font-black flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-[#8C2C16]" />Operational Consensus Flow
              </span>
              <h2 className="font-sans text-3xl md:text-4xl font-bold tracking-tight text-[#1C1A17]">How we monetize the AI-web boundary voluntarily</h2>
              <div className="flex flex-col gap-3 mt-4">
                {[
                  { id: 1, title: "01 / Register & Define Endpoint", desc: "List your website paths, formats, and declare standard unit prices in SUI." },
                  { id: 2, title: "02 / Escrow Funding", desc: "AI Scraping Agents pre-authorize wallets and fund continuous channel locks." },
                  { id: 3, title: "03 / Immediate Settlement", desc: "Every microsecond transaction resolves to your connected coffer instantly." }
                ].map((s) => (
                  <button key={s.id} onClick={() => setActiveWorkflowStep(s.id)} className={`text-left p-4 rounded-2xl border transition-all flex flex-col gap-1 cursor-pointer ${activeWorkflowStep === s.id ? "bg-[#1C1A17] text-[#FAF9F5] border-[#1C1A17]" : "bg-[#FAF9F5] hover:bg-[#1C1A17]/5 border-[#1C1A17]/8 text-[#1C1A17]"}`}>
                    <span className="font-mono text-[9.5px] font-bold uppercase tracking-wider">{s.title}</span>
                    <span className={`text-[11.5px] leading-snug ${activeWorkflowStep === s.id ? "text-[#FAF9F5]/75" : "text-[#1C1A17]/65"}`}>{s.desc}</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="lg:w-6/12 w-full bg-[#FAF9F5] border border-[#1C1A17]/10 p-6 rounded-[24px] shadow-inner relative overflow-hidden min-h-[380px] flex flex-col justify-between">
              <div className="flex items-center justify-between pb-3 border-b border-[#1C1A17]/8 font-mono text-[8.5px] text-[#1C1A17]/50 font-bold">
                <span>SIMULATED_TRANSACTION_ENGINE</span>
                <span className="text-emerald-600 animate-pulse flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />CLEARING_ACTIVE</span>
              </div>

              <AnimatePresence mode="wait">
                {activeWorkflowStep === 1 && (
                  <motion.div key="step-1" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="flex flex-col gap-5 py-6">
                    <div className="flex items-center justify-between bg-white p-4 border border-[#1C1A17]/8 rounded-xl shadow-sm">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded bg-[#1C1A17] text-white flex items-center justify-center font-mono">Σ</div>
                        <div>
                          <p className="font-mono text-xs font-black">bloomberg_agg_v4</p>
                          <p className="text-[10px] text-stone-400">Endpoint JSON declared with Base Rate</p>
                        </div>
                      </div>
                      <span className="font-mono text-xs font-black text-[#8C2C16]">0.05 SUI / Query</span>
                    </div>
                    <p className="text-[12px] text-stone-600 leading-relaxed font-sans">By registering, your website provides certified machine-readable data feeds. Only paying scrapers are routed through our smart reverse-proxy, filtering out high-volume unauthorized DDoS traffic.</p>
                    <div className="bg-[#1C1A17] text-[#8AF2D0] p-4 rounded-xl font-mono text-[10px] space-y-1 overflow-x-auto whitespace-pre">
                      <p className="text-white/45">// Web Payout Header Config</p>
                      <p>GET /api/v1/feed HTTP/1.1</p>
                      <p>Sui-Payout-Address: <span className="text-[#9F9FEF]">0x7a840e2...04c</span></p>
                      <p>X-Required-Gas-Fee: 0.05 SUI</p>
                    </div>
                  </motion.div>
                )}
                {activeWorkflowStep === 2 && (
                  <motion.div key="step-2" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="flex flex-col gap-5 py-6">
                    <p className="text-[12px] text-stone-600 leading-relaxed">AI autonomous clients lock Sui balances securely inside a non-custodial smart escrow contract. The channel validates each requested signature handshake block dynamically.</p>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-white p-4 border border-[#141416]/8 rounded-xl flex flex-col gap-1">
                        <span className="font-mono text-[8px] text-stone-400 uppercase">Pre-Funded Escrow</span>
                        <span className="font-sans text-lg font-black text-[#8C2C16]">150.00 SUI</span>
                      </div>
                      <div className="bg-white p-4 border border-[#141416]/8 rounded-xl flex flex-col gap-1">
                        <span className="font-mono text-[8px] text-stone-400 uppercase">Available Calls</span>
                        <span className="font-sans text-lg font-black text-[#1C1A17]">3,000 Queries</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 p-3 bg-emerald-50 rounded-lg border border-emerald-150 font-mono text-[9px] text-emerald-700 uppercase font-bold justify-center">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-ping" />
                      ESCR_CHNL: Verified pre-authorized gas keys
                    </div>
                  </motion.div>
                )}
                {activeWorkflowStep === 3 && (
                  <motion.div key="step-3" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="flex flex-col gap-4 py-6">
                    <div className="border border-stone-200 bg-white p-4 rounded-xl relative overflow-hidden">
                      <span className="absolute inset-y-0 left-0 w-1 bg-emerald-500" />
                      <div className="flex justify-between items-center text-[10px] font-mono text-stone-400 mb-2 pb-2 border-b border-stone-100">
                        <span>TRANSACTION RESOLVED #TX-40291</span>
                        <span>0.002 SECONDS AGO</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                          <span className="font-mono text-[11px] font-bold uppercase tracking-tight text-[#1C1A17]">API.bloomberg_v4</span>
                        </div>
                        <span className="font-serif font-black text-[14px] text-emerald-600">+0.05 SUI Received</span>
                      </div>
                    </div>
                    <p className="text-[12px] text-stone-605 leading-relaxed">Every prompt request from AI agents triggers immediate ledger transfer. Payments are cleared off-chain through micropayment hashes and bundled safely to SUI network Testnet.</p>
                    <button onClick={() => navigate("/directory")} className="w-full py-3 bg-[#1C1A17] hover:bg-[#2E2E3A] text-[#FAF9F5] font-mono font-bold text-[10px] uppercase rounded-xl flex items-center justify-center gap-2 tracking-wider transition-colors">
                      Browse registered channels<ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="pt-3 border-t border-[#1C1A17]/8 flex items-center justify-between font-mono text-[8px] text-[#1C1A17]/45 uppercase font-bold mt-auto">
                <span>Active Channels: 57</span>
                <span>Voluntary registry count: +1,492 APIs</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* BENEFITS */}
      <section id="benefits-grid" className="max-w-7xl mx-auto px-6 mt-16 relative z-30">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="bg-[#FAF9F6]/80 p-8 border border-[#1C1A17]/10 rounded-3xl flex flex-col gap-6">
            <div className="w-10 h-10 rounded-full bg-[#8C2C16]/10 flex items-center justify-center"><Globe className="w-5 h-5 text-[#8C2C16]" /></div>
            <h3 className="font-serif text-2xl font-bold italic text-[#1C1A17]">Website / API Provider Rewards</h3>
            <ul className="space-y-3 font-mono text-[10px] uppercase tracking-wide font-bold pt-2 text-[#1C1A17]/75">
              <li className="flex items-center gap-2.5"><Check className="w-4 h-4 text-emerald-600 shrink-0" /><span>Zero AD Dependable Models</span></li>
              <li className="flex items-center gap-2.5"><Check className="w-4 h-4 text-emerald-600 shrink-0" /><span>Microsecond Ledger Payout Settlement</span></li>
              <li className="flex items-center gap-2.5"><Check className="w-4 h-4 text-emerald-600 shrink-0" /><span>Eliminate Bot Noise & Server Burn</span></li>
            </ul>
          </div>
          <div className="bg-[#FAF9F6]/80 p-8 border border-[#1C1A17]/10 rounded-3xl flex flex-col gap-6">
            <div className="w-10 h-10 rounded-full bg-[#9F9FEF]/20 flex items-center justify-center"><Cpu className="w-5 h-5 text-[#9F9FEF]" /></div>
            <h3 className="font-serif text-2xl font-bold italic text-[#1C1A17]">AI Agents & Scraper Benefits</h3>
            <ul className="space-y-3 font-mono text-[10px] uppercase tracking-wide font-bold pt-2 text-[#1C1A17]/75">
              <li className="flex items-center gap-2.5"><Check className="w-4 h-4 text-emerald-600 shrink-0" /><span>Guaranteed Certified JSON Schemas</span></li>
              <li className="flex items-center gap-2.5"><Check className="w-4 h-4 text-emerald-600 shrink-0" /><span>Flexible Micro-Payments Per-Query Only</span></li>
              <li className="flex items-center gap-2.5"><Check className="w-4 h-4 text-emerald-600 shrink-0" /><span>Bypass Cloudflare Rate-Limits Entirely</span></li>
            </ul>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="max-w-7xl mx-auto px-6 mt-20 pt-8 border-t border-[#1C1A17]/10 flex flex-col md:flex-row items-center justify-between gap-4 select-none relative z-30">
        <span className="font-mono text-[9px] text-[#1C1A17]/45 uppercase font-bold tracking-wider">© 2026 FLOWGATE_INIT • DECENTRALIZED PAYMENT CHANNELS SECURED</span>
        <div className="flex items-center gap-6 font-mono text-[9px] font-bold text-[#1C1A17]/50 uppercase">
          {/* <a href="#github" className="hover:text-[#1C1A17] transition-colors">GITHUB</a>
          <a href="#whitepaper" className="hover:text-[#1C1A17] transition-colors">WHITEPAPER</a>
          <a href="#discord" className="hover:text-[#1C1A17] transition-colors">DISCORD</a> */}
        </div>
      </footer>
    </div>
  );
}
