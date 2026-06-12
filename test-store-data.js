import { ccc, KnownScript } from "@ckb-ccc/core";
import fs from "fs";

// Load devnet system scripts
const systemScripts = JSON.parse(fs.readFileSync("./system-scripts.json", "utf-8"));

const DEVNET_SCRIPTS = {
  [KnownScript.Secp256k1Blake160]: systemScripts["devnet"].secp256k1_blake160_sighash_all.script,
  [KnownScript.Secp256k1Multisig]: systemScripts["devnet"].secp256k1_blake160_multisig_all.script,
  [KnownScript.AnyoneCanPay]: systemScripts["devnet"].anyone_can_pay.script,
  [KnownScript.OmniLock]: systemScripts["devnet"].omnilock.script,
  [KnownScript.XUdt]: systemScripts["devnet"].xudt.script,
  [KnownScript.NervosDao]: systemScripts["devnet"].dao.script,
};

// Establish connection to local OffCKB node (RPC Proxy on 28114)
const client = new ccc.ClientPublicTestnet({
  url: "http://localhost:28114",
  scripts: DEVNET_SCRIPTS,
});

// Helper for UTF8 <-> Hex
function utf8ToHex(str) {
  const bytes = new TextEncoder().encode(str);
  return ccc.hexFrom(bytes);
}

function hexToUtf8(hex) {
  const bytes = ccc.bytesFrom(hex);
  return new TextDecoder().decode(bytes);
}

async function run() {
  console.log("=== CKB STORE DATA ON CELL TUTORIAL RUN ===\n");

  // Step 1: Encode Message
  const message = "Hello CKB, Store Data on Cell Campaign Completed successfully!";
  console.log("1. Encoding Message...");
  console.log(`   Original Message: "${message}"`);
  const hexMessage = utf8ToHex(message);
  console.log(`   Encoded Hex:      ${hexMessage}`);

  // Step 2: Decode Message
  console.log("\n2. Decoding Message...");
  const decodedMessage = hexToUtf8(hexMessage);
  console.log(`   Decoded Message:  "${decodedMessage}"`);

  // Step 3: Setup Signer (using OffCKB Account #1)
  const privateKey = "0x9f315d5a9618a39fdc487c7a67a8581d40b045bd7a42d83648ca80ef3b2cb4a1";
  const signer = new ccc.SignerCkbPrivateKey(client, privateKey);
  const signerAddress = await signer.getAddressObjSecp256k1();
  const addressStr = signerAddress.toString();
  console.log(`\n3. Setting up Signer (Account #1)...`);
  console.log(`   CKB Address:      ${addressStr}`);

  // Check balance
  const balance = await client.getBalance([signerAddress.script]);
  console.log(`   Current Balance:  ${(Number(balance) / 100000000).toFixed(2)} CKB`);

  // Step 4: Build Transaction to Store Data
  console.log("\n4. Building Transaction to Store Data on Cell...");
  const tx = ccc.Transaction.from({
    outputs: [{ lock: signerAddress.script }],
    outputsData: [hexMessage],
  });

  // Complete inputs and calculate fees
  console.log("   Selecting inputs and estimating fee...");
  await tx.completeInputsByCapacity(signer);
  await tx.completeFeeBy(signer, 1000);

  // Print transaction detail
  console.log("   Transaction built successfully!");

  // Step 5: Sign & Send Transaction
  console.log("\n5. Signing and Sending Transaction...");
  const txHash = await signer.sendTransaction(tx);
  console.log(`   Transaction Hash: ${txHash}`);

  // Step 6: Wait for confirmation
  console.log("\n6. Waiting for transaction to be committed on-chain...");
  const receipt = await client.waitTransaction(txHash);
  if (receipt) {
    console.log("   Transaction committed successfully!");
  } else {
    console.log("   Wait transaction timed out/failed, retrieving anyway...");
  }

  // Step 7: Retrieve Cell Live Data & Decode
  console.log("\n7. Retrieving Live Cell Data...");
  const cell = await client.getCellLive({ txHash, index: "0x0" }, true);
  if (!cell) {
    throw new Error("Cell not found!");
  }
  const retrievedHex = cell.outputData;
  console.log(`   Retrieved Cell Data (Hex): ${retrievedHex}`);
  const retrievedMessage = hexToUtf8(retrievedHex);
  console.log(`   Retrieved & Decoded Message:  "${retrievedMessage}"`);

  console.log("\n=== CAMPAIGN STEPS VERIFIED & COMPLETED! ===");
}

run().catch((err) => {
  console.error("\n❌ Error running script:", err);
  process.exit(1);
});
