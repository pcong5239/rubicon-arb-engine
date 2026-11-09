import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import solc from "solc";

export function compileAtomicArbExecutor() {
  const sourcePath = join(process.cwd(), "contracts", "AtomicArbExecutor.sol");
  const content = readFileSync(sourcePath, "utf8");

  const input = {
    language: "Solidity",
    sources: {
      "AtomicArbExecutor.sol": { content },
    },
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
      viaIR: true,
      outputSelection: {
        "*": {
          "*": ["abi", "evm.bytecode.object", "evm.deployedBytecode.object"],
        },
      },
    },
  };

  const out = JSON.parse(solc.compile(JSON.stringify(input)));
  if (out.errors) {
    const fatal = out.errors.filter((e: any) => e.severity === "error");
    if (fatal.length > 0) {
      throw new Error("Solc compilation errors:\n" + fatal.map((f: any) => f.formattedMessage).join("\n"));
    }
  }

  const contract = out.contracts["AtomicArbExecutor.sol"].AtomicArbExecutor;
  const artifact = {
    contractName: "AtomicArbExecutor",
    abi: contract.abi,
    bytecode: `0x${contract.evm.bytecode.object}` as `0x${string}`,
    deployedBytecode: `0x${contract.evm.deployedBytecode.object}` as `0x${string}`,
  };

  const artifactsDir = join(process.cwd(), "artifacts");
  mkdirSync(artifactsDir, { recursive: true });
  writeFileSync(join(artifactsDir, "AtomicArbExecutor.json"), JSON.stringify(artifact, null, 2) + "\n");

  return artifact;
}

if (process.argv[1]?.endsWith("compile.ts")) {
  const art = compileAtomicArbExecutor();
  console.log(`✔ Compiled AtomicArbExecutor.sol (${(art.bytecode.length - 2) / 2} bytes) -> artifacts/AtomicArbExecutor.json`);
}
