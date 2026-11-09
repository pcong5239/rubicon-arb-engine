# RubiconArb — Atomic Arbitrage Engine & Simulation Network on Rome

**RubiconArb** is an atomic cross-VM arbitrage engine, strategy simulator, and synchronous execution protocol built on **Rome Protocol** (Category: *Solidity apps using Solana liquidity*).

Searchers from both **EVM wallets** (`submitRomeTx`) and **Solana wallets** (`submitRomeTxV1` dual-lane execution) simulate live spreads between Rome Uniswap V3/V4 pools and Solana AMM programs, and execute atomic two-leg cross-VM arbitrage inside a single **~400ms Solana transaction** via Rome's `ICrossProgramInvocation` (`0xFF...08`) and `IHelperProgram` (`0xFF...09`) precompiles — with built-in **Revert-on-Loss** protection (`RevertOnInsufficientProfit`).

---

## Key Features

1. **Synchronous Cross-VM CPI (`0xFF00000000000000000000000000000000000008`)**
   - `AtomicArbExecutor.sol` (`^0.8.28`) executes Leg 1 against Rome EVM Uniswap V3/V4 liquidity and synchronously invokes Solana programs via `ICrossProgramInvocation.invoke_signed()` in the exact same transaction.
2. **External-Authority PDA Signing (`0xff00000000000000000000000000000000000009`)**
   - Derives and activates deterministic contract PDAs (`0xcfa0fefbd00af9a7f512e6448ca6370fead9cbe6ceb9ec9a92dcf510c4408431`) via `IHelperProgram` so the Solidity contract can authorize Solana program invocations atomically.
3. **Revert-on-Loss Safety Invariant (`RevertOnInsufficientProfit`)**
   - Enforces `realizedProfitBps >= minProfitBps` and `grossAmountOut > amountIn`. If slippage or spread compression causes net profit to fall below the searcher's minimum threshold, the entire EVM + Solana transaction reverts atomically with zero principal loss.
4. **On-Chain Simulation Network (`recordSimulation`)**
   - Searchers benchmark spreads and persist simulation snapshots on-chain before committing capital.
5. **Dual-Lane Wallet Execution**
   - Supports **MetaMask / EVM Wallets** via `@rome-protocol/sdk`'s `submitRomeTx` and **Phantom / Backpack / Solflare Solana Wallets** via Wallet Standard + `submitRomeTxV1` (`buildRomeTx` + `txToVersionedTx`).

---

## Live On-Chain Verification (Rome Hadrian Testnet — Chain ID `200010`)

- **Contract Address (`AtomicArbExecutor.sol`):** [`0x6e2d98772a8a6444ff63a8b0d1b4511ebcd2ca9f`](https://via-hadrian.testnet.romeprotocol.xyz/address/0x6e2d98772a8a6444ff63a8b0d1b4511ebcd2ca9f)
- **Contract External-Auth PDA (`0xFF..09`):** `0xcfa0fefbd00af9a7f512e6448ca6370fead9cbe6ceb9ec9a92dcf510c4408431`
- **Deployment Tx:** [`0x554593805a74086eb4962f31f471ffbe60c98aa53086d7b844cfc10508899a41`](https://via-hadrian.testnet.romeprotocol.xyz/tx/0x554593805a74086eb4962f31f471ffbe60c98aa53086d7b844cfc10508899a41)
- **PDA Activation Tx (`0xFF..09`):** [`0xa81d07cb5a397c390d73aee9c706475b1396c40101785e78ce9f64caff8ec480`](https://via-hadrian.testnet.romeprotocol.xyz/tx/0xa81d07cb5a397c390d73aee9c706475b1396c40101785e78ce9f64caff8ec480)

### Multi-Wallet Live Arbitrage & Simulation Transactions

| # | Searcher Wallet | Action | Pair | EVM Tx Hash | Solana Settlement Signature |
|---|---|---|---|---|---|
| 1 | `0x11b4...368a` | `recordSimulation` | `wSOL/wUSDC` | [`0xe1a788...2ca51`](https://via-hadrian.testnet.romeprotocol.xyz/tx/0xe1a7883bd376eecacfbc177d3f1bcc533dcb89d0d90faba69c3557fcb7b2ca51) | `2gTvEYAAdau5nwrruZ15ESzxubAusZ2ErM38sj26PJSuum7RmyXrt8kND7vV8vnNkAneNsqKhY3QiYiVzrTzNgjk` |
| 2 | `0x11b4...368a` | `executeAtomicArbitrage` (CPI `0xFF..08`) | `wSOL/wUSDC` | [`0x527397...7011`](https://via-hadrian.testnet.romeprotocol.xyz/tx/0x5273974584183be5037ad970273d809739b0be5d01dcbadafe8cf398d9df7011) | `5C5SN9SY2dUDfDxpYm5auKn7FdUDEjrAha38maCvjy39XrBbjuBTLWAPk3SBX3aYM2tHEGMu12MYNGg2DmwBnKhB` |
| 3 | `0x8CAa...3B9D` | `recordSimulation` | `wETH/wUSDC` | [`0xcb4e22...1655`](https://via-hadrian.testnet.romeprotocol.xyz/tx/0xcb4e224b6d7e7a4bae17d99cba60a0d72c76ea00fb882ff9c7080d2454c51655) | `3zjfo3ELB9dqF5SBrXwNvvjmyMWoVPBxqh7JDmcwxfpFB1xdBBUkepuhWHddLJ3rnMLntf5KhrwSuuycZ22hnSTs` |
| 4 | `0x8CAa...3B9D` | `executeAtomicArbitrage` (CPI `0xFF..08`) | `wETH/wUSDC` | [`0x09655d...8dc6`](https://via-hadrian.testnet.romeprotocol.xyz/tx/0x09655dfc1b95441af338021f8c266f4c2854f883a756d6dd468645d0d5ae8dc6) | `5EW9g2Jjbp4Q1KwAURqYkJudBz5TocVy2UJsqX2bQ3j42JXBXXBo77uga3oLDAQkvYXyj2g81DRTjwwu5zb1vbsf` |
| 5 | `0x11b4...368a` | `claimProfit` | `wSOL/wUSDC` | [`0x3bca6b...afd5`](https://via-hadrian.testnet.romeprotocol.xyz/tx/0x3bca6b679109938d8b569598c138eff554b63d31ec9492b64788f4eee4fcafd5) | `5J3ZZjqsZzjQm4QsigBWD2JGMYn8d6u3wTUedRU6Pm3WA23iu4MaodZ7YLrgM1j6yaVNCqeYu1duNivhueKasEpp` |
| 6 | `0x8CAa...3B9D` | `executeAtomicArbitrage` (CPI `0xFF..08`) | `wSOL/wUSDC (CLMM)` | [`0xe1243c...f754`](https://via-hadrian.testnet.romeprotocol.xyz/tx/0xe1243c50bbadd766231a24f55a61c41b95aeea17fa37e58c7529cc324f12f754) | `4LMycbQZ8Fhv4jupWuTQEaMBjvebiMYFtREFP132TezksFD4mNfaMMaiEkw9PDS1cobnjJNsKp19WUBx4YtondTC` |
| 7 | `0x8CAa...3B9D` | `claimProfit` | `wETH/wUSDC` | [`0xdb540d...f827`](https://via-hadrian.testnet.romeprotocol.xyz/tx/0xdb540dbcb02ce8ab22c85b19c41b01d6c85827abe9014b38033e32f9a109f827) | `8YySNBNt3acBwgCHQZfZy5jt1T2TESm8swfaesMiSVzFm8Wy2gZg7UBw3eWNimWwkLtQTPYuXFQfWnBoCyzFpgS` |

### Rubicon Mainnet (`7531`) & Solana Program Targets

- **Rubicon Mainnet Chain ID:** `7531` (`https://rubicon.mainnet.romeprotocol.xyz/`)
- **Rome EVM Program on Solana Mainnet:** `RomePq9X3iAoTr813HR7uRarafFDUJty6GdiEceYpzX`
- **Solana SPL Memo v2 Program (invoked via `0xFF..08` CPI):** `MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr` (`0x054a535a992921064d24e87160da387c7c35b5ddbc92bb81e41fa8404105448d`)
- **Rubicon Mainnet Uniswap Pools (`@rome-protocol/registry`):**
  - Uniswap V3 Factory: `0x75599C4f18E31D9b6B628b83610066E816aa183F`
  - Uniswap V4 PoolManager: `0x366E512c5250f2994225b1E36222cba8D7889515`

---

## Quick Start

```bash
npm install
npm run compile
npm run test:contracts
npm run typecheck
npm run build
npm run dev
```
