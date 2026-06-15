import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
import { ConnectButton } from "@mysten/dapp-kit-react/ui";
import {
  Wallet,
  Globe,
  Cpu,
  ArrowRight,
  Check,
  ChevronRight,
  Sparkles,
  Zap,
  Shield,
  Play,
  Bot
} from "lucide-react";

interface OnboardingPageProps {
  isWalletConnected: boolean;
  walletAddress: string | null;
  suiBalance: number;
}

export default function OnboardingPage({
  isWalletConnected,
  walletAddress,
  suiBalance,
}: OnboardingPageProps) {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [selectedRole, setSelectedRole] = useState<"provider" | "consumer" | null>(null);

  const steps = [
    { id: 1, label: "Welcome", desc: "What is FlowGate?" },
    { id: 2, label: "Connect", desc: "Link your Sui wallet" },
    { id: 3, label: "Choose", desc: "Pick your role" },
    { id: 4, label: "Launch", desc: "Enter the protocol" },
  ];

  return (
    <div className="min-h-screen bg-[#E5E5ED] flex flex-col">
      {/* Top progress bar */}
      <div className="w-full px-6 pt-6">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2.5 cursor-pointer" onClick={() => navigate("/")}>
              <div className="flex items-center gap-1 bg-[#1C1A17] text-[#E5E5ED] p-2 leading-none font-black text-sm tracking-tighter">
                <span>Σ</span><span>N</span>
              </div>
              <span className="font-mono text-xs tracking-widest font-black uppercase">FLOWGATE</span>
            </div>
            <button
              onClick={() => navigate("/")}
              className="px-3 py-1.5 text-[10px] font-mono border border-stone-300 bg-[#FAF9F5] hover:border-[#1C1A17] uppercase transition-all rounded-full"
            >
              Skip
            </button>
          </div>

          {/* Step indicators */}
          <div className="grid grid-cols-4 gap-2 mb-8">
            {steps.map((s) => (
              <div key={s.id} className="flex flex-col gap-1">
                <div className={`h-1 transition-all duration-500 ${step >= s.id ? "bg-[#8C2C16]" : "bg-stone-200"}`} />
                <span className={`text-[8px] font-mono uppercase tracking-wider ${step >= s.id ? "text-stone-700 font-bold" : "text-stone-400"}`}>
                  {s.label}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Main content area */}
      <div className="flex-1 flex items-center justify-center px-6 pb-12">
        <div className="max-w-3xl w-full">
          <AnimatePresence mode="wait">
            {/* STEP 1: Welcome */}
            {step === 1 && (
              <motion.div
                key="step-1"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="flex flex-col items-center text-center gap-8"
              >
                <div className="w-20 h-20 rounded-full bg-[#1C1A17] flex items-center justify-center">
                  <Bot className="w-10 h-10 text-[#8AF2D0]" />
                </div>

                <div className="flex flex-col gap-3">
                  <h1 className="font-serif text-4xl sm:text-5xl font-semibold tracking-tighter text-[#1C1A17] leading-[0.95]">
                    Welcome to <span className="italic text-[#8C2C16]">FlowGate</span>
                  </h1>
                  <p className="text-sm text-stone-600 max-w-lg leading-relaxed font-sans">
                    The decentralized payment rail where AI agents pay micro-fractions of SUI
                    to access web APIs — and website owners earn from every query, in real time.
                  </p>
                </div>

                <div className="grid grid-cols-3 gap-6 w-full max-w-lg">
                  {[
                    { icon: <Globe className="w-5 h-5" />, title: "Register", desc: "List your website endpoints" },
                    { icon: <Cpu className="w-5 h-5" />, title: "Connect", desc: "AI agents discover your API" },
                    { icon: <Zap className="w-5 h-5" />, title: "Earn", desc: "Get paid per-second in SUI" },
                  ].map((item, i) => (
                    <div key={i} className="flex flex-col items-center gap-2 p-4 bg-[#FAF9F6] border border-stone-200 rounded-2xl">
                      <div className="w-10 h-10 rounded-full bg-[#8C2C16]/10 flex items-center justify-center text-[#8C2C16]">
                        {item.icon}
                      </div>
                      <span className="text-xs font-mono font-bold uppercase">{item.title}</span>
                      <span className="text-[10px] text-stone-500 text-center">{item.desc}</span>
                    </div>
                  ))}
                </div>

                <button
                  onClick={() => setStep(2)}
                  className="py-3.5 px-8 bg-[#1C1A17] hover:bg-[#2E2E38] text-white font-mono text-xs font-bold tracking-wider uppercase rounded-full flex items-center gap-2 shadow-lg transition-all"
                >
                  Get Started
                  <ArrowRight className="w-4 h-4" />
                </button>
              </motion.div>
            )}

            {/* STEP 2: Connect Wallet */}
            {step === 2 && (
              <motion.div
                key="step-2"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="flex flex-col items-center text-center gap-8"
              >
                <div className="w-20 h-20 rounded-full bg-[#FAF9F6] border border-stone-200 flex items-center justify-center">
                  <Wallet className="w-10 h-10 text-[#8C2C16]" />
                </div>

                <div className="flex flex-col gap-3">
                  <h2 className="font-serif text-3xl font-semibold tracking-tight text-[#1C1A17]">
                    Connect your Sui wallet
                  </h2>
                  <p className="text-sm text-stone-600 max-w-md leading-relaxed">
                    Link your Sui wallet to register endpoints, fund escrows, or receive payments.
                    You can also skip and explore as a guest.
                  </p>
                </div>

                {isWalletConnected ? (
                  <div className="flex flex-col items-center gap-3 p-6 bg-emerald-50 border border-emerald-200 rounded-2xl">
                    <div className="flex items-center gap-2">
                      <Check className="w-5 h-5 text-emerald-700" />
                      <span className="text-sm font-mono font-bold text-emerald-800 uppercase">Wallet Connected</span>
                    </div>
                    <span className="text-xs font-mono text-stone-600 select-all">{walletAddress}</span>
                    <span className="text-sm font-serif font-bold text-[#1C1A17]">{suiBalance.toFixed(4)} SUI</span>
                    <button
                      onClick={() => setStep(3)}
                      className="py-3 px-8 bg-[#1C1A17] hover:bg-[#2E2E38] text-white font-mono text-xs font-bold tracking-wider uppercase rounded-full flex items-center gap-2 transition-all"
                    >
                      Continue
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-4">
                    <ConnectButton />
                    <button
                      onClick={() => setStep(3)}
                      className="text-xs font-mono text-stone-500 hover:text-stone-800 underline underline-offset-4 transition-colors cursor-pointer"
                    >
                      Skip for now — browse as guest
                    </button>
                  </div>
                )}

                <button
                  onClick={() => setStep(1)}
                  className="text-xs font-mono text-stone-400 hover:text-stone-700 transition-colors"
                >
                  ← Back
                </button>
              </motion.div>
            )}

            {/* STEP 3: Choose Role */}
            {step === 3 && (
              <motion.div
                key="step-3"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="flex flex-col items-center text-center gap-8"
              >
                <div className="flex flex-col gap-3">
                  <h2 className="font-serif text-3xl font-semibold tracking-tight text-[#1C1A17]">
                    How will you use FlowGate?
                  </h2>
                  <p className="text-sm text-stone-600 max-w-md leading-relaxed">
                    Choose your primary role. You can always switch later.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 w-full max-w-lg">
                  {/* Provider card */}
                  <button
                    onClick={() => setSelectedRole("provider")}
                    className={`p-6 border-2 rounded-2xl text-left transition-all ${
                      selectedRole === "provider"
                        ? "border-[#8C2C16] bg-[#FAF9F6] shadow-lg"
                        : "border-stone-200 bg-white hover:border-stone-300"
                    }`}
                  >
                    <div className="w-12 h-12 rounded-full bg-[#8C2C16]/10 flex items-center justify-center mb-4">
                      <Globe className="w-6 h-6 text-[#8C2C16]" />
                    </div>
                    <h3 className="font-serif text-lg font-bold text-[#1C1A17] mb-1">I own a website / API</h3>
                    <p className="text-xs text-stone-500 leading-relaxed">
                      Register your endpoints and earn SUI every time an AI agent accesses your data.
                    </p>
                    {selectedRole === "provider" && (
                      <div className="mt-3 flex items-center gap-1.5 text-[10px] font-mono text-[#8C2C16] font-bold uppercase">
                        <Check className="w-3.5 h-3.5" /> Selected
                      </div>
                    )}
                  </button>

                  {/* Consumer card */}
                  <button
                    onClick={() => setSelectedRole("consumer")}
                    className={`p-6 border-2 rounded-2xl text-left transition-all ${
                      selectedRole === "consumer"
                        ? "border-[#8C2C16] bg-[#FAF9F6] shadow-lg"
                        : "border-stone-200 bg-white hover:border-stone-300"
                    }`}
                  >
                    <div className="w-12 h-12 rounded-full bg-[#9F9FEF]/20 flex items-center justify-center mb-4">
                      <Cpu className="w-6 h-6 text-[#9F9FEF]" />
                    </div>
                    <h3 className="font-serif text-lg font-bold text-[#1C1A17] mb-1">I build AI agents</h3>
                    <p className="text-xs text-stone-500 leading-relaxed">
                      Browse the directory and pay per-second for verified, high-quality data streams.
                    </p>
                    {selectedRole === "consumer" && (
                      <div className="mt-3 flex items-center gap-1.5 text-[10px] font-mono text-[#8C2C16] font-bold uppercase">
                        <Check className="w-3.5 h-3.5" /> Selected
                      </div>
                    )}
                  </button>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => setStep(2)}
                    className="py-3 px-6 bg-transparent hover:bg-[#1C1A17]/5 text-[#1C1A17] border border-[#1C1A17]/30 rounded-full text-xs font-mono font-bold uppercase transition-all"
                  >
                    ← Back
                  </button>
                <button
                  onClick={() => {
                    localStorage.setItem("flowgate_onboarded", "true");
                    setStep(4);
                  }}
                  disabled={!selectedRole}
                  className="py-3 px-8 bg-[#1C1A17] hover:bg-[#2E2E38] disabled:opacity-40 text-white font-mono text-xs font-bold tracking-wider uppercase rounded-full flex items-center gap-2 shadow-lg transition-all"
                >
                  Continue
                  <ArrowRight className="w-4 h-4" />
                </button>
                </div>
              </motion.div>
            )}

            {/* STEP 4: Launch */}
            {step === 4 && (
              <motion.div
                key="step-4"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="flex flex-col items-center text-center gap-8"
              >
                <div className="w-20 h-20 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center">
                  <Sparkles className="w-10 h-10 text-emerald-700" />
                </div>

                <div className="flex flex-col gap-3">
                  <h2 className="font-serif text-3xl font-semibold tracking-tight text-[#1C1A17]">
                    You're all set!
                  </h2>
                  <p className="text-sm text-stone-600 max-w-md leading-relaxed">
                    {selectedRole === "provider"
                      ? "Head to the Register page to list your first endpoint, or browse the directory to see what's live."
                      : "Create your AI agent to start paying for and scraping data from registered FlowGate endpoints, or browse the directory first."
                    }
                  </p>
                </div>

                <div className="flex gap-3">
                  {selectedRole === "provider" ? (
                    <>
                      <button
                        onClick={() => navigate("/register")}
                        className="py-3.5 px-8 bg-[#8C2C16] hover:bg-[#A63A23] text-white font-mono text-xs font-bold tracking-wider uppercase rounded-full flex items-center gap-2 shadow-lg transition-all"
                      >
                        Register Endpoint
                        <ArrowRight className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => navigate("/premium")}
                        className="py-3.5 px-8 bg-transparent hover:bg-[#1C1A17]/5 text-[#1C1A17] border border-[#1C1A17]/30 rounded-full text-xs font-mono font-bold uppercase transition-all"
                      >
                        Premium Feeds
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => navigate("/agent/create")}
                        className="py-3.5 px-8 bg-[#1C1A17] hover:bg-[#2E2E38] text-white font-mono text-xs font-bold tracking-wider uppercase rounded-full flex items-center gap-2 shadow-lg transition-all"
                      >
                        Create AI Agent
                        <ArrowRight className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => navigate("/premium")}
                        className="py-3.5 px-8 bg-transparent hover:bg-[#1C1A17]/5 text-[#1C1A17] border border-[#1C1A17]/30 rounded-full text-xs font-mono font-bold uppercase transition-all"
                      >
                        Premium Feeds
                      </button>
                    </>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
