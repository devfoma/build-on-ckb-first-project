#!/usr/bin/env node

import { ccc } from "@ckb-ccc/core";
import fs from "fs";
import path from "path";

// Helper to parse arguments
function parseArgs() {
  const args = process.argv.slice(2);
  const parsed = {
    network: "testnet",
    privkey: null,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === "--network" && i + 1 < args.length) {
      parsed.network = args[i + 1];
      i++;
    } else if (arg === "--privkey" && i + 1 < args.length) {
      parsed.privkey = args[i + 1];
      i++;
    }
  }

  return parsed;
}

async function main() {
  const options = parseArgs();
  const network = options.network;
  const privkey = options.privkey;

  if (!privkey) {
    console.error("❌ Error: Private key is required to deploy scripts to testnet.");
    console.error("   Usage: node scripts/deploy.js --privkey <your_testnet_private_key>");
    process.exit(1);
  }

  const contractPath = path.join("dist", "hash-lock.js");
  if (!fs.existsSync(contractPath)) {
    console.error(`❌ Error: Bundle file '${contractPath}' not found.`);
    console.error("   Please run 'npm run build:contract' first.");
    process.exit(1);
  }

  console.log(`🌐 Connecting to CKB ${network}...`);
  const client = network === "mainnet" 
    ? new ccc.ClientPublicMainnet() 
    : new ccc.ClientPublicTestnet();

  const signer = new ccc.SignerCkbPrivateKey(client, privkey);
  const deployerAddress = await signer.getAddressObjSecp256k1();

  console.log(`🔑 Deploying using account: ${deployerAddress.toString()}`);

  const balance = await client.getBalance([deployerAddress.script]);
  const balanceCkb = Number(balance) / 100000000;
  console.log(`💰 Account Balance: ${balanceCkb.toFixed(2)} CKB`);

  if (balanceCkb < 21000) {
    console.error("❌ Error: Insufficient CKB balance to deploy contract.");
    console.error("   The bundled JS contract requires about 20.8k CKB of cell capacity.");
    process.exit(1);
  }

  // Load contract code
  console.log(`📄 Reading contract bundle from ${contractPath}...`);
  const codeBytes = fs.readFileSync(contractPath);
  const codeHex = ccc.hexFrom(codeBytes);

  console.log(`📦 Creating CKB transaction to deploy contract (${(codeBytes.length / 1024).toFixed(2)} KB)...`);

  // Build the deployment transaction
  const tx = ccc.Transaction.from({
    outputs: [{
      lock: deployerAddress.script,
    }],
    outputsData: [codeHex],
  });

  // Automatically fill inputs and fee
  console.log("⚡ Completing transaction inputs and calculating fee...");
  await tx.completeInputsByCapacity(signer);
  await tx.completeFeeBy(signer, 1000);

  console.log("✍️ Signing and sending transaction...");
  const txHash = await signer.sendTransaction(tx);
  console.log(`🚀 Transaction broadcasted! Tx Hash: ${txHash}`);

  console.log("⏳ Waiting for transaction confirmation on-chain (this may take up to 20-30 seconds)...");
  const receipt = await client.waitTransaction(txHash);

  if (receipt) {
    console.log("✅ Transaction successfully committed!");
  } else {
    console.warn("⚠️ Warning: Could not verify transaction completion. Please check explorer.");
  }

  // Calculate the code hash of the deployed script (Blake2b_256 hash of the data)
  const codeHash = ccc.hashCkb(codeBytes);
  console.log(`🔍 Smart Contract Code Hash (hashType: data): ${codeHash}`);

  // Create scripts.json metadata format
  const scriptsMetadata = {
    [network]: {
      "hash-lock.bc": {
        "codeHash": codeHash,
        "hashType": "data",
        "cellDeps": [
          {
            "cellDep": {
              "outPoint": {
                "txHash": txHash,
                "index": 0
              },
              "depType": "code"
            }
          }
        ]
      },
      // Keep it under both names for compatibility
      "hash-lock.js": {
        "codeHash": codeHash,
        "hashType": "data",
        "cellDeps": [
          {
            "cellDep": {
              "outPoint": {
                "txHash": txHash,
                "index": 0
              },
              "depType": "code"
            }
          }
        ]
      }
    }
  };

  // Ensure deployment folder exists
  const deployDir = path.join("src", "deployment");
  fs.mkdirSync(deployDir, { recursive: true });
  fs.writeFileSync(path.join(deployDir, "scripts.json"), JSON.stringify(scriptsMetadata, null, 2));

  console.log("🎉 Smart contract successfully deployed and registered!");
  console.log(`📁 Deployment metadata saved to src/deployment/scripts.json`);
}

main().catch((err) => {
  console.error("❌ Deployment failed with error:", err);
  process.exit(1);
});
