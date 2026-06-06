#!/usr/bin/env node

import { execSync } from "child_process";
import path from "path";
import fs from "fs";

function buildContract(contractName) {
  if (!contractName) {
    console.error("Usage: node build-contract.js <contract-name>");
    process.exit(1);
  }

  const contractDir = path.join("contracts", contractName);
  const srcDir = path.join(contractDir, "src");
  const distDir = path.join("dist");

  // Check if contract exists
  if (!fs.existsSync(contractDir)) {
    console.error(`Contract '${contractName}' not found in contracts directory!`);
    process.exit(1);
  }

  const tsFile = path.join(srcDir, "index.ts");
  const jsFile = path.join(srcDir, "index.js");
  let srcFile = fs.existsSync(tsFile) ? tsFile : (fs.existsSync(jsFile) ? jsFile : null);

  if (!srcFile) {
    console.error(`No index.ts or index.js found in ${srcDir}`);
    process.exit(1);
  }

  // Ensure dist directory exists
  fs.mkdirSync(distDir, { recursive: true });

  const outputJsFile = path.join(distDir, `${contractName}.js`);
  const srcDeployDir = path.join("src", "deployment");
  const outputSrcJsFile = path.join(srcDeployDir, `${contractName}.js`);

  console.log(`Building ${contractName} from ${srcFile}...`);

  try {
    console.log("  Packaging with esbuild...");
    
    // We run esbuild command
    const esbuildCmd = [
      "npx.cmd esbuild",
      "--platform=neutral",
      "--minify",
      "--bundle",
      "--external:@ckb-js-std/bindings",
      "--target=es2022",
      `"${srcFile}"`,
      `--outfile="${outputJsFile}"`
    ].join(" ");

    execSync(esbuildCmd, { stdio: "inherit" });

    // Copy to src/deployment for React/Vite assets visibility
    fs.mkdirSync(srcDeployDir, { recursive: true });
    fs.copyFileSync(outputJsFile, outputSrcJsFile);

    console.log(`  ✅ Contract '${contractName}' built successfully!`);
    console.log(`     📄 JavaScript (dist): ${outputJsFile}`);
    console.log(`     📄 JavaScript (src): ${outputSrcJsFile}`);
  } catch (error) {
    console.error(`❌ Build failed for '${contractName}':`, error.message);
    process.exit(1);
  }
}

const contractName = process.argv[2] || "hash-lock";
buildContract(contractName);
