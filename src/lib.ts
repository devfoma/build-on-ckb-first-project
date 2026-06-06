import { ccc } from "@ckb-ccc/connector-react";
import { cccClient } from "./ccc-client";
import systemScripts from "./deployment/system-scripts.json";

// Type definition for account metadata
export type CkbAccount = {
  address: string;
  lockScript: ccc.Script;
};

// Map script hashType to hex byte
function getHashTypeByte(hashType: string): string {
  if (hashType === "data") return "00";
  if (hashType === "type") return "01";
  if (hashType === "data1") return "02";
  if (hashType === "data2") return "04";
  return "00";
}

// Convert string to hex
export function stringToHex(text: string): string {
  const encoder = new TextEncoder();
  const uint8Array = encoder.encode(text);
  return (
    "0x" +
    Array.prototype.map
      .call(uint8Array, (byte: number) => {
        return ("0" + (byte & 0xff).toString(16)).slice(-2);
      })
      .join("")
  );
}

// Convert hex to string
export function hexToString(hexString: string): string {
  const decoder = new TextDecoder("utf-8");
  const cleanedHex = hexString.startsWith("0x") ? hexString.slice(2) : hexString;
  const uint8Array = new Uint8Array(
    cleanedHex.match(/[\da-f]{2}/gi)!.map((h) => parseInt(h, 16))
  );
  return decoder.decode(uint8Array);
}

// Calculate CKB Blake2b 256 hash of a string
export function calculateBlake2bHash(text: string): string {
  const bytes = new TextEncoder().encode(text);
  const hex = ccc.hexFrom(bytes);
  return ccc.hashCkb(hex).slice(2);
}

// Check CKB balance of a given address
export async function capacityOf(address: string): Promise<bigint> {
  try {
    const addr = await ccc.Address.fromString(address, cccClient);
    const balance = await cccClient.getBalance([addr.script]);
    return balance;
  } catch (error) {
    console.error("Failed to query capacity:", error);
    return 0n;
  }
}

// Generate the custom Hash-Lock address
export function generateHashLockAccount(
  hash: string,
  contractCodeHash: string,
  contractHashType: string
): CkbAccount {
  const hashTypeByte = getHashTypeByte(contractHashType);
  
  // Format args: 0x0000 + contractCodeHash + contractHashType + preimageHash
  const cleanCodeHash = contractCodeHash.startsWith("0x") ? contractCodeHash.slice(2) : contractCodeHash;
  const cleanHash = hash.startsWith("0x") ? hash.slice(2) : hash;
  const lockArgs =
    "0x0000" +
    cleanCodeHash +
    hashTypeByte +
    cleanHash;

  // The lock script points to the system ckb_js_vm
  const testnetJsVm = systemScripts["testnet"]["ckb_js_vm"].script;
  const lockScript = {
    codeHash: testnetJsVm.codeHash,
    hashType: testnetJsVm.hashType as "type" | "data" | "data1" | "data2",
    args: lockArgs,
  };

  const address = ccc.Address.fromScript(ccc.Script.from(lockScript), cccClient).toString();
  return {
    address,
    lockScript: ccc.Script.from(lockScript),
  };
}

// Fund the Lock address (transfer CKB from the deployer's address to the Lock address)
export async function fundLockAddress(
  deployerPrivateKey: string,
  lockAddress: string,
  amountInCKB: string
): Promise<string> {
  const signer = new ccc.SignerCkbPrivateKey(cccClient, deployerPrivateKey);
  const receiverScript = (await ccc.Address.fromString(lockAddress, cccClient)).script;

  // Build output cell containing the CKB amount
  const tx = ccc.Transaction.from({
    outputs: [{ 
      lock: receiverScript,
      capacity: ccc.fixedPointFrom(amountInCKB)
    }],
    outputsData: ["0x"],
  });

  // Automatically find inputs and calculate fees
  await tx.completeInputsByCapacity(signer);
  await tx.completeFeeBy(signer, 2000);

  // Sign and broadcast
  const txHash = await signer.sendTransaction(tx);
  return txHash;
}

// Unlock funds from the Hash-Lock address (using preimage instead of private key)
export async function unlockLockAddress(
  lockAddress: string,
  receiverAddress: string,
  amountInCKB: string,
  preimage: string,
  contractCellDep: any
): Promise<string> {
  const fromScript = (await ccc.Address.fromString(lockAddress, cccClient)).script;
  const toScript = (await ccc.Address.fromString(receiverAddress, cccClient)).script;

  // Since we don't have a private key, we use a read-only script signer
  const readSigner = new ccc.SignerCkbScriptReadonly(cccClient, fromScript);

  // Build transaction
  const tx = ccc.Transaction.from({
    outputs: [{ 
      lock: toScript,
      capacity: ccc.fixedPointFrom(amountInCKB)
    }],
    outputsData: ["0x"],
  });

  // Add the required cellDeps (our contract script cell and the JS VM engine cell)
  await tx.addCellDeps(contractCellDep);
  
  const testnetJsVmDep = systemScripts["testnet"]["ckb_js_vm"].script.cellDeps[0].cellDep;
  await tx.addCellDeps(testnetJsVmDep);

  // Calculate minimum required capacity for inputs
  const occupiedSize = ccc.CellOutput.from({
    capacity: 1000n,
    lock: fromScript,
  }).occupiedSize;

  // Gather matching input cells from the Hash-Lock address
  await tx.completeInputsByCapacity(
    readSigner,
    ccc.fixedPointFrom(occupiedSize)
  );

  // Handle change outputs (refund any remaining capacity minus fee)
  const balanceDiff = (await tx.getInputsCapacity(cccClient)) - tx.getOutputsCapacity();
  const txFee = 100000n; // 0.001 CKB (in Shannons)
  
  if (balanceDiff > ccc.fixedPointFrom(occupiedSize) + txFee) {
    tx.addOutput({
      lock: fromScript,
      capacity: balanceDiff - txFee,
    });
  } else if (balanceDiff > txFee) {
    // If not enough for occupied size, we must drain the whole cell (adjust output capacity)
    tx.outputs[0].capacity = (await tx.getInputsCapacity(cccClient)) - txFee;
  }

  // Set the preimage in the lock field of witness at index 0
  const hexPreimage = stringToHex(preimage);
  const newWitnessArgs = new ccc.WitnessArgs(hexPreimage as `0x${string}`);
  tx.setWitnessArgsAt(0, newWitnessArgs);

  // Send the transaction directly (no signer.sign required, the on-chain VM executes verification)
  const txHash = await cccClient.sendTransaction(tx);
  return txHash;
}

// Fund the Lock address using a connected browser signer (e.g. JoyID/Passkey wallet)
export async function fundLockAddressWithSigner(
  signer: ccc.Signer,
  lockAddress: string,
  amountInCKB: string
): Promise<string> {
  const receiverScript = (await ccc.Address.fromString(lockAddress, cccClient)).script;

  // Build output cell containing the CKB amount
  const tx = ccc.Transaction.from({
    outputs: [{ 
      lock: receiverScript,
      capacity: ccc.fixedPointFrom(amountInCKB)
    }],
    outputsData: ["0x"],
  });

  // Automatically find inputs and calculate fees
  await tx.completeInputsByCapacity(signer);
  await tx.completeFeeBy(signer, 2000);

  // Sign and broadcast
  const txHash = await signer.sendTransaction(tx);
  return txHash;
}

