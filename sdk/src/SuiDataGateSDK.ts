import axios, { AxiosRequestConfig, AxiosResponse } from 'axios';
import { SuiClient } from '@mysten/sui/client';
import { Transaction } from '@mysten/sui/transactions';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { SealClient } from '@mysten/seal';
import { GeminiPaymentBrain } from './GeminiPaymentBrain';

export interface SuiDataGateConfig {
    privateKeyHex: string; // the 32-byte hex for Ed25519
    rpcUrl: string;
    apiKey?: string;
    agentId?: string;
}

export interface StreamMetadata {
    streamId: string;
    startTimeMs: number;
    ratePerSecond: number;
    amount: number;
}

export class SuiDataGateSDK {
    private client: SuiClient;
    private keypair: Ed25519Keypair;
    private seal: SealClient;
    private apiKey?: string;
    private agentId?: string;

    private activeStreams: Map<string, StreamMetadata> = new Map();
    public brain: GeminiPaymentBrain;
    private isPaused: boolean = false;

    // TODO: Load these from environment or config
    private PACKAGE_ID = process.env.SUI_DATA_GATE_PACKAGE_ID || "0xb05b3964df8b88a86cda6b192893399966014af9dd6fc6beb26f1343a0495495";
    private SUI_CLOCK = "0x6"; 
    
    constructor(config: SuiDataGateConfig) {
        this.client = new SuiClient({ url: config.rpcUrl });
        this.keypair = Ed25519Keypair.fromSecretKey(Buffer.from(config.privateKeyHex, 'hex'));
        
        // Initialize Seal Client (connecting to the Sui network)
        this.seal = new SealClient({
            client: this.client,
            // Assuming default server configs are injected or fetched for Testnet
        });

        this.apiKey = config.apiKey;
        this.agentId = config.agentId;
        this.brain = new GeminiPaymentBrain(process.env.GEMINI_API_KEY || "");
    }

    private metrics = {
        requestsSent: 0,
        signersTriggered: 0
    };

    public getMetrics() {
        return this.metrics;
    }

    public emergencyStop() {
        this.isPaused = true;
        console.warn("[SuiDataGateSDK] 🚨 EMERGENCY STOP ACTIVATED. All payments paused.");
    }

    public resume() {
        this.isPaused = false;
        console.log("[SuiDataGateSDK] ✅ System Resumed.");
    }

    public async makeRequest(url: string, options: AxiosRequestConfig = {}): Promise<{data: any, isDecrypted: boolean}> {
        if (this.isPaused) throw new Error("SDK is paused due to Emergency Stop.");
        this.metrics.requestsSent++;

        const host = new URL(url).host;
        const cachedStream = this.activeStreams.get(host);

        try {
            const headers = { ...options.headers };
            if (this.apiKey) {
                (headers as any)['x-api-key'] = this.apiKey;
            }

            if (cachedStream) {
                const remaining = this.calculateRemaining(cachedStream);
                const threshold = cachedStream.amount * 0.1; // 10% threshold
                if (remaining < threshold) {
                    console.log("[SuiDataGateSDK] Stream balance low. Triggering renewal...");
                    this.activeStreams.delete(host);
                } else {
                    (headers as any)['X-FlowPay-Stream-ID'] = cachedStream.streamId;
                }
            }

            const enhancedOptions = { ...options, headers };
            const response = await axios(url, enhancedOptions);
            
            // Check if response is Seal-encrypted
            if (response.headers['x-seal-encrypted'] === 'true') {
                return {
                    data: await this.decryptWithSeal(response.data, cachedStream!.streamId),
                    isDecrypted: true
                };
            }

            return { data: response.data, isDecrypted: false };

        } catch (error: any) {
            if (axios.isAxiosError(error) && error.response && error.response.status === 402) {
                if (cachedStream) this.activeStreams.delete(host);
                console.log("[SuiDataGateSDK] 402 Payment Required intercepted. Negotiating via PTB...");
                return this.handlePaymentRequired(url, options, error.response);
            }
            throw error;
        }
    }

    private async handlePaymentRequired(url: string, options: AxiosRequestConfig, response: AxiosResponse): Promise<{data: any, isDecrypted: boolean}> {
        this.metrics.signersTriggered++;

        const headers = response.headers;
        const rate = parseFloat(headers['x-flowpay-rate'] || "0.0001");
        const recipientAddress = headers['x-flowpay-recipient'];
        
        if (!recipientAddress) throw new Error("Missing X-FlowPay-Recipient in 402");

        const simN = (options.headers as any)?.['x-simulation-n'] ? parseInt((options.headers as any)['x-simulation-n']) : 10;
        const selectedMode = await this.brain.shouldStream(simN);

        if (selectedMode.mode === 'direct') {
            return this.performDirectPayment(url, options, recipientAddress, rate);
        }

        const durationSecs = 3600; // 1 hr top up
        const amountMist = Math.floor(rate * durationSecs * 1_000_000_000); // rate is in SUI, convert to MIST

        console.log(`[SuiDataGateSDK] Initiating Stream (PTB): ${rate * durationSecs} SUI for ${durationSecs}s`);
        
        const streamData = await this.createStream(recipientAddress, amountMist, Math.floor(rate * 1_000_000_000));
        
        const host = new URL(url).host;
        this.activeStreams.set(host, {
            streamId: streamData.streamId,
            startTimeMs: streamData.startTimeMs,
            ratePerSecond: Math.floor(rate * 1_000_000_000),
            amount: amountMist
        });

        // Retry Request
        console.log(`[SuiDataGateSDK] Stream ${streamData.streamId} created. Retrying...`);
        const retryOptions = {
            ...options,
            headers: {
                ...options.headers,
                'X-FlowPay-Stream-ID': streamData.streamId
            }
        };

        if (this.apiKey) (retryOptions.headers as any)['x-api-key'] = this.apiKey;

        const retryResponse = await axios(url, retryOptions);

        if (retryResponse.headers['x-seal-encrypted'] === 'true') {
            return {
                data: await this.decryptWithSeal(retryResponse.data, streamData.streamId),
                isDecrypted: true
            };
        }

        return { data: retryResponse.data, isDecrypted: false };
    }

    private async createStream(recipient: string, amountMist: number, ratePerSecondMist: number): Promise<{ streamId: string, startTimeMs: number }> {
        const tx = new Transaction();
        
        // 1. Split the exact amount of MIST from the Gas Coin
        const [coinToStream] = tx.splitCoins(tx.gas, [amountMist]);
        
        // 2. Call create_stream
        tx.moveCall({
            target: `${this.PACKAGE_ID}::stream::create_stream`,
            typeArguments: ['0x2::sui::SUI'],
            arguments: [
                coinToStream,
                tx.pure.address(recipient),
                tx.pure.u64(ratePerSecondMist),
                tx.pure.vector('u8', new TextEncoder().encode(JSON.stringify({ agentId: this.agentId }))),
                tx.object(this.SUI_CLOCK)
            ]
        });

        const result = await this.client.signAndExecuteTransaction({
            signer: this.keypair,
            transaction: tx,
            options: { showEvents: true, showEffects: true }
        });

        await this.client.waitForTransaction({ digest: result.digest });

        const createdEvent = result.events?.find(e => e.type.includes('StreamCreated'));
        if (!createdEvent) throw new Error("StreamCreated event not found in PTB execution");

        const parsedJson = createdEvent.parsedJson as any;
        return {
            streamId: parsedJson.stream_id,
            startTimeMs: Date.now() // Approximating start time for local cache
        };
    }

    private async decryptWithSeal(encryptedBlob: any, streamId: string): Promise<string> {
        console.log(`[SuiDataGateSDK] Triggering Seal Decryption Policy...`);
        
        const tx = new Transaction();
        tx.moveCall({
            target: `${this.PACKAGE_ID}::access_policy::seal_approve_stream`,
            arguments: [
                tx.pure.vector('u8', encryptedBlob.id),
                tx.object(streamId)
            ]
        });

        // Seal network will dry_run this transaction. If it aborts (e.g., balance is 0), decryption fails.
        const decryptedBytes = await this.seal.decrypt({
            encryptedData: encryptedBlob,
            transactionBlock: tx,
            sender: this.keypair.toSuiAddress()
        });

        return new TextDecoder().decode(decryptedBytes);
    }

    private async performDirectPayment(url: string, options: AxiosRequestConfig, recipient: string, rateSui: number): Promise<{data: any, isDecrypted: boolean}> {
        if (this.isPaused) throw new Error("SDK is paused.");

        const amountMist = Math.floor(rateSui * 1_000_000_000);
        console.log(`[SuiDataGateSDK] Fast-Path Direct Payment: ${rateSui} SUI`);

        const tx = new Transaction();
        const [coinToPay] = tx.splitCoins(tx.gas, [amountMist]);
        tx.transferObjects([coinToPay], tx.pure.address(recipient));

        const result = await this.client.signAndExecuteTransaction({
            signer: this.keypair,
            transaction: tx
        });
        await this.client.waitForTransaction({ digest: result.digest });

        const retryOptions = {
            ...options,
            headers: {
                ...options.headers,
                'X-FlowPay-Tx-Digest': result.digest
            }
        };

        if (this.apiKey) (retryOptions.headers as any)['x-api-key'] = this.apiKey;

        const response = await axios(url, retryOptions);
        return { data: response.data, isDecrypted: false }; // Direct payments usually don't use Seal in our architecture
    }

    public calculateClaimable(stream: StreamMetadata): number {
        const now = Date.now();
        const start = stream.startTimeMs;
        if (now <= start) return 0;
        const elapsedSecs = Math.floor((now - start) / 1000);
        return elapsedSecs * stream.ratePerSecond;
    }

    public calculateRemaining(stream: StreamMetadata): number {
        const claimable = this.calculateClaimable(stream);
        const remaining = stream.amount - claimable;
        return remaining > 0 ? remaining : 0;
    }
}
