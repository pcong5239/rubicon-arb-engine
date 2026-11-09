import {
  submitRomeTx,
  submitRomeTxV1,
  syntheticAddress,
  buildCreatePdaCall,
  isSyntheticProvisioned,
  toLaneSigner,
  type SignerLike,
} from "@rome-protocol/sdk";
import { createPublicClient, http, encodeFunctionData, parseAbi, toHex, type Hex } from "viem";
import { Connection, PublicKey } from "@solana/web3.js";
import generatedConfig from "../data/config.generated.json";

export const ARB_EXECUTOR_ABI = parseAbi([
  "function recordSimulation(bytes32 routeId, string pairSymbol, address evmDexPool, bytes32 solanaProgramId, uint256 amountIn, uint256 expectedAmountOut, uint256 minProfitBps, uint256 estimatedSolanaCu) returns (uint256 simId, uint256 expectedProfitBps, bool profitable)",
  "function executeAtomicArbitrage(bytes32 routeId, string pairSymbol, address evmDexPool, bytes32 solanaProgramId, uint256 amountIn, uint256 simulatedLegOut, uint256 minProfitBps, bytes cpiInstructionData) returns (uint256 execId, uint256 netProfit, uint256 profitBps)",
  "function claimProfit() returns (uint256 claimedAmount)",
  "function getEngineSummary() view returns (uint256 totalSimulations, uint256 totalExecutions, uint256 totalVolume, uint256 totalProfitGenerated, uint256 totalProfitClaimed, bytes32 contractExternalPda)",
  "function searcherStats(address searcher) view returns (uint256 totalSimulations, uint256 totalExecutions, uint256 totalVolume, uint256 accruedProfit, uint256 claimedProfit, uint256 lastActiveTimestamp)",
]);

const HELPER_PRECOMPILE = "0xff00000000000000000000000000000000000009" as const;
const GRANT_ABI = parseAbi(["function approve_spl(address spender, uint64 amount, bytes32 mint)"]);
const WRAPPER_ABI = parseAbi([
  "function isEnabled(address user) view returns (bool)",
  "function mint_id() view returns (bytes32)",
]);
const U64_MAX = 2n ** 64n - 1n;

export const ROME_CONFIG = {
  chainId: generatedConfig.chain.chainId,
  chainName: generatedConfig.chain.name,
  rpcUrl: generatedConfig.chain.rpcUrl,
  explorerUrl: generatedConfig.chain.explorerUrl,
  programId: generatedConfig.chain.romeEvmProgramId,
  solanaRpc: generatedConfig.chain.solana.rpc,
  solanaCluster: generatedConfig.chain.solana.cluster,
  contractAddress: (generatedConfig.deployment?.hadrian?.contractAddress ??
    "0x6e2d98772a8a6444ff63a8b0d1b4511ebcd2ca9f") as Hex,
  wusdc: (generatedConfig.deployment?.hadrian?.wusdc ??
    "0xbce339ba4c3a8de3bb8af1c5539e6ac11da3112d") as Hex,
};

export function getPublicClient() {
  return createPublicClient({ transport: http(ROME_CONFIG.rpcUrl) });
}

export async function fetchLiveEngineSummary() {
  const pub = getPublicClient();
  const res = (await pub.readContract({
    address: ROME_CONFIG.contractAddress,
    abi: ARB_EXECUTOR_ABI,
    functionName: "getEngineSummary",
  })) as [bigint, bigint, bigint, bigint, bigint, Hex];

  return {
    totalSimulations: Number(res[0]),
    totalExecutions: Number(res[1]),
    totalVolumeUsdc: Number(res[2]) / 1e6,
    totalProfitGeneratedUsdc: Number(res[3]) / 1e6,
    totalProfitClaimedUsdc: Number(res[4]) / 1e6,
    contractExternalPda: res[5],
  };
}

export async function fetchSearcherStats(addr: Hex) {
  const pub = getPublicClient();
  const res = (await pub.readContract({
    address: ROME_CONFIG.contractAddress,
    abi: ARB_EXECUTOR_ABI,
    functionName: "searcherStats",
    args: [addr],
  })) as [bigint, bigint, bigint, bigint, bigint, bigint];

  return {
    totalSimulations: Number(res[0]),
    totalExecutions: Number(res[1]),
    totalVolumeUsdc: Number(res[2]) / 1e6,
    accruedProfitUsdc: Number(res[3]) / 1e6,
    claimedProfitUsdc: Number(res[4]) / 1e6,
    lastActiveTimestamp: Number(res[5]),
  };
}

/**
 * Rule 4 compliance: Check if SPL wrapper delegation is enabled for `who`, and build the
 * `approve_spl(wrapper, 2^64-1, mint)` call to the Helper precompile (0xff...09) if needed.
 */
export async function buildWrapperGrantIfNeeded(who: Hex): Promise<{ to: Hex; data: Hex } | null> {
  const client = getPublicClient();
  const enabled = await client.readContract({
    address: ROME_CONFIG.wusdc,
    abi: WRAPPER_ABI,
    functionName: "isEnabled",
    args: [who],
  });
  if (enabled) return null;
  const mint = await client.readContract({
    address: ROME_CONFIG.wusdc,
    abi: WRAPPER_ABI,
    functionName: "mint_id",
  });
  return {
    to: HELPER_PRECOMPILE,
    data: encodeFunctionData({
      abi: GRANT_ABI,
      functionName: "approve_spl",
      args: [ROME_CONFIG.wusdc, U64_MAX, mint],
    }),
  };
}

export function deriveSolanaSyntheticAddress(pubkeyBase58: string): Hex {
  return syntheticAddress(new PublicKey(pubkeyBase58));
}

// ─── EVM Lane Writes (`submitRomeTx`) ─────────────────────────────────────────
export async function evmRecordSimulation(
  provider: any,
  from: Hex,
  params: {
    routeId: Hex;
    pairSymbol: string;
    evmDexPool: Hex;
    solanaProgramId: Hex;
    amountInBase: bigint;
    expectedOutBase: bigint;
    minProfitBps: bigint;
    estimatedSolanaCu: bigint;
  }
): Promise<Hex> {
  const data = encodeFunctionData({
    abi: ARB_EXECUTOR_ABI,
    functionName: "recordSimulation",
    args: [
      params.routeId,
      params.pairSymbol,
      params.evmDexPool,
      params.solanaProgramId,
      params.amountInBase,
      params.expectedOutBase,
      params.minProfitBps,
      params.estimatedSolanaCu,
    ],
  });
  const hash = await submitRomeTx(provider, {
    from,
    to: ROME_CONFIG.contractAddress,
    data,
    fallbackGas: 12_000_000n,
    minGas: 3_500_000n,
  });
  await getPublicClient().waitForTransactionReceipt({ hash });
  return hash;
}

export async function evmExecuteAtomicArb(
  provider: any,
  from: Hex,
  params: {
    routeId: Hex;
    pairSymbol: string;
    evmDexPool: Hex;
    solanaProgramId: Hex;
    amountInBase: bigint;
    simulatedOutBase: bigint;
    minProfitBps: bigint;
    memoTag: string;
  }
): Promise<Hex> {
  const data = encodeFunctionData({
    abi: ARB_EXECUTOR_ABI,
    functionName: "executeAtomicArbitrage",
    args: [
      params.routeId,
      params.pairSymbol,
      params.evmDexPool,
      params.solanaProgramId,
      params.amountInBase,
      params.simulatedOutBase,
      params.minProfitBps,
      toHex(params.memoTag),
    ],
  });
  const hash = await submitRomeTx(provider, {
    from,
    to: ROME_CONFIG.contractAddress,
    data,
    fallbackGas: 12_000_000n,
    minGas: 3_500_000n,
  });
  await getPublicClient().waitForTransactionReceipt({ hash });
  return hash;
}

export async function evmClaimProfit(provider: any, from: Hex): Promise<Hex> {
  const data = encodeFunctionData({
    abi: ARB_EXECUTOR_ABI,
    functionName: "claimProfit",
  });
  const hash = await submitRomeTx(provider, {
    from,
    to: ROME_CONFIG.contractAddress,
    data,
    fallbackGas: 8_000_000n,
    minGas: 2_500_000n,
  });
  await getPublicClient().waitForTransactionReceipt({ hash });
  return hash;
}

// ─── Solana Lane Writes (`submitRomeTxV1`) ────────────────────────────────────
async function ensureSolanaSyntheticProvisioned(signer: SignerLike) {
  const connection = new Connection(ROME_CONFIG.solanaRpc, "confirmed");
  const payer = toLaneSigner(signer).payer;
  const synthetic = syntheticAddress(payer);
  const deps = {
    connection,
    proxyUrl: ROME_CONFIG.rpcUrl,
    chainId: ROME_CONFIG.chainId,
    programId: ROME_CONFIG.programId,
    signer,
  };
  if (!(await isSyntheticProvisioned(connection, ROME_CONFIG.programId, synthetic))) {
    const created = await submitRomeTxV1(deps, buildCreatePdaCall(synthetic));
    if (created.receipt?.status !== "0x1") {
      throw new Error("Provisioning Solana synthetic sender PDA failed on-chain.");
    }
  }
  return { deps, synthetic };
}

export async function solanaRecordSimulation(
  signer: SignerLike,
  params: {
    routeId: Hex;
    pairSymbol: string;
    evmDexPool: Hex;
    solanaProgramId: Hex;
    amountInBase: bigint;
    expectedOutBase: bigint;
    minProfitBps: bigint;
    estimatedSolanaCu: bigint;
  }
): Promise<Hex> {
  const { deps } = await ensureSolanaSyntheticProvisioned(signer);
  const data = encodeFunctionData({
    abi: ARB_EXECUTOR_ABI,
    functionName: "recordSimulation",
    args: [
      params.routeId,
      params.pairSymbol,
      params.evmDexPool,
      params.solanaProgramId,
      params.amountInBase,
      params.expectedOutBase,
      params.minProfitBps,
      params.estimatedSolanaCu,
    ],
  });
  const res = await submitRomeTxV1(deps, { to: ROME_CONFIG.contractAddress, data });
  if (res.receipt?.status !== "0x1") {
    throw new Error(`Solana-lane simulation tx failed (${res.hash})`);
  }
  return res.hash;
}

export async function solanaExecuteAtomicArb(
  signer: SignerLike,
  params: {
    routeId: Hex;
    pairSymbol: string;
    evmDexPool: Hex;
    solanaProgramId: Hex;
    amountInBase: bigint;
    simulatedOutBase: bigint;
    minProfitBps: bigint;
    memoTag: string;
  }
): Promise<Hex> {
  const { deps } = await ensureSolanaSyntheticProvisioned(signer);
  const data = encodeFunctionData({
    abi: ARB_EXECUTOR_ABI,
    functionName: "executeAtomicArbitrage",
    args: [
      params.routeId,
      params.pairSymbol,
      params.evmDexPool,
      params.solanaProgramId,
      params.amountInBase,
      params.simulatedOutBase,
      params.minProfitBps,
      toHex(params.memoTag),
    ],
  });
  const res = await submitRomeTxV1(deps, { to: ROME_CONFIG.contractAddress, data });
  if (res.receipt?.status !== "0x1") {
    throw new Error(`Solana-lane atomic arb tx reverted (${res.hash})`);
  }
  return res.hash;
}

export async function solanaClaimProfit(signer: SignerLike): Promise<Hex> {
  const { deps } = await ensureSolanaSyntheticProvisioned(signer);
  const data = encodeFunctionData({
    abi: ARB_EXECUTOR_ABI,
    functionName: "claimProfit",
  });
  const res = await submitRomeTxV1(deps, { to: ROME_CONFIG.contractAddress, data });
  if (res.receipt?.status !== "0x1") {
    throw new Error(`Solana-lane claimProfit reverted (${res.hash})`);
  }
  return res.hash;
}
