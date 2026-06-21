import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Endpoint, EndpointType, API_BASE } from "../types";
import { useToast } from "../lib/toast-context";
import { dAppKit } from "../dapp-kit-config";
import { 
  ArrowLeft, 
  ChevronRight, 
  Database, 
  Cpu, 
  FileCode, 
  AlertTriangle, 
  Wallet, 
  Zap, 
  Check, 
  Copy
} from "lucide-react";

interface RegisterPageProps {
  onAddEndpoint: (endpoint: Endpoint) => void;
  walletAddress: string | null;
  isWalletConnected: boolean;
  suiBalance: number;
}

export default function RegisterPage({ onAddEndpoint, walletAddress, isWalletConnected, suiBalance }: RegisterPageProps) {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  
  // Endpoint details
  const [name, setName] = useState("");
  const [provider, setProvider] = useState("");
  const [type, setType] = useState<EndpointType>("stream");
  const [description, setDescription] = useState("");
  const [endpointUrl, setEndpointUrl] = useState("");
  const [endpointPath, setEndpointPath] = useState("");
  
  // Pricing model details
  const [price, setPrice] = useState("0.10");
  const [unit, setUnit] = useState("1K Ticks");
  const [apiKeyRequired, setApiKeyRequired] = useState(false);

  // Form errors
  const [error, setError] = useState("");
  const [isDeploying, setIsDeploying] = useState(false);
  const [deploymentSuccess, setDeploymentSuccess] = useState(false);
  const [registeredEndpoint, setRegisteredEndpoint] = useState("");
  const { addToast } = useToast();

  // Suggested units based on type
  React.useEffect(() => {
    if (type === "stream") setUnit("1K Ticks");
    else if (type === "compute") setUnit("inference step");
    else if (type === "api") setUnit("1M Tokens");
  }, [type]);

  const handleNextStep1 = () => {
    if (!name.trim()) {
      setError("Endpoint name or identifier is required");
      return;
    }
    if (!provider.trim()) {
      setError("Provider or publishing authority is required");
      return;
    }
    if (!description.trim()) {
      setError("A concise description is required");
      return;
    }
    if (!endpointUrl.trim()) {
      setError("Endpoint URL is required");
      return;
    }
    if (endpointPath.trim() && !endpointPath.trim().startsWith("/")) {
      setError("Endpoint path must start with / (e.g. /api/premium/my-feed/feed)");
      return;
    }
    setError("");
    setStep(2);
  };

  const handleNextStep2 = () => {
    const parsedPrice = parseFloat(price);
    if (isNaN(parsedPrice) || parsedPrice <= 0) {
      setError("Set a valid positive price in SUI");
      return;
    }
    setError("");
    setStep(3);
  };

  const handleDeploy = async () => {
    if (!isWalletConnected || !walletAddress) {
      setError("Connect your wallet before deploying");
      return;
    }
    setIsDeploying(true);
    let deploySucceeded = false;
    
    try {
      // Sign a message proving wallet ownership
      const finalEndpoint = endpointPath.trim() || `/api/premium/listed/${provider.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")}/feed`;
      const timestamp = Date.now();
      const signMessage = `FlowGate Provider Registration\nAddress: ${walletAddress}\nProvider: ${provider}\nEndpoint: ${finalEndpoint}\nTimestamp: ${timestamp}`;
      
      let signature: string | undefined;
      try {
        const result = await dAppKit.signPersonalMessage({
          message: new TextEncoder().encode(signMessage),
        });
        signature = result.signature;
        console.log('[register] Wallet signature obtained');
      } catch (signErr: any) {
        console.warn('[register] Wallet signing failed, proceeding without signature:', signErr?.message || signErr);
        addToast({ variant: 'warning', title: 'Signature skipped', message: 'Proceeding without wallet signature. Server will accept unsigned registration.' });
      }

      // POST to backend registry with signature
      const res = await fetch(`${API_BASE}/api/providers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          providerAddress: walletAddress,
          name: provider,
          websiteUrl: endpointUrl,
          endpoint: finalEndpoint,
          ratePerSecond: Math.floor(parseFloat(price) * 1_000_000_000),
          description,
          category: type === "stream" ? "Data Feed" : type === "compute" ? "Compute" : "API",
          signature,
          timestamp,
        }),
      });
      const listing = await res.json();
      if (!res.ok) {
        throw new Error(listing.error || listing.message || `Registration failed (${res.status})`);
      }
      const finalPath = listing.endpoint || endpointPath.trim() || `/api/premium/listed/${provider.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")}/feed`;
      setRegisteredEndpoint(finalPath);

      // Also add locally for immediate UI update
      const newEp: Endpoint = {
        id: listing.id || name.toLowerCase().replace(/_/g, "-") + "-" + Math.floor(Math.random() * 1000),
        name: name.toUpperCase().replace(/\s+/g, "_"),
        type,
        status: "active",
        price: parseFloat(price),
        unit,
        dataProvider: provider,
        latency: 0,
        throughput: "0 MB/s",
        rating: 0,
        uptime: 100,
        description,
        endpointUrl,
        inputs: [],
        outputs: [],
        apiKeyRequired,
        totalRequests: 0,
        activeConsumers: 0,
        gasSui: 0
      };

      onAddEndpoint(newEp);
      addToast({ variant: "success", title: "Endpoint registered", message: `Gateway path: ${finalPath}` });
      deploySucceeded = true;
    } catch (err: any) {
      setError(err.message || 'Registration failed. Please try again.');
      addToast({ variant: "error", title: "Registration failed", message: err.message || 'Could not register endpoint.' });
    } finally {
      setIsDeploying(false);
      setDeploymentSuccess(deploySucceeded);
    }
  };

  const truncatedAddress = walletAddress
    ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`
    : "Not connected";

  return (
    <div className="pb-16 max-w-4xl">
      
      {/* Breadcrumb line */}
      <div className="flex items-center gap-2 text-xs font-sans text-stone-500 mb-6">
        <span onClick={() => navigate("/")} className="hover:text-black cursor-pointer transition-colors font-semibold">Flowgate</span>
        <span>/</span>
        <span onClick={() => navigate("/premium")} className="hover:text-black cursor-pointer transition-colors">Premium Feeds</span>
        <span>/</span>
        <span className="text-stone-400">Register</span>
      </div>

      {/* Flag Header */}
      <div className="flex items-center gap-4 mb-8 border-b border-stone-300 pb-6">
        <button 
          onClick={() => {
            if (step > 1 && !deploymentSuccess) setStep(step - 1);
            else navigate("/premium");
          }} 
          className="p-2.5 border border-stone-300 bg-white hover:bg-stone-50 hover:border-[#1C1A17] transition-all rounded-full flex items-center justify-center shadow-sm"
        >
          <ArrowLeft className="w-4 h-4 text-stone-700" />
        </button>
        <div>
          <h1 className="font-sans text-3xl font-bold text-[#1C1A17]">
            Register a New Endpoint
          </h1>
          <p className="text-sm font-sans text-stone-500 mt-0.5">
            Add your data source or API to the FlowGate directory.
          </p>
        </div>
      </div>

      {/* Stepper Wizard Bar */}
      <div className="grid grid-cols-3 gap-3 mb-10">
        {[{ id: 1, label: "Details" },
          { id: 2, label: "Pricing" },
          { id: 3, label: "Deploy" }
        ].map((s) => (
          <div key={s.id} className="flex flex-col gap-1.5">
            <div className={`h-1 transition-all duration-300 ${
              step >= s.id ? "bg-[#8C2C16]" : "bg-stone-200"
            }`} />
            <span className={`text-xs font-sans ${
              step >= s.id ? "text-stone-700 font-bold" : "text-stone-400"
            }`}>{s.label}</span>
          </div>
        ))}
      </div>

      {/* Error notification banner */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-300 rounded-xl gap-3 flex items-start text-sm font-sans text-red-900">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-red-700" />
          <div className="flex flex-col">
            <span className="font-bold">Validation Error</span>
            <p className="text-[11px] mt-0.5 leading-normal text-red-700">{error}</p>
          </div>
        </div>
      )}

      {/* Wallet gate */}
      {!isWalletConnected && step === 3 && (
        <div className="mb-6 p-5 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-3">
          <Wallet className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
          <div className="flex flex-col gap-1">
            <span className="text-sm font-sans text-amber-900 font-bold">Wallet not connected</span>
            <p className="text-xs font-sans text-amber-800">Connect your Sui wallet in the sidebar to deploy your endpoint.</p>
          </div>
        </div>
      )}

      {/* Main Form container */}
      <div className="border border-stone-200 bg-white p-8 shadow-sm">
        
        {/* STEP 1: Metadata inputs */}
        {step === 1 && !deploymentSuccess && (
          <div className="flex flex-col gap-6">
            <div className="border-b border-stone-150 pb-3">
              <h2 className="font-sans font-semibold text-lg text-[#1C1A17]">Endpoint Details</h2>
              <p className="text-sm font-sans text-stone-500">Basic information about your endpoint</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-sans text-stone-500 font-medium">Endpoint Name *</label>
                <input 
                  type="text" 
                  placeholder="e.g. Market Data Feed"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="bg-white border border-stone-300 focus:border-stone-800 outline-none px-3.5 py-2.5 text-sm font-sans text-[#1C1A17] rounded-full"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-sans text-stone-500 font-medium">Provider Name *</label>
                <input 
                  type="text" 
                  placeholder="e.g. Quantic Labs"
                  value={provider}
                  onChange={(e) => setProvider(e.target.value)}
                  className="bg-white border border-stone-300 focus:border-stone-800 outline-none px-3.5 py-2.5 text-sm font-sans text-[#1C1A17] rounded-full"
                />
              </div>
            </div>

            {/* Node category items selector */}
            <div className="flex flex-col gap-3">
              <label className="text-xs font-sans text-stone-500 font-medium">Category</label>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[
                  { id: "stream", label: "Data Feed", desc: "Continuous real-time data streams", icon: <Database /> },
                  { id: "compute", label: "Compute", desc: "GPU or LLM inference endpoints", icon: <Cpu /> },
                  { id: "api", label: "API", desc: "REST or gRPC client endpoints", icon: <FileCode /> }
                ].map((cat) => (
                  <div 
                    key={cat.id}
                    onClick={() => setType(cat.id as EndpointType)}
                    className={`p-4 border text-left cursor-pointer transition-all ${
                      type === cat.id 
                        ? "bg-[#FCFBF9] border-stone-800 text-[#1C1A17]" 
                        : "bg-white border-stone-200 text-stone-500 hover:border-stone-350 hover:text-black"
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`p-1.5 ${type === cat.id ? "bg-stone-200 text-black" : "bg-stone-100 text-stone-400"}`}>
                        {React.cloneElement(cat.icon, { className: "w-4 h-4" })}
                      </span>
                      <span className="text-xs font-sans font-semibold tracking-wide">{cat.label}</span>
                    </div>
                    <p className="text-xs font-sans opacity-80 leading-snug">{cat.desc}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-sans text-stone-500 font-medium">Description *</label>
              <textarea 
                rows={3}
                placeholder="Describe what this endpoint provides..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="bg-white border border-stone-300 focus:border-stone-800 outline-none px-3.5 py-2.5 text-sm font-sans text-[#1C1A17] rounded-xl resize-none leading-relaxed"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-sans text-stone-500 font-medium">Endpoint URL *</label>
              <input 
                type="text" 
                placeholder="e.g. https://api.example.com/v1/data"
                value={endpointUrl}
                onChange={(e) => setEndpointUrl(e.target.value)}
                className="bg-white border border-stone-300 focus:border-stone-800 outline-none px-3.5 py-2.5 text-sm font-sans text-[#1C1A17] rounded-full"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-sans text-stone-500 font-medium">Gateway Path</label>
              <input 
                type="text" 
                placeholder="e.g. /api/premium/my-feed/feed (auto-generated if empty)"
                value={endpointPath}
                onChange={(e) => setEndpointPath(e.target.value)}
                className="bg-white border border-stone-300 focus:border-stone-800 outline-none px-3.5 py-2.5 text-sm font-sans text-[#1C1A17] rounded-full"
              />
              <p className="text-xs font-sans text-stone-400">The path agents will hit to access your data. Leave empty for auto-generated path.</p>
            </div>

            <div className="flex justify-end pt-4 border-t border-stone-100">
              <button 
                onClick={handleNextStep1}
                className="px-5 py-3 bg-[#1C1A17] hover:bg-[#2E2E38] text-[#FAF9F5] text-sm font-sans font-bold rounded-full transition-all flex items-center gap-2 shadow-md hover:shadow-lg active:scale-95 cursor-pointer"
              >
                Next: Set Pricing
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 2: Pricing configuration Details */}
        {step === 2 && !deploymentSuccess && (
          <div className="flex flex-col gap-6">
            <div className="border-b border-stone-150 pb-3">
              <h2 className="font-sans font-semibold text-lg text-[#1C1A17]">Set Pricing</h2>
              <p className="text-sm font-sans text-stone-500">Choose how consumers are charged</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
              <div className="flex flex-col gap-5">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-sans text-stone-500 font-medium">Price per unit (SUI) *</label>
                  <div className="relative">
                    <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-sans text-stone-500 font-bold">SUI</div>
                    <input 
                      type="number" 
                      step="0.01"
                      placeholder="0.10"
                      value={price}
                      onChange={(e) => setPrice(e.target.value)}
                      className="w-full bg-white border border-stone-300 focus:border-stone-800 outline-none pl-12 pr-4 py-2.5 text-sm font-sans text-[#1C1A17] font-bold rounded-full"
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-sans text-stone-500 font-medium">Unit *</label>
                  <input 
                    type="text" 
                    placeholder="e.g. per second, per request"
                    value={unit}
                    onChange={(e) => setUnit(e.target.value)}
                    className="bg-white border border-stone-300 focus:border-stone-800 outline-none px-3.5 py-2.5 text-sm font-sans text-[#1C1A17] rounded-full"
                  />
                  <p className="text-xs font-sans text-stone-400">What consumers are charged per</p>
                </div>
              </div>

              <div className="flex flex-col gap-4 p-5 bg-[#FAF9F5] border border-stone-200">
                <div className="flex items-center justify-between mb-2 pb-2 border-b border-stone-200">
                  <span className="text-xs font-sans text-stone-500 font-medium">Access Settings</span>
                  <span className="text-xs font-sans px-2 py-0.5 bg-stone-200 text-stone-700 font-bold rounded-full">Auth</span>
                </div>

                <div className="flex items-start gap-3">
                  <input 
                    type="checkbox" 
                    id="api-key"
                    checked={apiKeyRequired}
                    onChange={(e) => setApiKeyRequired(e.target.checked)}
                    className="mt-1 accent-stone-800 w-4 h-4 border-stone-300"
                  />
                  <label htmlFor="api-key" className="text-sm font-sans text-stone-600 leading-relaxed selection:bg-transparent">
                    <span className="font-bold text-[#1C1A17] block text-sm">Require API key</span>
                    Requires consumers to provide an API key before accessing your endpoint.
                  </label>
                </div>
              </div>
            </div>

            <div className="flex justify-between pt-6 border-t border-stone-100 mt-4">
              <button 
                onClick={() => setStep(1)}
                className="px-5 py-2.5 bg-transparent hover:bg-[#1C1A17]/5 text-[#1C1A17] border border-[#1C1A17]/30 rounded-full text-sm font-sans font-bold transition-all cursor-pointer"
              >
                Back
              </button>
              <button 
                onClick={handleNextStep2}
                className="px-5 py-3 bg-[#1C1A17] hover:bg-[#2E2E38] text-[#FAF9F5] text-sm font-sans font-bold rounded-full transition-all flex items-center gap-2 shadow-md hover:shadow-lg active:scale-95 cursor-pointer"
              >
                Next: Deploy
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: Wallet Connect & Deploy Details */}
        {step === 3 && !deploymentSuccess && (
          <div className="flex flex-col gap-6">
            <div className="border-b border-stone-150 pb-3">
              <h2 className="font-sans font-semibold text-lg text-[#1C1A17]">Review & Deploy</h2>
              <p className="text-sm font-sans text-stone-500">Sign and publish to the Sui network</p>
            </div>

            <div className="flex flex-col gap-5">
              
              {/* Wallet info from connected wallet */}
              <div className="p-6 bg-[#FAF9F5] border border-stone-250">
                <div className="flex items-center justify-between border-b border-stone-200 pb-3 mb-4">
                  <div className="flex items-center gap-3">
                    <Wallet className="w-5 h-5 text-[#8C2C16]" />
                    <div>
                      <span className="text-xs font-sans text-stone-500 block font-medium">Wallet Address</span>
                      <span className="text-sm font-sans text-[#1C1A17] font-bold select-all">{truncatedAddress}</span>
                    </div>
                  </div>
                  <span className="text-xs font-sans px-2 py-0.5 border border-[#8C2C16]/20 bg-[#8C2C16]/5 text-[#8C2C16] font-bold rounded-full">Mainnet</span>
                </div>

                <div className="flex items-center justify-between text-sm font-sans">
                  <span className="text-stone-500 font-medium">Balance:</span>
                  <span className="text-base text-stone-800 font-bold">{suiBalance.toFixed(2)} SUI</span>
                </div>
              </div>

              <div className="p-4 bg-amber-50 border border-amber-200 text-sm font-sans text-amber-900 flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 shrink-0 text-amber-700 mt-0.5" />
                <p className="leading-relaxed text-xs">
                  Deploying registers your endpoint in the FlowGate directory. No gas fees for registration — wallet signature verification is optional.
                </p>
              </div>
            </div>

            <div className="flex justify-between pt-6 border-t border-stone-100 mt-4">
              <button 
                onClick={() => setStep(2)}
                className="px-5 py-2.5 bg-transparent hover:bg-[#1C1A17]/5 text-[#1C1A17] border border-[#1C1A17]/30 rounded-full text-sm font-sans font-bold transition-all cursor-pointer"
                disabled={isDeploying}
              >
                Back
              </button>
              <button 
                onClick={handleDeploy}
                disabled={isDeploying || !isWalletConnected}
                className="px-6 py-3.5 bg-[#8C2C16] hover:bg-[#A63A23] disabled:opacity-40 disabled:cursor-not-allowed text-sm font-sans font-bold text-white rounded-full transition-all flex items-center justify-center gap-2 shadow-md hover:shadow-lg active:scale-95 cursor-pointer"
              >
                {isDeploying ? (
                  <>
                    <span className="w-3.5 h-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                    Publishing...
                  </>
                ) : (
                  <>
                    Sign & Publish
                    <Zap className="w-4 h-4 text-white fill-current shrink-0" />
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* SUCCESS VIEW SCREEN */}
        {deploymentSuccess && (
          <div className="flex flex-col items-center text-center gap-6 py-6">
            <div className="w-16 h-16 rounded-full bg-emerald-50 border border-emerald-300 flex items-center justify-center relative">
              <Check className="w-6 h-6 text-emerald-800" />
            </div>

            <div>
              <h2 className="font-sans font-bold text-3xl text-[#1C1A17]">Registration Complete</h2>
              <p className="text-sm font-sans text-stone-500 mt-1.5">Your endpoint is now live on FlowGate</p>
            </div>

            <div className="max-w-md w-full bg-[#FAF9F5] border border-stone-200 p-5 text-sm font-sans text-left flex flex-col gap-2.5 my-2 rounded-xl">
              <div className="flex justify-between text-stone-500">
                <span>Endpoint name:</span>
                <span className="text-stone-900 font-bold">{name}</span>
              </div>
              <div className="flex justify-between text-stone-500">
                <span>Price:</span>
                <span className="text-stone-800 font-bold">{parseFloat(price).toFixed(4)} SUI per {unit}</span>
              </div>
              <div className="flex justify-between text-stone-500">
                <span>Provider:</span>
                <span className="text-stone-700 font-bold">{truncatedAddress}</span>
              </div>
              {registeredEndpoint && (
                <div className="flex items-center justify-between text-stone-500 pt-2 border-t border-stone-200">
                  <span>Gateway path:</span>
                  <div className="flex items-center gap-1.5">
                    <code className="text-xs font-mono text-[#8C2C16] bg-[#8C2C16]/5 px-2 py-0.5 rounded select-all">{registeredEndpoint}</code>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(registeredEndpoint);
                        addToast({ variant: "success", title: "Copied to clipboard" });
                      }}
                      className="p-1 text-stone-400 hover:text-stone-700 transition-colors cursor-pointer"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="flex flex-col sm:flex-row gap-3.5 w-full justify-center max-w-md mt-4">
              <button 
                onClick={() => navigate("/premium")}
                className="w-full py-3.5 bg-transparent hover:bg-[#1C1A17]/5 text-[#1C1A17] border border-[#1C1A17]/30 rounded-full text-sm font-sans font-bold transition-all cursor-pointer"
              >
                Back to Premium Feeds
              </button>
              <button 
                onClick={() => navigate("/provider")}
                className="w-full py-3.5 bg-[#1C1A17] hover:bg-[#2E2E38] text-[#FAF9F5] text-sm font-sans font-bold rounded-full transition-all flex items-center justify-center gap-2 shadow-md hover:shadow-lg active:scale-95 cursor-pointer"
              >
                Open Provider Dashboard
              </button>
            </div>

          </div>
        )}

      </div>

    </div>
  );
}
