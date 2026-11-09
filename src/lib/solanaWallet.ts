import { getWallets } from "@wallet-standard/app";
import { PublicKey } from "@solana/web3.js";
import type { SignerLike } from "@rome-protocol/sdk";

export type StandardWallet = ReturnType<ReturnType<typeof getWallets>["get"]>[number];
export type StandardAccount = StandardWallet["accounts"][number];

export interface SolanaWalletSession {
  walletName: string;
  pubkeyBase58: string;
  signer: SignerLike;
}

export const solanaChainId = (cluster: string) =>
  /^mainnet/.test(cluster) ? "solana:mainnet" : cluster === "testnet" ? "solana:testnet" : "solana:devnet";

const REQUIRED_FEATURES = ["standard:connect", "solana:signMessage", "solana:signTransaction"];

function isUsableWallet(w: StandardWallet, chain: string): boolean {
  return REQUIRED_FEATURES.every((f) => f in w.features);
}

export function subscribeSolanaWallets(cluster: string, onChange: (wallets: StandardWallet[]) => void): () => void {
  if (typeof window === "undefined") return () => {};
  const chain = solanaChainId(cluster);
  const { get, on } = getWallets();
  const emit = () => onChange(get().filter((w) => isUsableWallet(w, chain)));
  emit();
  const offs = [on("register", emit), on("unregister", emit)];
  return () => offs.forEach((off) => off());
}

export async function connectStandardSolanaWallet(wallet: StandardWallet, cluster: string): Promise<SolanaWalletSession> {
  const features = wallet.features as any;
  const { accounts } = await features["standard:connect"].connect();
  const [account] = accounts ?? [];
  if (!account) {
    throw new Error(`${wallet.name} returned no account. Unlock the wallet and try again.`);
  }
  const chain = solanaChainId(cluster);
  const pubkey = new PublicKey(account.publicKey);

  const signWire = async (transaction: Uint8Array): Promise<Uint8Array> => {
    const [{ signedTransaction }] = await features["solana:signTransaction"].signTransaction({
      account,
      transaction,
      chain,
    });
    return signedTransaction;
  };

  return {
    walletName: wallet.name,
    pubkeyBase58: pubkey.toBase58(),
    signer: {
      payer: pubkey,
      signAuthHash: async (message: Uint8Array) => {
        const [{ signature, signedMessage }] = await features["solana:signMessage"].signMessage({
          account,
          message,
        });
        if (
          signedMessage &&
          (signedMessage.length !== message.length ||
            signedMessage.some((b: number, i: number) => b !== message[i]))
        ) {
          throw new Error(`${wallet.name} altered the Rome authorization message before signing.`);
        }
        return signature;
      },
      signV1Wire: async (wire: Uint8Array) => (await signWire(wire)).slice(-64),
    },
  };
}
