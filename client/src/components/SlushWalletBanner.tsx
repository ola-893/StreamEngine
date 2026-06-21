import React from "react";
import { Download, Wallet, ExternalLink } from "lucide-react";

interface SlushWalletBannerProps {
  variant?: "inline" | "card" | "compact";
  className?: string;
}

export default function SlushWalletBanner({
  variant = "inline",
  className = "",
}: SlushWalletBannerProps) {
  if (variant === "compact") {
    return (
      <div
        className={`flex items-center gap-2 px-3 py-2 bg-[#FAF9F6] border border-stone-200/80 rounded-xl ${className}`}
      >
        <div className="w-6 h-6 rounded-full bg-gradient-to-br from-[#6FBCF0] to-[#4A90D9] flex items-center justify-center shrink-0">
          <Wallet className="w-3 h-3 text-white" />
        </div>
        <p className="text-[11px] font-sans text-stone-600 leading-tight">
          Connect with{" "}
          <a
            href="https://chrome.google.com/webstore/search/slush%20wallet"
            target="_blank"
            rel="noopener noreferrer"
            className="font-bold text-[#4A90D9] hover:underline inline-flex items-center gap-0.5"
          >
            Slush Wallet
            <ExternalLink className="w-2.5 h-2.5" />
          </a>{" "}
          — the official Sui wallet for FlowGate.
        </p>
      </div>
    );
  }

  if (variant === "card") {
    return (
      <div
        className={`p-4 bg-gradient-to-r from-[#F0F7FE] to-[#FAF9F6] border border-[#6FBCF0]/20 rounded-2xl ${className}`}
      >
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#6FBCF0] to-[#4A90D9] flex items-center justify-center shrink-0 shadow-sm">
            <Wallet className="w-5 h-5 text-white" />
          </div>
          <div className="flex flex-col gap-1.5">
            <h4 className="font-sans text-sm font-bold text-[#1C1A17]">
              Connect with Slush Wallet
            </h4>
            <p className="text-[11px] font-sans text-stone-500 leading-relaxed">
              FlowGate uses the{" "}
              <span className="font-semibold text-[#1C1A17]">
                Slush Wallet
              </span>{" "}
              (formerly Sui Wallet) to connect. It's the official wallet for the
              Sui blockchain — secure, fast, and works as a browser extension or
              mobile app.
            </p>
            <a
              href="https://slush.app"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 mt-1 px-3 py-1.5 bg-[#4A90D9] hover:bg-[#3A7BC8] text-white rounded-full text-[10px] font-mono font-bold uppercase tracking-wider transition-all w-fit"
            >
              <Download className="w-3 h-3" />
              Get Slush Wallet
            </a>
          </div>
        </div>
      </div>
    );
  }

  // Default inline variant
  return (
    <div
      className={`flex items-center gap-2.5 p-3 bg-[#F0F7FE]/60 border border-[#6FBCF0]/15 rounded-xl ${className}`}
    >
      <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#6FBCF0] to-[#4A90D9] flex items-center justify-center shrink-0">
        <Wallet className="w-3.5 h-3.5 text-white" />
      </div>
      <div className="flex flex-col gap-0.5">
        <p className="text-[11px] font-sans text-stone-600 leading-tight">
          Connect using{" "}
          <a
            href="https://slush.app"
            target="_blank"
            rel="noopener noreferrer"
            className="font-bold text-[#4A90D9] hover:underline inline-flex items-center gap-0.5"
          >
            Slush Wallet
            <ExternalLink className="w-2.5 h-2.5" />
          </a>{" "}
          — the official Sui wallet.
        </p>
      </div>
    </div>
  );
}
