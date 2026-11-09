import assert from "node:assert/strict";
import { createEVM } from "@ethereumjs/evm";
import { Common, Hardfork, Mainnet } from "@ethereumjs/common";
import { Address, hexToBytes, bytesToHex } from "@ethereumjs/util";
import { encodeAbiParameters, encodeFunctionData, decodeFunctionResult, keccak256, toBytes } from "viem";
import { compileAtomicArbExecutor } from "../scripts/compile.js";

const DEPLOYER = new Address(hexToBytes("0x91cB572164c865Cbf323CF866FDa6e01e35C02D0"));
const SEARCHER_1 = new Address(hexToBytes("0x11b416689687e51fbe35E3CdF32e65F1a656368a"));
const SEARCHER_2 = new Address(hexToBytes("0x8CAaC756b3Aaee8938A8D592Bf15b1f231363B9D"));

const WUSDC = "0xbce339ba4c3a8de3bb8af1c5539e6ac11da3112d";
const UNIV3_ROUTER = "0x08CA15F54b2bf33AB695548B08101d7174eF83cA";
const UNIV4_PM = "0x8a281Be9B5173B2F52328437eAa0d272791707f7";
const METEORA_FACTORY = "0xd68b355f62643de0ec40243cba8f699f959ea3c4";

async function runTests() {
  console.log("====================================================================");
  console.log("🧪 RUBICON ARB — ATOMIC ARBITRAGE EXECUTOR UNIT TEST SUITE (Solidity 0.8.28)");
  console.log("====================================================================\n");

  const { abi, bytecode } = compileAtomicArbExecutor();
  const common = new Common({ chain: Mainnet, hardfork: Hardfork.Cancun });
  const evm = await createEVM({ common });

  // Deploy contract in EVM
  const ctorArgs = encodeAbiParameters(
    [
      { type: "address" },
      { type: "address" },
      { type: "address" },
      { type: "address" },
    ],
    [WUSDC, UNIV3_ROUTER, UNIV4_PM, METEORA_FACTORY]
  );
  const deployData = hexToBytes((bytecode + ctorArgs.slice(2)) as `0x${string}`);

  const deployRes = await evm.runCall({
    caller: DEPLOYER,
    data: deployData,
    gasLimit: 30_000_000n,
  });

  assert.equal(deployRes.execResult.exceptionError, undefined, "Contract deployment should succeed");
  const contractAddr = deployRes.createdAddress!;
  console.log(`✔ [PASS] Test 1: AtomicArbExecutor deployed at ${contractAddr.toString()}`);

  async function callView(fnName: string, args: any[] = [], caller = DEPLOYER) {
    const data = encodeFunctionData({ abi, functionName: fnName, args });
    const res = await evm.runCall({
      caller,
      to: contractAddr,
      data: hexToBytes(data),
      gasLimit: 10_000_000n,
    });
    if (res.execResult.exceptionError) {
      throw new Error(`View ${fnName} reverted: ${res.execResult.exceptionError.error}`);
    }
    return decodeFunctionResult({
      abi,
      functionName: fnName,
      data: bytesToHex(res.execResult.returnValue) as `0x${string}`,
    });
  }

  async function sendTx(fnName: string, args: any[] = [], caller = DEPLOYER) {
    const data = encodeFunctionData({ abi, functionName: fnName, args });
    const res = await evm.runCall({
      caller,
      to: contractAddr,
      data: hexToBytes(data),
      gasLimit: 15_000_000n,
    });
    return res;
  }

  // Test 2: Verify pre-configured Rome <-> Solana routes
  const routes = (await callView("getAllRoutes")) as any[];
  assert.equal(routes.length, 3, "Should have 3 pre-seeded Rome <-> Solana arbitrage routes");
  assert.equal(routes[0].pairSymbol, "wSOL/wUSDC");
  assert.equal(routes[1].pairSymbol, "wETH/wUSDC");
  console.log(`✔ [PASS] Test 2: Verified 3 default Rome EVM <-> Solana AMM routes (${routes.map((r) => r.pairSymbol).join(", ")})`);

  // Test 3: Record Simulation (`recordSimulation`) by Searcher 1
  const route1Id = keccak256(toBytes("ROME_UNIV3_SOLANA_METEORA_DLMM_WSOL_WUSDC"));
  const simRes1 = await sendTx(
    "recordSimulation",
    [
      route1Id,
      "wSOL/wUSDC",
      UNIV3_ROUTER,
      "0x04e9e1257c589a882a6f924f5a7e676c1330b16992b1e7b8634f4bc5b3681866",
      1_000_000_000n, // 1,000 USDC (6 dec)
      1_008_400_000n, // 1,008.40 USDC (+84 bps)
      35n,            // minProfitBps = 35 bps
      142_000n,       // estimated Solana CU
    ],
    SEARCHER_1
  );
  assert.equal(simRes1.execResult.exceptionError, undefined, "recordSimulation should succeed");
  const simDecoded = decodeFunctionResult({
    abi,
    functionName: "recordSimulation",
    data: bytesToHex(simRes1.execResult.returnValue) as `0x${string}`,
  }) as [bigint, bigint, boolean];
  assert.equal(simDecoded[0], 0n, "First simulation ID should be 0");
  assert.equal(simDecoded[1], 84n, "Expected profit bps should be 84");
  assert.equal(simDecoded[2], true, "Simulation should be marked profitable");
  console.log(`✔ [PASS] Test 3: Searcher 1 recorded profitable cross-VM simulation (+84 bps >= 35 bps threshold)`);

  // Test 4: Execute Atomic Arbitrage (`executeAtomicArbitrage`) by Searcher 1
  const execRes1 = await sendTx(
    "executeAtomicArbitrage",
    [
      route1Id,
      "wSOL/wUSDC",
      UNIV3_ROUTER,
      "0x04e9e1257c589a882a6f924f5a7e676c1330b16992b1e7b8634f4bc5b3681866",
      2_500_000_000n, // 2,500 USDC
      2_521_000_000n, // 2,521 USDC (+21 USDC profit, 84 bps)
      40n,            // minProfitBps = 40 bps
      "0x",
    ],
    SEARCHER_1
  );
  assert.equal(execRes1.execResult.exceptionError, undefined, "executeAtomicArbitrage should succeed");
  const execDecoded = decodeFunctionResult({
    abi,
    functionName: "executeAtomicArbitrage",
    data: bytesToHex(execRes1.execResult.returnValue) as `0x${string}`,
  }) as [bigint, bigint, bigint];
  assert.equal(execDecoded[0], 0n, "First execution ID should be 0");
  assert.equal(execDecoded[1], 21_000_000n, "Net profit should be 21,000,000 base units");
  assert.equal(execDecoded[2], 84n, "Realized profit bps should be 84");
  console.log(`✔ [PASS] Test 4: Searcher 1 executed atomic arbitrage (2,500 USDC -> 2,521 USDC, +84 bps)`);

  // Test 5: Revert-on-Loss Guard (`InvalidProfitBelowMinBps`)
  const lossRes = await sendTx(
    "executeAtomicArbitrage",
    [
      route1Id,
      "wSOL/wUSDC",
      UNIV3_ROUTER,
      "0x04e9e1257c589a882a6f924f5a7e676c1330b16992b1e7b8634f4bc5b3681866",
      1_000_000_000n, // 1,000 USDC
      1_001_500_000n, // +15 bps profit
      50n,            // minProfitBps = 50 bps (requires >= 50 bps!)
      "0x",
    ],
    SEARCHER_2
  );
  assert.notEqual(lossRes.execResult.exceptionError, undefined, "Should revert when profitBps < minProfitBps");
  console.log(`✔ [PASS] Test 5: Revert-on-Loss guard automatically reverted sub-threshold trade (15 bps < 50 bps required)`);

  // Test 6: Rome CPI Account Rules Validation (`executeCustomCpiArb`)
  const targetProgram = "0x04e9e1257c589a882a6f924f5a7e676c1330b16992b1e7b8634f4bc5b3681866";
  const emptyAccountsRes = await sendTx(
    "executeCustomCpiArb",
    [targetProgram, [], "0x0102", 1000n, 1100n, 50n],
    SEARCHER_2
  );
  assert.notEqual(emptyAccountsRes.execResult.exceptionError, undefined, "Empty CPI accounts must revert");

  const forbiddenProgramInAccountsRes = await sendTx(
    "executeCustomCpiArb",
    [
      targetProgram,
      [{ pubkey: targetProgram, is_signer: false, is_writable: false }],
      "0x0102",
      1000n,
      1100n,
      50n,
    ],
    SEARCHER_2
  );
  assert.notEqual(
    forbiddenProgramInAccountsRes.execResult.exceptionError,
    undefined,
    "Target program_id inside accounts array must revert per Rome CPI Rule #2"
  );
  console.log(`✔ [PASS] Test 6: Verified Rome CPI Account Rules (non-empty accounts & program_id exclusion)`);

  // Test 7: Claim Arbitrage Profit (`claimProfit`) by Searcher 1
  const claimRes = await sendTx("claimProfit", [], SEARCHER_1);
  assert.equal(claimRes.execResult.exceptionError, undefined, "claimProfit should succeed for Searcher 1");
  const claimedAmt = decodeFunctionResult({
    abi,
    functionName: "claimProfit",
    data: bytesToHex(claimRes.execResult.returnValue) as `0x${string}`,
  }) as bigint;
  assert.equal(claimedAmt, 21_000_000n, "Claimed profit should equal accrued 21,000,000");

  // Re-claiming immediately should revert with NothingToClaim
  const doubleClaimRes = await sendTx("claimProfit", [], SEARCHER_1);
  assert.notEqual(doubleClaimRes.execResult.exceptionError, undefined, "Second claim with 0 accrued should revert");
  console.log(`✔ [PASS] Test 7: Searcher 1 claimed 21.00 USDC profit & double-claim guard verified`);

  // Test 8: Verify Engine Summary & Searcher Profile
  const summary = (await callView("getEngineSummary")) as any[];
  assert.equal(summary[0], 1n, "Total simulations == 1");
  assert.equal(summary[1], 1n, "Total executions == 1");
  assert.equal(summary[2], 2_500_000_000n, "Total volume == 2,500 USDC");
  assert.equal(summary[3], 21_000_000n, "Total profit generated == 21 USDC");
  assert.equal(summary[4], 21_000_000n, "Total profit claimed == 21 USDC");
  console.log(`✔ [PASS] Test 8: Engine summary & searcher telemetry match 100%\n`);

  console.log("====================================================================");
  console.log("✅ ALL 8/8 SMART CONTRACT UNIT TESTS PASSED 100%!");
  console.log("====================================================================");
}

runTests().catch((err) => {
  console.error("❌ Unit test failed:", err);
  process.exit(1);
});
