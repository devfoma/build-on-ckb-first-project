# CKB Store Data on Cell: My On-Chain Message Storage Process

Documented by: Maduegbunam Faith Amarachi (Devfoma)


I chose to complete this Store Data on Cell campaign using a custom automated Node script integrated with CKB's native CLI wrapper and developer network (offckb) because:

1. Local Network Control: Running my own private node via `offckb` allows me to inspect cell capacities and balance modifications instantly in a controlled sandbox without relying on public testnet latency.
2. Direct API Integration: Constructing and executing transactions programmatically using the `@ckb-ccc/core` client library gives me full visibility into fee estimation, UTXO cell inputs, and raw witness structures.
3. Precise Verification: Querying the devnet blockchain directly using the cell's transaction hash and output index ensures absolute, tamper-proof verification that my message was written on-chain.













Step 1: Bootstrap the Local Devnet
Before writing any code or building my transaction, I must have a running CKB blockchain instance in my local development environment.
My Action: I bypass local script restrictions by running the command `offckb.cmd node` in the background. The offckb CLI tool automatically detects the missing CKB v0.205.0 portable binary, downloads the archive, extracts it, and initializes the local CKB devnet node and miner, establishing an RPC proxy interface on `http://127.0.0.1:28114`.








Step 2: Retrieve Funded Developer Accounts
Once my devnet node is actively mining blocks, I need a funded account to pay for transaction fees and cell capacity.
My Action: I query the default offckb accounts list by executing `offckb.cmd accounts`. I extract the private key for Account #1 (`0x9f315d5a9618a39fdc487c7a67a8581d40b045bd7a42d83648ca80ef3b2cb4a1`) and confirm that it has a pre-funded balance of `42,000,000 CKB` ready for my transaction building.








Step 3: Setup Node Client and Register Devnet Script Hashes
To let my script communicate with the devnet and know how to resolve signature locks, I must configure my client.
My Action: I create `test-store-data.js` and load the local `system-scripts.json` containing CKB devnet script hashes. I instantiate CKB's `ClientPublicTestnet` targeting my local port `28114`, register my devnet script configurations (`secp256k1_blake160_sighash_all`), and setup my `SignerCkbPrivateKey` signer using Account #1's private key.








Step 4: Encode the UTF-8 Message to Hexadecimal
Because CKB cells only store raw bytes in their outputs, I cannot write plain text directly to the blockchain.
My Action: I write a utility function `utf8ToHex` using `TextEncoder` to translate my string message `"Hello CKB, Store Data on Cell Campaign Completed successfully!"` into a clean hexadecimal string: `0x48656c6c6f20434b422c2053746f72652044617461206f6e2043656c6c2043616d706169676e20436f6d706c65746564207375636365737366756c6c7921`.










Step 5: Build the Transaction with Cell Data
Next, I construct the transaction container that will carry my encoded message to the blockchain.
My Action: I call `ccc.Transaction.from`, placing the lock script of my signer as the output recipient and mapping my encoded hex message directly to the `outputsData` array. I invoke `tx.completeInputsByCapacity(signer)` to gather the necessary UTXO inputs from my account and run `tx.completeFeeBy(signer, 1000)` to automatically estimate and add the miner transaction fee.







Step 6: Sign and Broadcast to the Network
With the transaction successfully built and the fee calculated, I need to sign it to authorize the CKB token expenditure.
My Action: I sign and send the transaction using `signer.sendTransaction(tx)`. The node outputs a unique transaction hash `0x522bc4c6d7c83b173483f0008d246ccf76d6c25ac975b298f03d41b0aed18768` and I wait for it to be confirmed on-chain using `client.waitTransaction(txHash)`.







Step 7: Retrieve and Decode Live Cell Data
After the block is mined, I must verify that my message is permanently stored on-chain.
My Action: I call the RPC method `client.getCellLive` using my transaction hash and output index `0x0` to retrieve the live cell. I read the raw `outputData` byte string (`0x48656c...`), pass it to my decoding utility `hexToUtf8`, and convert it back into the original plain text message, completing my verification loop successfully.
