import { createPublicClient, createWalletClient, http, type Account } from "viem";

/**
 * Minimal EIP-1193 provider backed by a viem Account so `@rome-protocol/sdk`'s
 * `submitRomeTx` works seamlessly in Node scripts (deploy & interact) as well as browser wallets.
 */
export function eip1193FromAccount(account: Account, rpcUrl: string, chainId: number) {
  const pub = createPublicClient({ transport: http(rpcUrl) });
  const wallet = createWalletClient({ account, transport: http(rpcUrl) });
  const big = (v: unknown) => (v === undefined || v === null ? undefined : BigInt(v as any));

  return {
    request: async ({ method, params }: { method: string; params?: any[] }) => {
      switch (method) {
        case "eth_accounts":
        case "eth_requestAccounts":
          return [account.address];
        case "eth_chainId":
          return `0x${chainId.toString(16)}`;
        case "eth_sendTransaction": {
          const t = (params ?? [])[0] ?? {};
          return wallet.sendTransaction({
            account,
            chain: null,
            to: t.to,
            data: t.data,
            value: big(t.value),
            gas: big(t.gas),
            maxFeePerGas: big(t.maxFeePerGas),
            maxPriorityFeePerGas: big(t.maxPriorityFeePerGas),
          } as any);
        }
        default:
          return pub.request({ method: method as any, params: params as any });
      }
    },
  };
}
