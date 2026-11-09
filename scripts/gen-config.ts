import "dotenv/config";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { getChain, getTokens, getContracts, getPrograms } from "@rome-protocol/registry";

function main() {
  const chainId = Number(process.env.CHAIN_ID || 200010);
  const chain = getChain(chainId);
  if (!chain) throw new Error(`Chain ${chainId} not found in @rome-protocol/registry`);

  const tokens = getTokens(chainId) ?? [];
  const contracts = getContracts(chainId)?.contracts ?? getContracts(chainId) ?? [];
  const devnetPrograms = getPrograms("devnet");
  const mainnetPrograms = getPrograms("mainnet");

  const deploymentPath = join(process.cwd(), "src-data-deployment.json");
  const deployment = existsSync(deploymentPath)
    ? JSON.parse(readFileSync(deploymentPath, "utf8"))
    : null;

  const generated = {
    generatedAt: new Date().toISOString(),
    chain,
    tokens,
    contracts: contracts.map((c: any) => ({
      name: c.name,
      address: (c.versions?.find((v: any) => v.status === "live") ?? c.versions?.[0])?.address,
    })),
    devnetPrograms,
    mainnetPrograms,
    deployment,
  };

  const outDir = join(process.cwd(), "src", "data");
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, "config.generated.json"), JSON.stringify(generated, null, 2) + "\n");
  console.log(`✔ Generated src/data/config.generated.json for chain ${chain.chainId} (${chain.name})`);
}

main();
