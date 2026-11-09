import "dotenv/config";
import { writeFileSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { createPublicClient, createWalletClient, http, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { getChain, getTokens, getContracts, getPrograms } from "@rome-protocol/registry";
import { compileAtomicArbExecutor } from "./compile.js";

function getLiveContractAddress(contracts: any[], name: string): Hex {
  const entry = contracts.find((c: any) => c.name === name);
  const live = entry?.versions?.find((v: any) => v.status === "live") ?? entry?.versions?.[0];
  if (!live?.address) throw new Error(`Contract ${name} not found in @rome-protocol/registry`);
  return live.address as Hex;
}

async function main() {
  const chainId = Number(process.env.CHAIN_ID || 200010);
  const chain = getChain(chainId);
  if (!chain) throw new Error(`Chain ${chainId} not found in @rome-protocol/registry`);

  const tokens = getTokens(chainId) ?? [];
  const gasToken = tokens.find((t: any) => t.kind === "gas");
  const wusdc = tokens.find((t: any) => t.kind === "spl_wrapper" && t.mintId === gasToken?.mintId);
  if (!wusdc) throw new Error(`wUSDC wrapper not found in @rome-protocol/registry for chain ${chainId}`);

  const contracts = getContracts(chainId)?.contracts ?? getContracts(chainId) ?? [];
  const uniswapV3Router = getLiveContractAddress(contracts, "SwapRouter");
  const uniswapV4PoolManager = getLiveContractAddress(contracts, "UniswapV4PoolManager");
  const meteoraDammFactory = getLiveContractAddress(contracts, "MeteoraDAMMv1Factory");
  const solanaPrograms = getPrograms("devnet");
  const mainnetPrograms = getPrograms("mainnet");

  const deployerKey = (process.env.DEPLOYER_PRIVATE_KEY || process.env.ROME_EVM_KEY) as Hex;
  if (!deployerKey) throw new Error("Missing DEPLOYER_PRIVATE_KEY in .env");
  const account = privateKeyToAccount(deployerKey);

  console.log("====================================================================");
  console.log(`🚀 DEPLOYING AtomicArbExecutor TO ${chain.name} (Chain ID: ${chainId})`);
  console.log("====================================================================");
  console.log(`Deployer Address     : ${account.address}`);
  console.log(`wUSDC Wrapper        : ${wusdc.address}`);
  console.log(`UniswapV3 SwapRouter : ${uniswapV3Router}`);
  console.log(`UniswapV4 PoolMgr    : ${uniswapV4PoolManager}`);
  console.log(`Meteora DAMM Factory : ${meteoraDammFactory}`);

  const { abi, bytecode } = compileAtomicArbExecutor();

  const viemChain = {
    id: chainId,
    name: chain.name,
    nativeCurrency: chain.nativeCurrency,
    rpcUrls: { default: { http: [chain.rpcUrl] } },
  } as const;

  const pub = createPublicClient({ chain: viemChain, transport: http(chain.rpcUrl) });
  const wallet = createWalletClient({ account, chain: viemChain, transport: http(chain.rpcUrl) });

  const balance = await pub.getBalance({ address: account.address });
  console.log(`Deployer Gas Balance : ${balance.toString()} wei USDC`);

  const gp = await pub.getGasPrice();
  console.log(`Current Gas Price    : ${gp.toString()} wei`);

  console.log("\nBroadcasting deployment transaction to Hadrian Testnet...");
  const deployTxHash = await wallet.deployContract({
    abi,
    bytecode,
    args: [wusdc.address as Hex, uniswapV3Router, uniswapV4PoolManager, meteoraDammFactory],
    gas: 76_000_000n,
    maxFeePerGas: (gp * 101n) / 100n,
    maxPriorityFeePerGas: 0n,
  });

  console.log(`Deployment Tx Hash   : ${deployTxHash}`);
  const rcpt = await pub.waitForTransactionReceipt({ hash: deployTxHash, timeout: 120_000 });
  if (rcpt.status !== "success" || !rcpt.contractAddress) {
    throw new Error(`Deployment failed with status ${rcpt.status}`);
  }

  console.log(`✔ Contract Deployed  : ${rcpt.contractAddress}`);
  console.log(`Explorer Link        : ${chain.explorerUrl}address/${rcpt.contractAddress}`);

  // Fetch Solana settlement signature for deployment tx
  let deploySolanaSig: string | null = null;
  try {
    const solRes = await fetch(chain.rpcUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "rome_solanaTxForEvmTx",
        params: [deployTxHash],
      }),
    });
    const solJson = (await solRes.json()) as any;
    deploySolanaSig = solJson?.result?.[0] ?? null;
    if (deploySolanaSig) {
      console.log(`Solana Settlement Tx : ${deploySolanaSig}`);
    }
  } catch {}

  const summary = (await pub.readContract({
    address: rcpt.contractAddress,
    abi,
    functionName: "getEngineSummary",
  })) as any[];
  let contractExternalPda = summary[5];
  console.log(`Initial Contract PDA : ${contractExternalPda}`);

  // Activate contract's external-auth PDA on Solana via Helper precompile (0xff...09)
  try {
    console.log("Activating contract's external-auth PDA via Helper precompile...");
    const actHash = await wallet.writeContract({
      address: rcpt.contractAddress,
      abi,
      functionName: "activateContractPda",
      gas: 15_000_000n,
      maxFeePerGas: (gp * 101n) / 100n,
      maxPriorityFeePerGas: 0n,
    });
    await pub.waitForTransactionReceipt({ hash: actHash });
    const summaryAfter = (await pub.readContract({
      address: rcpt.contractAddress,
      abi,
      functionName: "getEngineSummary",
    })) as any[];
    contractExternalPda = summaryAfter[5];
    console.log(`✔ Activated Rome PDA : ${contractExternalPda} (tx: ${actHash})`);
  } catch (e: any) {
    console.log(`Note on PDA activation: ${e.shortMessage || e.message}`);
  }

  // Also check Rubicon Mainnet (7531) RPC status & configuration
  const rubiconRpc = process.env.RUBICON_RPC_URL || "https://rubicon.mainnet.romeprotocol.xyz/";
  let rubiconChainIdHex = "0x1d6b";
  try {
    const rRes = await fetch(rubiconRpc, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_chainId", params: [] }),
    });
    const rJson = (await rRes.json()) as any;
    if (rJson?.result) rubiconChainIdHex = rJson.result;
  } catch {}

  const deploymentData = {
    appName: "RubiconArb",
    deployedAt: new Date().toISOString(),
    hadrian: {
      chainId: chain.chainId,
      name: chain.name,
      rpcUrl: chain.rpcUrl,
      explorerUrl: chain.explorerUrl,
      romeEvmProgramId: chain.romeEvmProgramId,
      contractAddress: rcpt.contractAddress,
      deployTxHash,
      deploySolanaSig,
      deployer: account.address,
      contractExternalPda,
      wusdc: wusdc.address,
      usdcMint: wusdc.mintId,
      uniswapV3Router,
      uniswapV4PoolManager,
      meteoraDammFactory,
      solanaPrograms,
    },
    rubiconMainnet: {
      chainId: 7531,
      chainIdHex: rubiconChainIdHex,
      name: "Rome Rubicon Mainnet",
      rpcUrl: rubiconRpc,
      explorerUrl: "https://via.mainnet.romeprotocol.xyz/",
      romeEvmProgramId: "RomePq9X3iAoTr813HR7uRarafFDUJty6GdiEceYpzX",
      solanaMemoProgramId: mainnetPrograms.memo,
      jupiterV6ProgramId: mainnetPrograms.jupiterV6,
      meteoraDlmmProgramId: mainnetPrograms.meteoraDlmm,
      raydiumClmmProgramId: mainnetPrograms.raydiumClmm,
      orcaWhirlpoolProgramId: mainnetPrograms.orcaWhirlpool,
      contractsSnapshot: {
        UniswapV3Factory: "0x02aed776a025",
        SwapRouterV3: "0x680b7645d034",
        ERC20SPLFactory: "0x4068aa74ae6e",
        wUSDC: "0x0952d233f9b3",
        wSOL: "0xc4e29e0fa113",
        wETH: "0x01e8b35792e9",
      },
    },
    transactions: [],
  };

  writeFileSync(
    join(process.cwd(), "src-data-deployment.json"),
    JSON.stringify(deploymentData, null, 2) + "\n"
  );

  // Update .env with NEXT_PUBLIC_ARB_EXECUTOR_ADDRESS
  const envPath = join(process.cwd(), ".env");
  if (existsSync(envPath)) {
    let envContent = readFileSync(envPath, "utf8");
    if (envContent.includes("NEXT_PUBLIC_ARB_EXECUTOR_ADDRESS=")) {
      envContent = envContent.replace(
        /NEXT_PUBLIC_ARB_EXECUTOR_ADDRESS=.*/,
        `NEXT_PUBLIC_ARB_EXECUTOR_ADDRESS=${rcpt.contractAddress}`
      );
    } else {
      envContent += `\nNEXT_PUBLIC_ARB_EXECUTOR_ADDRESS=${rcpt.contractAddress}\n`;
    }
    writeFileSync(envPath, envContent);
  }

  console.log("✔ Saved deployment metadata to src-data-deployment.json");
}

main().catch((err) => {
  console.error("❌ Deploy failed:", err);
  process.exit(1);
});
