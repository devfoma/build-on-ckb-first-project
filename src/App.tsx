import { useEffect, useState, useRef } from "react";
import "./App.css";
import {
  capacityOf,
  calculateBlake2bHash,
  generateHashLockAccount,
  fundLockAddress,
  fundLockAddressWithSigner,
  unlockLockAddress,
} from "./lib";
import type { CkbAccount } from "./lib";
import { ccc } from "@ckb-ccc/connector-react";

import deployedScripts from "./deployment/scripts.json";
import hashLockContractCode from "./deployment/hash-lock.js?raw";

type LogMessage = {
  timestamp: string;
  type: "info" | "success" | "error" | "warning";
  content: string;
};

export default function App() {
  const { wallet, open, disconnect } = ccc.useCcc();
  const signer = ccc.useSigner();

  const [privKey, setPrivKey] = useState("");
  const [deployerAddress, setDeployerAddress] = useState(
    "ckt1qrfrwcdnvssswdwpn3s9v8fp87emat306ctjwsm3nmlkjg8qyza2cqgqqy4jgresfjruua6np660a43gqe8lhw4rrqvgq62d"
  );
  const [deployerBalance, setDeployerBalance] = useState<string>("0");

  // State for preimage and hashing
  const [preimage, setPreimage] = useState("secret-knowledge-base");
  const [preimageHash, setPreimageHash] = useState("");

  // Lock account details
  const [lockAccount, setLockAccount] = useState<CkbAccount | null>(null);
  const [lockBalance, setLockBalance] = useState<string>("0");

  // Form parameters
  const [fundAmount, setFundAmount] = useState("100");
  const [receiverAddress, setReceiverAddress] = useState(
    "ckt1qrfrwcdnvssswdwpn3s9v8fp87emat306ctjwsm3nmlkjg8qyza2cqgqqy4jgresfjruua6np660a43gqe8lhw4rrqvgq62d"
  );

  // Contract info state
  const [contractScripts, setContractScripts] = useState<any>(null);
  const [isContractLoaded, setIsContractLoaded] = useState(false);

  // Status and logs
  const [logs, setLogs] = useState<LogMessage[]>([]);
  const [activeStep, setActiveStep] = useState(1);
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  
  const logsContainerRef = useRef<HTMLDivElement>(null);

  // Helper to add logs
  const addLog = (content: string, type: LogMessage["type"] = "info") => {
    const timeStr = new Date().toLocaleTimeString();
    setLogs((prev) => [...prev, { timestamp: timeStr, type, content }]);
  };

  // Scroll to bottom of logs
  useEffect(() => {
    if (logsContainerRef.current) {
      logsContainerRef.current.scrollTop = logsContainerRef.current.scrollHeight;
    }
  }, [logs]);

  // Load deployed scripts metadata
  const checkContractDeployment = () => {
    const localContract = localStorage.getItem("deployed_contract");
    if (localContract) {
      try {
        const parsed = JSON.parse(localContract);
        if (parsed && parsed.codeHash) {
          setContractScripts(parsed);
          setIsContractLoaded(true);
          setActiveStep(3);
          addLog("Loaded contract metadata from local storage!", "success");
          return;
        }
      } catch (err) {}
    }

    const scripts = deployedScripts as any;
    if (scripts && scripts["testnet"] && scripts["testnet"]["hash-lock.js"]) {
      setContractScripts(scripts["testnet"]["hash-lock.js"]);
      setIsContractLoaded(true);
      setActiveStep(3); // Direct to Step 3: Funding since contract is ready
      addLog("Contract deployment metadata successfully loaded from scripts.json!", "success");
    } else {
      setIsContractLoaded(false);
      setActiveStep(2); // Ask to run deployment
      addLog("Deployment metadata not found. Connect your wallet (JoyID/Passkey) and click 'Deploy Smart Contract' below!", "warning");
    }
  };

  useEffect(() => {
    // Wait for dynamic import
    const timer = setTimeout(() => {
      checkContractDeployment();
    }, 500);
    return () => clearTimeout(timer);
  }, []);

  // Update deployer balance
  const updateBalances = async () => {
    if (deployerAddress) {
      const balance = await capacityOf(deployerAddress);
      setDeployerBalance((Number(balance) / 100000000).toFixed(2));
    }
    if (lockAccount) {
      const balance = await capacityOf(lockAccount.address);
      setLockBalance((Number(balance) / 100000000).toFixed(2));
    }
  };

  useEffect(() => {
    updateBalances();
    // Poll balances every 10 seconds
    const interval = setInterval(updateBalances, 10000);
    return () => clearInterval(interval);
  }, [deployerAddress, lockAccount]);

  // Sync wallet signer to deployerAddress
  useEffect(() => {
    if (signer) {
      signer.getRecommendedAddress().then((addressStr) => {
        setDeployerAddress(addressStr);
        addLog(`Wallet connected (${wallet?.name || "Passkey"}). Address: ${addressStr}`, "success");
      });
    } else if (!privKey) {
      setDeployerAddress("ckt1qrfrwcdnvssswdwpn3s9v8fp87emat306ctjwsm3nmlkjg8qyza2cqgqqy4jgresfjruua6np660a43gqe8lhw4rrqvgq62d");
      setDeployerBalance("0");
    }
  }, [signer]);

  // Calculate preimage hash in real-time
  useEffect(() => {
    if (preimage) {
      const hash = calculateBlake2bHash(preimage);
      setPreimageHash("0x" + hash);
    } else {
      setPreimageHash("");
    }
  }, [preimage]);

  // Handle Private Key Change
  const handlePrivateKeyInput = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const key = e.target.value.trim();
    if (/^0x[0-9a-fA-F]{64}$/.test(key)) {
      setPrivKey(key);
      try {
        const tempSigner = new ccc.SignerCkbPrivateKey(new ccc.ClientPublicTestnet(), key);
        const lockObj = await tempSigner.getAddressObjSecp256k1();
        const addressStr = lockObj.toString();
        setDeployerAddress(addressStr);
        addLog(`Private key loaded. Address: ${addressStr}`, "success");
      } catch (err: any) {
        addLog(`Failed to derive address from private key: ${err.message}`, "error");
      }
    } else if (key !== "") {
      addLog("Invalid private key: Must be 32 bytes hex prefixed with 0x.", "warning");
    }
  };

  // Handle contract deployment directly from UI using signer/passkey or privKey
  const handleDeployContract = async () => {
    if (!signer && !privKey) {
      alert("Please connect your wallet or load your private key first.");
      return;
    }

    setLoadingAction("deploying");
    addLog("Loading compiled contract code...", "info");

    const client = new ccc.ClientPublicTestnet();
    try {
      // Use statically imported contract js code
      const hashLockCode = hashLockContractCode;
      const codeBytes = new TextEncoder().encode(hashLockCode);
      const codeHex = ccc.hexFrom(codeBytes);

      addLog(`Building CKB deployment transaction (${(codeBytes.length / 1024).toFixed(2)} KB)...`, "info");
      
      let tx;
      if (signer) {
        const addressStr = await signer.getRecommendedAddress();
        const signerAddressObj = await ccc.Address.fromString(addressStr, client);
        tx = ccc.Transaction.from({
          outputs: [{ lock: signerAddressObj.script }],
          outputsData: [codeHex],
        });
        
        addLog("Selecting inputs and estimating transaction fees...", "info");
        await tx.completeInputsByCapacity(signer);
        await tx.completeFeeBy(signer, 2000);

        addLog("Prompting passkey authentication to sign and send transaction...", "info");
        const txHash = await signer.sendTransaction(tx);
        addLog(`Deployment transaction sent! Tx Hash: ${txHash}`, "success");
        addLog("Waiting for transaction confirmation on CKB Testnet (may take 20-30s)...", "info");
        
        setLoadingAction("waiting_deploy");
        const receipt = await client.waitTransaction(txHash);

        if (receipt) {
          const codeHash = ccc.hashCkb(codeBytes);
          const metadata = {
            codeHash,
            hashType: "data",
            cellDeps: [
              {
                cellDep: {
                  outPoint: {
                    txHash,
                    index: 0
                  },
                  depType: "code"
                }
              }
            ]
          };

          localStorage.setItem("deployed_contract", JSON.stringify(metadata));
          setContractScripts(metadata);
          setIsContractLoaded(true);
          setActiveStep(3);
          addLog("Smart contract successfully deployed via passkey on CKB Testnet!", "success");
          addLog(`Smart Contract Code Hash: ${codeHash}`, "info");
        } else {
          addLog("Deployment transaction timed out or failed.", "error");
        }
      } else {
        const deployerSigner = new ccc.SignerCkbPrivateKey(client, privKey);
        const deployerAddressObj = await deployerSigner.getAddressObjSecp256k1();
        tx = ccc.Transaction.from({
          outputs: [{ lock: deployerAddressObj.script }],
          outputsData: [codeHex],
        });

        addLog("Selecting inputs and estimating transaction fees...", "info");
        await tx.completeInputsByCapacity(deployerSigner);
        await tx.completeFeeBy(deployerSigner, 2000);

        addLog("Signing and sending transaction...", "info");
        const txHash = await deployerSigner.sendTransaction(tx);
        addLog(`Deployment transaction sent! Tx Hash: ${txHash}`, "success");
        addLog("Waiting for transaction confirmation on CKB Testnet (may take 20-30s)...", "info");

        setLoadingAction("waiting_deploy");
        const receipt = await client.waitTransaction(txHash);

        if (receipt) {
          const codeHash = ccc.hashCkb(codeBytes);
          const metadata = {
            codeHash,
            hashType: "data",
            cellDeps: [
              {
                cellDep: {
                  outPoint: {
                    txHash,
                    index: 0
                  },
                  depType: "code"
                }
              }
            ]
          };

          localStorage.setItem("deployed_contract", JSON.stringify(metadata));
          setContractScripts(metadata);
          setIsContractLoaded(true);
          setActiveStep(3);
          addLog("Smart contract successfully deployed on CKB Testnet!", "success");
          addLog(`Smart Contract Code Hash: ${codeHash}`, "info");
        } else {
          addLog("Deployment transaction timed out or failed.", "error");
        }
      }
    } catch (err: any) {
      addLog(`Deployment failed: ${err.message || err}`, "error");
    } finally {
      setLoadingAction(null);
    }
  };

  // Generate Hash Lock Address
  useEffect(() => {
    if (preimageHash && isContractLoaded && contractScripts) {
      const account = generateHashLockAccount(
        preimageHash,
        contractScripts.codeHash,
        contractScripts.hashType
      );
      setLockAccount(account);
    } else {
      setLockAccount(null);
    }
  }, [preimageHash, isContractLoaded, contractScripts]);

  // Lock / Fund Transaction
  const handleLockFunds = async () => {
    if (!signer && !privKey) {
      alert("Please load your private key or connect your wallet to sign the funding transaction.");
      return;
    }
    if (!lockAccount) {
      alert("Hash lock account not initialized.");
      return;
    }

    setLoadingAction("funding");
    addLog(`Building transfer of ${fundAmount} CKB to Hash-Lock address...`, "info");
    
    try {
      let txHash;
      if (signer) {
        txHash = await fundLockAddressWithSigner(signer, lockAccount.address, fundAmount);
      } else {
        txHash = await fundLockAddress(privKey, lockAccount.address, fundAmount);
      }
      addLog(`Lock transaction broadcasted! Tx Hash: ${txHash}`, "success");
      addLog("Waiting for transaction confirmation on CKB Testnet...", "info");
      
      setLoadingAction("waiting_funding");
      
      const client = new ccc.ClientPublicTestnet();
      const receipt = await client.waitTransaction(txHash);
      
      if (receipt) {
        addLog("CKB successfully locked under the hash contract!", "success");
        setActiveStep(4); // Advance to unlocking step
      } else {
        addLog("Transaction committed but receipt could not be verified.", "warning");
      }
      
      await updateBalances();
    } catch (err: any) {
      addLog(`Lock failed: ${err.message || err}`, "error");
    } finally {
      setLoadingAction(null);
    }
  };

  // Unlock Transaction
  const handleUnlockFunds = async () => {
    if (!lockAccount) {
      alert("Hash-lock account is missing.");
      return;
    }
    if (Number(lockBalance) <= 61) {
      alert("Locked balance must be greater than 61 CKB to unlock due to CKB size constraints.");
      return;
    }

    const userInput = prompt("🔓 Enter the secret preimage to unlock the CKB:");
    if (userInput === null) return;
    
    if (userInput !== preimage) {
      if (!confirm("⚠️ Warning: The preimage you entered does not match the generated hash lock preimage. The transaction WILL fail on-chain. Proceed anyway to test script validation?")) {
        return;
      }
    }

    setLoadingAction("unlocking");
    addLog("Creating read-only script transaction to unlock CKB...", "info");
    
    try {
      const cellDep = contractScripts.cellDeps[0].cellDep;
      const amountToWithdraw = (Number(lockBalance) - 0.001).toString(); // leave 0.001 CKB for fee
      
      addLog(`Building unlock transaction. Receiver: ${receiverAddress}`, "info");
      
      const txHash = await unlockLockAddress(
        lockAccount.address,
        receiverAddress,
        amountToWithdraw,
        userInput,
        cellDep
      );
      
      addLog(`Unlock transaction broadcasted! Tx Hash: ${txHash}`, "success");
      addLog("Waiting for transaction verification on CKB Testnet...", "info");
      
      setLoadingAction("waiting_unlock");
      
      const client = new ccc.ClientPublicTestnet();
      const receipt = await client.waitTransaction(txHash);
      
      if (receipt) {
        addLog("Success! On-chain smart contract verified preimage and unlocked all funds!", "success");
      } else {
        addLog("Transaction submitted, check explorer for validation result.", "warning");
      }
      
      await updateBalances();
    } catch (err: any) {
      addLog(`Unlock transaction rejected: Preimage verification failed or script error. Detail: ${err.message || err}`, "error");
    } finally {
      setLoadingAction(null);
    }
  };

  return (
    <div className="app-container">
      {/* Header */}
      <header className="app-header">
        <div className="logo-section">
          <h1>CKB HASH-LOCK PORTAL</h1>
          <p>Deploy JavaScript Smart Contracts & Interact with CKB Cell Locks on Testnet</p>
        </div>
        <div className="network-badge">CKB Testnet (Pudge)</div>
      </header>

      {/* Progress Timeline */}
      <div className="steps-timeline glass-panel">
        <div className={`timeline-step ${activeStep >= 1 ? "completed" : ""}`}>
          <div className="step-circle">1</div>
          <div className="step-title">Write Code</div>
        </div>
        <div className={`timeline-step ${activeStep === 2 ? "active" : activeStep > 2 ? "completed" : ""}`}>
          <div className="step-circle">2</div>
          <div className="step-title">Deploy Contract</div>
        </div>
        <div className={`timeline-step ${activeStep === 3 ? "active" : activeStep > 3 ? "completed" : ""}`}>
          <div className="step-circle">3</div>
          <div className="step-title">Fund Lock Address</div>
        </div>
        <div className={`timeline-step ${activeStep === 4 ? "active" : ""}`}>
          <div className="step-circle">4</div>
          <div className="step-title">Unlock CKB</div>
        </div>
      </div>

      {/* Main Dashboard Layout */}
      <main className="dashboard-grid">
        
        {/* Left Side: Private Key and Configuration */}
        <section className="glass-panel flex flex-col">
          <div className="panel-header">
            <h2>
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="hero-icon" style={{ color: "var(--accent-primary)" }}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25a3 3 0 0 1 3 3m3 0a6 6 0 0 1-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1 1 21.75 8.25Z" />
              </svg>
              ACCOUNT CONFIGURATION
            </h2>
            <button className="badge-status success" onClick={updateBalances}>Refresh</button>
          </div>
          <div className="panel-content">
            <div className="form-group">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                <label style={{ margin: 0 }}>Wallet Connectivity</label>
                {wallet ? (
                  <button className="badge-status warning" onClick={disconnect} style={{ border: "none", cursor: "pointer" }}>
                    Disconnect
                  </button>
                ) : (
                  <button className="badge-status success" onClick={open} style={{ border: "none", cursor: "pointer" }}>
                    Connect Wallet
                  </button>
                )}
              </div>
              
              {wallet && (
                <div style={{ padding: "10px", background: "rgba(168, 85, 247, 0.08)", borderRadius: "6px", fontSize: "13px", marginBottom: "16px" }}>
                  Connected to <strong style={{ color: "var(--accent-primary)" }}>{wallet.name}</strong> (Passkey / WebAuthn Active)
                </div>
              )}

              <label htmlFor="priv-key-input">Or Signer Private Key (Testnet)</label>
              <input
                id="priv-key-input"
                type="password"
                placeholder={wallet ? "Disabled (Wallet Connected)" : "Enter private key (starts with 0x)"}
                className="form-input font-mono"
                disabled={!!wallet}
                onChange={handlePrivateKeyInput}
              />
              <p style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "6px" }}>
                Derives SECP256K1 address and signs transactions locally.
              </p>
            </div>

            <div className="address-info-card">
              <div className="address-info-row">
                <span className="address-label">CKB Account:</span>
                <span className="address-value font-mono">{deployerAddress}</span>
              </div>
              <div className="address-info-row">
                <span className="address-label">Available Balance:</span>
                <span className="address-value" style={{ fontWeight: "700", color: "var(--accent-primary)" }}>
                  {deployerBalance} CKB
                </span>
              </div>
            </div>

            {/* Smart Contract Meta Panel */}
            <div className="form-group" style={{ marginTop: "24px" }}>
              <label>Smart Contract Status</label>
              <div className="address-info-card" style={{ borderStyle: "solid", borderColor: isContractLoaded ? "rgba(16, 185, 129, 0.2)" : "rgba(239, 68, 68, 0.2)" }}>
                <div className="address-info-row">
                  <span className="address-label">Contract:</span>
                  <span className="address-value font-mono">hash-lock.js</span>
                </div>
                <div className="address-info-row">
                  <span className="address-label">On-Chain Code Hash:</span>
                  <span className="address-value font-mono">
                    {isContractLoaded && contractScripts?.codeHash ? contractScripts.codeHash.slice(0, 24) + "..." : "Not Deployed"}
                  </span>
                </div>
                <div className="address-info-row">
                  <span className="address-label">Hash Type:</span>
                  <span className="address-value font-mono">
                    {isContractLoaded && contractScripts?.hashType ? contractScripts.hashType : "N/A"}
                  </span>
                </div>
                {!isContractLoaded ? (
                  <div style={{ marginTop: "12px", display: "flex", flexDirection: "column", gap: "8px" }}>
                    <button
                      className="app-btn btn-primary"
                      disabled={loadingAction !== null || (!privKey && !signer)}
                      onClick={handleDeployContract}
                    >
                      {loadingAction === "deploying" ? "Deploying..." : loadingAction === "waiting_deploy" ? "Confirming..." : "Deploy Smart Contract"}
                    </button>
                    {!privKey && !signer && (
                      <p style={{ fontSize: "11px", color: "#f87171", margin: 0 }}>
                        ⚠️ Connect your wallet or input a Private Key to deploy.
                      </p>
                    )}
                  </div>
                ) : (
                  <button
                    className="app-btn btn-secp"
                    style={{ marginTop: "12px", background: "rgba(239, 68, 68, 0.15)", border: "1px solid rgba(239, 68, 68, 0.3)", color: "#f87171" }}
                    onClick={() => {
                      if (confirm("Redeploy contract? This will reset your local storage link.")) {
                        localStorage.removeItem("deployed_contract");
                        setIsContractLoaded(false);
                        setContractScripts(null);
                        setActiveStep(2);
                        addLog("Reset contract scripts status.", "info");
                      }
                    }}
                  >
                    Reset & Redeploy Contract
                  </button>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* Right Side: Contract Interactions */}
        <section className="glass-panel">
          <div className="panel-header">
            <h2>
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="hero-icon" style={{ color: "var(--accent-primary)" }}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.43l-1.003.828c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.43l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.645-.869L9.594 3.94Z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
              </svg>
              INTERACT WITH CONTRACT
            </h2>
            <span className={`badge-status ${isContractLoaded ? "success" : "warning"}`}>
              {isContractLoaded ? "Ready" : "Deployment Required"}
            </span>
          </div>
          
          <div className="panel-content">
            {/* Step 3: Build Lock Script & Fund */}
            <div style={{ opacity: isContractLoaded ? 1 : 0.4, pointerEvents: isContractLoaded ? "auto" : "none" }}>
              <h3 style={{ fontSize: "16px", marginBottom: "16px", display: "flex", alignItems: "center", gap: "8px" }}>
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="hero-icon" style={{ color: "var(--accent-primary)" }}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
                </svg>
                Step 1: Lock CKB Under Secret
              </h3>
              
              <div className="form-group">
                <label htmlFor="preimage-input">Secret Preimage (Text)</label>
                <input
                  id="preimage-input"
                  type="text"
                  value={preimage}
                  className="form-input"
                  onChange={(e) => setPreimage(e.target.value)}
                />
              </div>

              <div className="address-info-card">
                <div className="address-info-row">
                  <span className="address-label">Computed Hash (Blake2b):</span>
                  <span className="address-value font-mono" style={{ color: "#38bdf8" }}>{preimageHash.slice(0, 30)}...</span>
                </div>
                <div className="address-info-row">
                  <span className="address-label">Hash-Locked Address:</span>
                  <span className="address-value font-mono">
                    {lockAccount?.address ? lockAccount.address.slice(0, 25) + "..." : "Calculating..."}
                  </span>
                </div>
                <div className="address-info-row">
                  <span className="address-label">Locked Balance:</span>
                  <span className="address-value" style={{ fontWeight: "700" }}>{lockBalance} CKB</span>
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="fund-amount-input">Amount to Lock (CKB)</label>
                <div style={{ display: "flex", gap: "12px" }}>
                  <input
                    id="fund-amount-input"
                    type="number"
                    value={fundAmount}
                    className="form-input"
                    style={{ width: "65%" }}
                    onChange={(e) => setFundAmount(e.target.value)}
                  />
                  <button
                    className="app-btn btn-secp"
                    disabled={loadingAction !== null || (!privKey && !signer)}
                    onClick={handleLockFunds}
                  >
                    {loadingAction === "funding" ? "Transferring..." : loadingAction === "waiting_funding" ? "Confirming..." : "Lock CKB"}
                  </button>
                </div>
                {!privKey && !signer && (
                  <p style={{ fontSize: "11px", color: "#f87171", marginTop: "6px" }}>
                    ⚠️ Connect your Wallet (JoyID/Passkey) or input a Private Key to sign the locking transaction.
                  </p>
                )}
              </div>
            </div>

            <hr style={{ borderColor: "var(--border-color)", margin: "24px 0" }} />

            {/* Step 4: Unlock Lock Script */}
            <div style={{ opacity: isContractLoaded && Number(lockBalance) > 61 ? 1 : 0.4, pointerEvents: isContractLoaded && Number(lockBalance) > 61 ? "auto" : "none" }}>
              <h3 style={{ fontSize: "16px", marginBottom: "16px", display: "flex", alignItems: "center", gap: "8px" }}>
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="hero-icon" style={{ color: "var(--accent-primary)" }}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 10.5V6.75a4.5 4.5 0 1 1 9 0v3.75M3.75 21.75h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H3.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
                </svg>
                Step 2: Unlock Contract CKB
              </h3>
              
              <div className="form-group">
                <label htmlFor="receiver-input">Receiver CKB Address</label>
                <input
                  id="receiver-input"
                  type="text"
                  value={receiverAddress}
                  className="form-input font-mono"
                  onChange={(e) => setReceiverAddress(e.target.value)}
                />
              </div>

              <button
                className="app-btn btn-primary"
                disabled={loadingAction !== null}
                onClick={handleUnlockFunds}
              >
                {loadingAction === "unlocking" ? "Unlocking..." : loadingAction === "waiting_unlock" ? "Verifying..." : "Claim & Unlock CKB"}
              </button>
              
              {Number(lockBalance) <= 61 && (
                <p style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "6px" }}>
                  ℹ️ Lock address balance must be &gt; 61 CKB to unlock.
                </p>
              )}
            </div>
          </div>
        </section>

        {/* Console / Logs Terminal */}
        <section className="glass-panel grid-span-2 terminal-panel">
          <div className="terminal-header">
            <div className="terminal-dots">
              <span className="dot red"></span>
              <span className="dot yellow"></span>
              <span className="dot green"></span>
            </div>
            <div className="terminal-title">CKB Script Execution Monitor</div>
            <div style={{ width: "40px" }}></div>
          </div>
          <div className="terminal-logs font-mono" ref={logsContainerRef}>
            {logs.length === 0 ? (
              <div style={{ color: "#475569" }}>&gt; Initialized CKB DApp client. Awaiting actions...</div>
            ) : (
              logs.map((log, index) => (
                <div key={index} className="log-entry">
                  <span className="log-timestamp">[{log.timestamp}]</span>
                  <span className={`log-content log-${log.type}`}>
                    &gt; {log.content}
                  </span>
                </div>
              ))
            )}
          </div>
        </section>

        {/* Lock Script Logic Panel */}
        {lockAccount && (
          <section className="glass-panel grid-span-2">
            <div className="panel-header">
              <h2>
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="hero-icon" style={{ color: "var(--accent-primary)" }}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17 17.25 21A1.75 1.75 0 0 4 19.75 18.5l-5.83-5.83m.909-.909L21 6.25A1.75 1.75 0 0 0 18.5 3.75l-5.83 5.83m0 0a1.75 1.75 0 1 1-2.474-2.474 1.75 1.75 0 0 1 2.474 2.474ZM9.75 16.25H3.75v-6H9.75v6Z" />
                </svg>
                UNDER THE HOOD: CKB CELL STRUCTURE
              </h2>
            </div>
            <div className="panel-content">
              <p style={{ fontSize: "14px", color: "var(--text-muted)", marginBottom: "16px" }}>
                This is the actual JSON description of the Lock Script cell that holds the locked CKB balance on the blockchain.
              </p>
              <pre className="font-mono" style={{ background: "rgba(0,0,0,0.4)", padding: "16px", borderRadius: "8px", fontSize: "12px", overflowX: "auto", textAlign: "left" }}>
                {JSON.stringify({
                  cell: {
                    capacity: `${lockBalance} CKB`,
                    lock: {
                      codeHash: lockAccount?.lockScript?.codeHash || "",
                      hashType: lockAccount?.lockScript?.hashType || "",
                      args: lockAccount?.lockScript?.args || ""
                    },
                    data: "0x (Empty cell data)"
                  }
                }, null, 2)}
              </pre>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
