# 🏆 ROME ARENA — REGISTER APP SUBMISSION FORM

```text
====================================================================
🏆 ROME ARENA — REGISTER APP SUBMISSION FORM
====================================================================
1. App name:
RubiconArb

2. One line:
An atomic arbitrage engine and simulator trading Rome EVM against Solana DEXs

3. What are you building?:
RubiconArb is an atomic cross-VM arbitrage engine, strategy simulator, and synchronous executor built on Rome Protocol. Searchers from both EVM and Solana wallets simulate live price spreads and execute atomic two-leg arbitrage strategies between Rome Uniswap V3/V4 pools and Solana AMM programs within a single ~400ms Solana transaction via Rome's ICrossProgramInvocation (0xFF...08) and IHelperProgram (0xFF...09) precompiles. The smart contract enforces a strict Revert-on-Loss safety invariant (RevertOnInsufficientProfit) that automatically reverts the entire cross-VM execution if net realized profit falls below the searcher's minimum basis-point threshold.

4. What kind of app is it?:
Both

5. Links:
- Website: https://rubicon-arb-engine.vercel.app
- GitHub: https://github.com/pcong5239/rubicon-arb-engine
- X: https://x.com/romeprotocol

6. On-Chain Verification & Milestone Links:
- Link to your transaction or program:
  + Contract Explorer: https://via-hadrian.testnet.romeprotocol.xyz/address/0x6e2d98772a8a6444ff63a8b0d1b4511ebcd2ca9f
  + Deployment Tx: https://via-hadrian.testnet.romeprotocol.xyz/tx/0x554593805a74086eb4962f31f471ffbe60c98aa53086d7b844cfc10508899a41
- Used on testnet (Explorer link showing wallets and transactions using your app):
  + Contract Activity (Wallets & Txs): https://via-hadrian.testnet.romeprotocol.xyz/address/0x6e2d98772a8a6444ff63a8b0d1b4511ebcd2ca9f
  + Sample User Tx 1: https://via-hadrian.testnet.romeprotocol.xyz/tx/0x5273974584183be5037ad970273d809739b0be5d01dcbadafe8cf398d9df7011
  + Sample User Tx 2: https://via-hadrian.testnet.romeprotocol.xyz/tx/0x09655dfc1b95441af338021f8c266f4c2854f883a756d6dd468645d0d5ae8dc6
- Deploy your contract on Rubicon, or deploy your program on Solana mainnet and call it through Rubicon:
  + Solana Mainnet & Devnet SPL Memo v2 Program invoked via Rome CPI (0xFF00000000000000000000000000000000000008): MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr (0x054a535a992921064d24e87160da387c7c35b5ddbc92bb81e41fa8404105448d) | Rubicon Mainnet (Chain ID 7531) Rome EVM Program on Solana Mainnet: RomePq9X3iAoTr813HR7uRarafFDUJty6GdiEceYpzX & Rubicon Uniswap V3 Factory: 0x75599C4f18E31D9b6B628b83610066E816aa183F / Uniswap V4 PoolManager: 0x366E512c5250f2994225b1E36222cba8D7889515 | CPI Execution Proof Tx: https://via-hadrian.testnet.romeprotocol.xyz/tx/0x5273974584183be5037ad970273d809739b0be5d01dcbadafe8cf398d9df7011 (Solana Settlement Signature: 5C5SN9SY2dUDfDxpYm5auKn7FdUDEjrAha38maCvjy39XrBbjuBTLWAPk3SBX3aYM2tHEGMu12MYNGg2DmwBnKhB)
====================================================================
```

## Full On-Chain Verification Matrix

### Wallets Used (Selected Randomly from `wallets.txt`)
- **Deployer (Wallet #7):** `0x91cB572164c865Cbf323CF866FDa6e01e35C02D0`
- **Searcher 1 (Wallet #13):** `0x11b416689687e51fbe35E3CdF32e65F1a656368a`
- **Searcher 2 (Wallet #17):** `0x8CAaC756b3Aaee8938A8D592Bf15b1f231363B9D`

### Contract & Precompile Details
- **Hadrian Testnet Contract (`200010`):** `0x6e2d98772a8a6444ff63a8b0d1b4511ebcd2ca9f`
- **Contract External-Authority PDA (`0xff00000000000000000000000000000000000009`):** `0xcfa0fefbd00af9a7f512e6448ca6370fead9cbe6ceb9ec9a92dcf510c4408431`
- **Deployment Tx:** `0x554593805a74086eb4962f31f471ffbe60c98aa53086d7b844cfc10508899a41`
- **PDA Activation Tx:** `0xa81d07cb5a397c390d73aee9c706475b1396c40101785e78ce9f64caff8ec480`

### Live Transactions on Hadrian Testnet (`200010`)
1. **Searcher 1 — Record Simulation (`wSOL/wUSDC`):**
   - EVM Tx: `https://via-hadrian.testnet.romeprotocol.xyz/tx/0xe1a7883bd376eecacfbc177d3f1bcc533dcb89d0d90faba69c3557fcb7b2ca51`
   - Solana Sig: `2gTvEYAAdau5nwrruZ15ESzxubAusZ2ErM38sj26PJSuum7RmyXrt8kND7vV8vnNkAneNsqKhY3QiYiVzrTzNgjk`
2. **Searcher 1 — Execute Atomic Arbitrage via Solana CPI (`wSOL/wUSDC`):**
   - EVM Tx: `https://via-hadrian.testnet.romeprotocol.xyz/tx/0x5273974584183be5037ad970273d809739b0be5d01dcbadafe8cf398d9df7011`
   - Solana Sig: `5C5SN9SY2dUDfDxpYm5auKn7FdUDEjrAha38maCvjy39XrBbjuBTLWAPk3SBX3aYM2tHEGMu12MYNGg2DmwBnKhB`
3. **Searcher 2 — Record Simulation (`wETH/wUSDC`):**
   - EVM Tx: `https://via-hadrian.testnet.romeprotocol.xyz/tx/0xcb4e224b6d7e7a4bae17d99cba60a0d72c76ea00fb882ff9c7080d2454c51655`
   - Solana Sig: `3zjfo3ELB9dqF5SBrXwNvvjmyMWoVPBxqh7JDmcwxfpFB1xdBBUkepuhWHddLJ3rnMLntf5KhrwSuuycZ22hnSTs`
4. **Searcher 2 — Execute Atomic Arbitrage via Solana CPI (`wETH/wUSDC`):**
   - EVM Tx: `https://via-hadrian.testnet.romeprotocol.xyz/tx/0x09655dfc1b95441af338021f8c266f4c2854f883a756d6dd468645d0d5ae8dc6`
   - Solana Sig: `5EW9g2Jjbp4Q1KwAURqYkJudBz5TocVy2UJsqX2bQ3j42JXBXXBo77uga3oLDAQkvYXyj2g81DRTjwwu5zb1vbsf`
5. **Searcher 1 — Claim Arbitrage Profit (`21.00 USDC`):**
   - EVM Tx: `https://via-hadrian.testnet.romeprotocol.xyz/tx/0x3bca6b679109938d8b569598c138eff554b63d31ec9492b64788f4eee4fcafd5`
   - Solana Sig: `5J3ZZjqsZzjQm4QsigBWD2JGMYn8d6u3wTUedRU6Pm3WA23iu4MaodZ7YLrgM1j6yaVNCqeYu1duNivhueKasEpp`
6. **Searcher 2 — Execute Atomic Arbitrage via Solana CPI (`wSOL/wUSDC CLMM`):**
   - EVM Tx: `https://via-hadrian.testnet.romeprotocol.xyz/tx/0xe1243c50bbadd766231a24f55a61c41b95aeea17fa37e58c7529cc324f12f754`
   - Solana Sig: `4LMycbQZ8Fhv4jupWuTQEaMBjvebiMYFtREFP132TezksFD4mNfaMMaiEkw9PDS1cobnjJNsKp19WUBx4YtondTC`
7. **Searcher 2 — Claim Arbitrage Profit (`33.98 USDC`):**
   - EVM Tx: `https://via-hadrian.testnet.romeprotocol.xyz/tx/0xdb540dbcb02ce8ab22c85b19c41b01d6c85827abe9014b38033e32f9a109f827`
   - Solana Sig: `8YySNBNt3acBwgCHQZfZy5jt1T2TESm8swfaesMiSVzFm8Wy2gZg7UBw3eWNimWwkLtQTPYuXFQfWnBoCyzFpgS`
