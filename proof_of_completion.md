# Proof of Completion: Store Data on Cell Campaign

Below are the logged outputs proving the successful completion of the "Store Data on Cell" campaign, run against a local `offckb` devnet environment.

---

## 📋 Execution Log Output

```text
=== CKB STORE DATA ON CELL TUTORIAL RUN ===

1. Encoding Message...
   Original Message: "Hello CKB, Store Data on Cell Campaign Completed successfully!"
   Encoded Hex:      0x48656c6c6f20434b422c2053746f72652044617461206f6e2043656c6c2043616d706169676e20436f6d706c65746564207375636365737366756c6c7921

2. Decoding Message...
   Decoded Message:  "Hello CKB, Store Data on Cell Campaign Completed successfully!"

3. Setting up Signer (Account #1)...
   CKB Address:      ckt1qzda0cr08m85hc8jlnfp3zer7xulejywt49kt2rr0vthywaa50xwsqt435c3epyrupszm7khk6weq5lrlyt52lg48ucew
   Current Balance:  42000000.00 CKB

4. Building Transaction to Store Data on Cell...
   Selecting inputs and estimating fee...
   Transaction built successfully!

5. Signing and Sending Transaction...
   Transaction Hash: 0x522bc4c6d7c83b173483f0008d246ccf76d6c25ac975b298f03d41b0aed18768

6. Waiting for transaction to be committed on-chain...
   Transaction committed successfully!

7. Retrieving Live Cell Data...
   Retrieved Cell Data (Hex): 0x48656c6c6f20434b422c2053746f72652044617461206f6e2043656c6c2043616d706169676e20436f6d706c65746564207375636365737366756c6c7921
   Retrieved & Decoded Message:  "Hello CKB, Store Data on Cell Campaign Completed successfully!"

=== CAMPAIGN STEPS VERIFIED & COMPLETED! ===
```

---

## 🧠 Reflection of My Learning Process

Completing this campaign deepened my understanding of the CKB core principles and UTXO structure:

### 1. The Power of the Generalized Cell Model
Unlike Ethereum or EVM chains where data is stored in account storage slots mapped behind smart contracts, CKB stores data in first-class **Cells** (a generalized UTXO model). 
- I learned that I can write arbitrary data directly into a cell's `outputData` field without needing to invoke or interact with an active smart contract. The cells themselves are the storage.

### 2. Space is Capital (1 CKB = 1 Byte)
The constraint where **1 CKB token represents exactly 1 byte** of on-chain state storage was a major lightbulb moment for me.
- To store my message, I had to ensure that the capacity of the cell was large enough to cover the size of its lock script, type script, and the message itself. 
- If my transaction selected inputs with insufficient capacity to satisfy this minimum byte size constraint, it would fail. In this case, CKB's unique rent/space model binds the cost of state storage directly to the circulating token supply.

### 3. Local Chain Bootstrap via OffCKB
Setting up `offckb` locally gave me a smooth developer experience. I bypassed the PowerShell script block by using the `offckb.cmd` wrapper and successfully spun up a local CKB node at port `28114`.
- I had to feed the local devnet system scripts (like `secp256k1_blake160_sighash_all`) into my `@ckb-ccc/core` client configuration so that it knew how to construct and sign inputs. 
- It was fascinating to see how the client uses the same API structure to connect to `devnet` as it does to `testnet` or `mainnet`, simply by changing the underlying configuration endpoint and script registries.
