# CKB Hash-Lock Smart Contract & DApp Portal

This document presents a comprehensive technical reflection on the architectural decisions, challenges, and debugging sessions encountered while onboarding to CKB (Nervos Network) and building the premium React Hash-Lock smart contract portal.

---

## 🏗️ Architectural Overview & Design Decisions

### 1. Smart Contract Runtime (`ckb_js_vm`)
Rather than compiling Rust/C contracts to RISC-V binary execution layers, we opted for **JavaScript execution on-chain** using CKB's native `ckb_js_vm`.
- **Rationale**: Reduces local toolchain complexity (avoiding heavy Rust/C RISC-V compiler installations on Windows). Raw JavaScript contract code is directly loaded into cell data and executed on-chain, lowering barrier to entry.
- **Contract Logic**: The Hash-Lock contract enforces that the transaction witness preimage (retrieved from the lock script arguments offset by 35 bytes) hashes via Blake2b-256 to match the expected hash.

### 2. Browser-Native Biometrics (WebAuthn / Passkeys)
We integrated CKB's Common Connector (`@ckb-ccc/connector-react`) to interface with browser-native biometric wallets (JoyID).
- **Rationale**: Removes the requirement of exporting/handling private keys in the browser. Users sign the contract deployment and funding transactions using native device authentication (Windows Hello, TouchID, FaceID).

---

## 🛠️ Challenges & Key Troubleshooting Phases

### 🛠️ Phase 1: Transaction Fee Rejection (`PoolRejectedTransactionByMinFeeRate`)
* **Problem**: When deploying or locking funds via JoyID (Passkey), transactions failed with a CKB node pool rejection: `The min fee rate is 1000 shannons/KW, requiring a transaction fee of at least 22146 shannons, but the fee provided is only 21586`.
* **Investigation**: WebAuthn cryptographic assertions (signatures) are significantly larger than standard Secp256k1 cryptographic signatures. Standard fee estimation calculations at `1000 shannons/KW` happen *pre-signing* and underestimate the final post-signed transaction size.
* **Resolution**: Updated all transaction fee estimation helper functions (`completeFeeBy(signer, 2000)`) in both the frontend components and core backend utilities to use `2000 shannons/KW`, successfully accommodating the larger passkey signatures.

### 🛠️ Phase 2: Dynamic Import Query Bypassing in Vite
* **Problem**: In the event handler for contract deployment, dynamic imports with raw file loaders (e.g. `await import("./deployment/hash-lock.js?raw")`) failed or returned `undefined` for `.default` under the Vite development server.
* **Investigation**: Vite's bundler only analyzes static query suffixes during build analysis. Runtime dynamic imports do not evaluate raw query suffixes (`?raw`) correctly and treat them as module loaders.
* **Resolution**: Replaced the dynamic runtime loader with a static, module-level raw import:
  ```typescript
  import hashLockContractCode from "./deployment/hash-lock.js?raw";
  ```

### 🛠️ Phase 3: Hex Prefix Injection & React Render Crashing
* **Problem**: The app interface loaded correctly initially but went completely blank/black immediately upon contract deployment or page refresh.
* **Investigation**: 
  - Checked development server error logs and found a critical client runtime trace: `Error: Invalid bytes 0x0000...0x...`.
  - Analyzed the hex string structure and discovered that the preimage hash was stored in `localStorage` starting with `0x`.
  - When the utility constructed the script arguments (`"0x0000" + contractCodeHash.slice(2) + hashTypeByte + preimageHash`), it double-injected `0x` in the middle of the byte sequence (e.g. `...000xcb6c...`).
  - Upon calling `ccc.Script.from(lockScript)` in `generateHashLockAccount` (inside a `useEffect`), the script parser threw an invalid byte error. Since this uncaught error occurred during the render/mount phase, React unmounted the entire component tree, causing a blank screen.
* **Resolution**: Added strict input sanitization to `generateHashLockAccount` in `src/lib.ts`:
  ```typescript
  const cleanCodeHash = contractCodeHash.startsWith("0x") ? contractCodeHash.slice(2) : contractCodeHash;
  const cleanHash = hash.startsWith("0x") ? hash.slice(2) : hash;
  ```
  Additionally, added robust optional chaining (`contractScripts?.codeHash`) to the render layout to prevent any potential render-phase crashes.

---

## 📈 Key Takeaways

1. **Strict Input Sanitization on Hex Strings**: Cryptographic libraries like `@ckb-ccc/core` expect clean, normalized hexadecimal formats. Double `0x` injection or missing prefixes can silently pass TypeScript compilation but trigger immediate runtime failures.
2. **React Render Safety**: Always isolate component state parsing from the main execution tree. Using optional chaining and validating keys before setting boolean render states (like `isContractLoaded`) prevents UI blankouts.
3. **Passkey Signature Size Variations**: Developers building on CKB or other UTXO chains must account for signature size variances. Dynamic signature sizes (like WebAuthn) require safe margins for fee calculation rates.
