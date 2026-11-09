declare module "@rome-protocol/registry" {
  export function getChain(chainId: number): any;
  export function listChains(): any[];
  export function getTokens(chainId: number): any[];
  export function getContracts(chainId: number): any;
  export function getOracle(chainId: number): any;
  export function getPrograms(network: string): Record<string, string>;
  export function getBridge(chainId: number): any;
}
