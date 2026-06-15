import React, { useState } from "react";
import { useNavigate } from "react-router-dom";

import { 
  Terminal, 
  Copy, 
  Check, 
  Send
} from "lucide-react";

interface DeveloperPageProps {}

export default function DeveloperPage(_props: DeveloperPageProps) {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<"js" | "python">("js");
  const [explorerEndpoint, setExplorerEndpoint] = useState("GET /v1/directory/active");
  const [isLoading, setIsLoading] = useState(false);
  const [explorerResponse, setExplorerResponse] = useState<string>("");
  const [copiedAddress, setCopiedAddress] = useState<string | null>(null);

  const handleCopy = (address: string, id: string) => {
    navigator.clipboard.writeText(address);
    setCopiedAddress(id);
    setTimeout(() => setCopiedAddress(null), 2000);
  };

  const handleSendRequest = () => {
    setIsLoading(true);
    setExplorerResponse("");
    
    setTimeout(() => {
      let responseObj = {};
      
      if (explorerEndpoint === "GET /v1/directory/active") {
        responseObj = {
          status: "SUCCESS_200",
          timestamp_sui: Math.floor(Date.now() / 1000),
          endpoints_found: 4,
          data: [
            { id: "quantic-ticker-v4", status: "active", price_sui: 0.12 },
            { id: "synth-text-corpus", status: "active", price_sui: 1.50 },
            { id: "orbit-lidar-v2", status: "active", price_sui: 2.10 },
            { id: "valerian-9-compute", status: "active", price_sui: 0.08 }
          ]
        };
      } else if (explorerEndpoint === "POST /v1/escrow/deposit") {
        responseObj = {
          status: "CREATED_201",
          transaction_hash: "sui_tx_28fbc01da9e20a44fc99db0211ff4de29da9f",
          sender: "sui:addr_8ab9c02ff6099a0c102c9de",
          escrow_pool_target: "sui:escrow_aggregator_v1",
          amount_deposited_sui: 10.0,
          gas_consumed_sui: 0.0015
        };
      } else {
        responseObj = {
          status: "SUCCESS_200",
          node_ref: "sui:node_addr_901c8af01cb299fa21",
          uptime_hours_24: 24.0,
          active_connections: 14,
          telemetry_system: {
            vram_utilization: "78.4%",
            cpu_utilization: "42.0%",
            packet_loss_ratio: 0.0
          }
        };
      }

      setExplorerResponse(JSON.stringify(responseObj, null, 2));
      setIsLoading(false);
    }, 1200);
  };

  return (
    <div className="pb-16">
      
      {/* Breadcrumb line */}
      <div className="flex items-center gap-2 text-xs font-sans text-stone-500 mb-6">
        <span onClick={() => navigate("/")} className="hover:text-black cursor-pointer transition-colors font-semibold">Flowgate</span>
        <span>/</span>
        <span className="text-stone-400">Developer Tools</span>
      </div>

      {/* Flag Header */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 mb-10 border-b border-stone-300 pb-6">
        <div>
          <h1 className="font-sans text-3xl font-bold text-[#1C1A17]">
            Developer Tools
          </h1>
          <p className="text-sm text-stone-500 mt-0.5">
            SDK quickstarts, API explorer, and smart contract addresses.
          </p>
        </div>

        <button 
          onClick={() => navigate("/terminal")}
          className="px-5 py-2.5 border border-[#1C1A17]/35 bg-white text-[#1C1A17] font-sans text-sm font-bold rounded-full transition-all flex items-center gap-2 shrink-0 shadow-sm hover:shadow-md hover:bg-stone-50/70"
        >
          <Terminal className="w-4 h-4 text-[#8C2C16] animate-pulse" />
          Interactive Terminal
        </button>
      </div>

      {/* CORE GRID LAYOUT: QUICKSTART & EXPLORER (Left) + CORE ADDRESSES (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Quickstart and SDK query explorer */}
        <div className="lg:col-span-8 flex flex-col gap-6">
          
          <div className="border border-stone-200 bg-white p-6 shadow-sm flex flex-col gap-5">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-stone-150 pb-3">
              <div>
                <h2 className="font-sans font-semibold text-[#1C1A17] text-lg">SDK Quickstart</h2>
                <p className="text-sm text-stone-500">Get started with the Flowgate SDK</p>
              </div>

              {/* Tab togglers */}
              <div className="flex items-center gap-1 bg-stone-100 border border-stone-200 p-1 rounded-full">
                <button 
                  onClick={() => setActiveTab("js")}
                  className={`px-3 py-1.5 font-sans text-xs transition-all rounded-full cursor-pointer ${
                    activeTab === "js" ? "bg-white text-black font-bold border border-stone-300 shadow-sm" : "text-stone-500 hover:text-black"
                  }`}
                >
                  JavaScript
                </button>
                <button 
                  onClick={() => setActiveTab("python")}
                  className={`px-3 py-1.5 font-sans text-xs transition-all rounded-full cursor-pointer ${
                    activeTab === "python" ? "bg-white text-black font-bold border border-stone-300 shadow-sm" : "text-stone-500 hover:text-black"
                  }`}
                >
                  Python
                </button>
              </div>
            </div>

            {activeTab === "js" ? (
              <div className="flex flex-col gap-3">
                <div className="bg-stone-50 p-3.5 border border-stone-150 text-xs font-mono text-stone-800 relative">
                  <span className="text-xs text-stone-400 block mb-1 font-medium">Install:</span>
                  <code className="font-bold">npm install @flowgate/sdk</code>
                </div>

                <pre className="p-4 overflow-x-auto text-[11px] font-mono text-stone-850 bg-stone-50/50 border border-stone-200 max-h-[220px] custom-scrollbar leading-relaxed">
                  {`import { Flowgate } from "@flowgate/sdk";

// Initialize routing wallet
const client = new Flowgate({
  walletSeed: process.env.SUI_PRIVATE_KEY
});

// Auto-stream transaction escrow clearance per chunk
const connection = await client.openChannel({
  endpointId: "quantic-ticker-v4",
  maxCostSui: 10.0
});

connection.on("chunk", (chunk) => {
  console.log("Inbound telemetry tick:", chunk.data);
});`}
                </pre>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                <div className="bg-stone-50 p-3.5 border border-stone-150 text-xs font-mono text-stone-800 relative">
                  <span className="text-xs text-stone-400 block mb-1 font-medium">Install:</span>
                  <code className="font-bold">pip install flowgate-sdk</code>
                </div>

                <pre className="p-4 overflow-x-auto text-[11px] font-mono text-stone-850 bg-stone-50/50 border border-stone-200 max-h-[220px] custom-scrollbar leading-relaxed">
                  {`from flowgate import FlowgateClient

# Initialize routing wallet connection
client = FlowgateClient(
    private_key=os.getenv("SUI_PRIVATE_KEY")
)

# Open billing telemetry gateway
session = client.open_channel(
    endpoint_id="quantic-ticker-v4",
    max_cost_sui=10.0
)

# Loop and pull direct elements asynchronously
for data_chunk in session.pull_data():
    print(f"Inbound telemetry tick: {data_chunk.data}")`}
                </pre>
              </div>
            )}
          </div>

          {/* INTERACTIVE API EXPLORER */}
          <div className="border border-stone-200 bg-white p-6 shadow-sm flex flex-col gap-5">
            <div className="border-b border-stone-150 pb-3">
              <h2 className="font-sans font-semibold text-[#1C1A17] text-lg">API Explorer</h2>
              <p className="text-sm text-stone-500">Test API endpoints and view responses</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
              
              <div className="md:col-span-8 flex flex-col gap-1.5">
                <label className="text-xs font-sans text-stone-400 font-medium">Endpoint</label>
                <select
                  value={explorerEndpoint}
                  onChange={(e) => setExplorerEndpoint(e.target.value)}
                  className="w-full bg-white border border-stone-300 px-3.5 py-2.5 text-sm font-sans outline-none text-[#1C1A17] hover:border-black rounded-full cursor-pointer"
                >
                  <option value="GET /v1/directory/active">GET /v1/directory/active</option>
                  <option value="POST /v1/escrow/deposit">POST /v1/escrow/deposit</option>
                  <option value="GET /v1/node/telemetry">GET /v1/node/telemetry</option>
                </select>
              </div>

              <div className="md:col-span-4 flex items-end">
                <button 
                  onClick={handleSendRequest}
                  disabled={isLoading}
                  className="w-full py-3 bg-[#1C1A17] hover:bg-[#2E2E38] disabled:opacity-50 text-[#FAF9F5] font-sans text-sm font-bold rounded-full transition-all flex items-center justify-center gap-2 shrink-0 shadow-md hover:shadow-lg active:scale-95"
                >
                  {isLoading ? (
                    <>
                      <span className="w-3.5 h-3.5 border-2 border-white/25 border-t-white rounded-full animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      Send Request
                    </>
                  )}
                </button>
              </div>

            </div>

            {explorerResponse && (
              <div className="border border-stone-250 bg-[#FAF9F5] p-5 relative">
                <span className="absolute top-3 right-4 text-xs font-sans text-stone-400 font-medium">Response</span>
                <pre className="text-[11px] font-mono text-stone-800 leading-normal overflow-x-auto max-h-[160px] custom-scrollbar">
                  <code>{explorerResponse}</code>
                </pre>
              </div>
            )}
          </div>

        </div>

        {/* Core Addresses Registry & Smart Contract Details (Right) */}
        <div className="lg:col-span-4 flex flex-col gap-6">
          
          <div className="border border-stone-200 bg-white p-5 shadow-sm flex flex-col gap-5">
            <div>
              <h3 className="font-sans font-semibold text-[#1C1A17] text-lg">Smart Contracts</h3>
              <p className="text-sm text-stone-500">Sui mainnet contract addresses</p>
            </div>

            <div className="flex flex-col gap-4">
              {[
                { id: "reg", label: "ESCROW CONTRACT COORDINATES", addr: "sui:escrow_reg_0x42fbc99d...b02ce" },
                { id: "dir", label: "DIRECTORY REGISTRY METADATA", addr: "sui:dir_obj_0x1da9e20a...4de2e" },
                { id: "gov", label: "PROX MULTI-SIG AGGREGATE", addr: "sui:gov_sig_0x8ab9c02f...9a0c1" },
                { id: "val", label: "DIAGNOSTIC TELEM VALIDATOR", addr: "sui:val_gate_0x518293bc...901c8" }
              ].map((item) => {
                const isCopied = copiedAddress === item.id;
                return (
                  <div key={item.id} className="p-3 bg-[#FAF9F5] border border-stone-200 flex flex-col gap-1">
                    <span className="text-xs font-sans text-stone-400 font-medium">{item.label}</span>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-sans text-stone-800 select-all truncate max-w-[170px]" title={item.addr}>
                        {item.addr}
                      </span>

                      <button 
                        onClick={() => handleCopy(item.addr, item.id)}
                        className="hover:text-black text-stone-400 transition-colors p-1 hover:bg-stone-100 shrink-0 cursor-pointer"
                        title="Copy register address"
                      >
                        {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-800 font-bold" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-2 text-xs font-sans text-stone-400 leading-relaxed border-t border-stone-200 pt-3">
              Endpoints register persistent channels via deploy protocols. Micropayments are secured on Sui via gas fractions.
            </div>
          </div>

        </div>

      </div>

    </div>
  );
}
