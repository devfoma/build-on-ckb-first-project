import { ccc } from "@ckb-ccc/connector-react";

export type Network = "testnet";

// Establish a connection to the public CKB Testnet node
export const cccClient = new ccc.ClientPublicTestnet();
export const network: Network = "testnet";
