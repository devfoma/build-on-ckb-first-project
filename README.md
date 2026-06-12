# My CKB Store Data on Cell: On-Chain Message Storage Process

Documented by: Maduegbunam Faith Amarachi (Devfoma)


I chose to complete this Store Data on Cell campaign using a custom automated Node script integrated with CKB's native CLI wrapper and developer network (offckb) because:

1. **Local Network Control**: Running my own private node via `offckb` allows me to inspect cell capacities and balance modifications instantly in a controlled sandbox without relying on public testnet latency.
2. **Direct API Integration**: Constructing and executing transactions programmatically using the `@ckb-ccc/core` client library gives me full visibility into fee estimation, UTXO cell inputs, and raw witness structures.
3. **Precise Verification**: Querying the devnet blockchain directly using the cell's transaction hash and output index ensures absolute, tamper-proof verification that my message was written on-chain.













### Step 1: Bootstrap the Local Devnet
I did this following the first step of the documentation to spin up a local network. I ran the command `offckb.cmd node` in the terminal from my workspace root. The local CKB devnet node and miner initialized successfully, establishing the RPC proxy at `http://127.0.0.1:28114` and generating new blocks in the background.

### Step 2: Retrieve Funded Developer Accounts
I did this following the second step of the documentation. I executed the `offckb.cmd accounts` command to retrieve the pre-funded developer accounts list. From this list, I extracted the private key for Account #1 (`0x9f315d5a9618a39fdc487c7a67a8581d40b045bd7a42d83648ca80ef3b2cb4a1`) and verified that it held a balance of `42,000,000 CKB`.

### Step 3: Setup Node Client and Register Devnet Script Hashes
I did this following the third step of the documentation. I copied the devnet script hashes configuration file (`system-scripts.json`) and imported it into my Node.js scripts. I instantiated a CKB client using `ClientPublicTestnet` targeting my local node proxy, registered the required devnet system scripts (like `secp256k1_blake160_sighash_all`), and configured my private key signer using Account #1's key.

### Step 4: Encode the UTF-8 Message to Hexadecimal
I did this following the fourth step of the documentation. I wrote a utility function `utf8ToHex` using the native `TextEncoder` API to convert my plain text message `"Hello CKB, Store Data on Cell Campaign Completed successfully!"` into a hexadecimal format, producing the string `0x48656c6c6f20434b422c2053746f72652044617461206f6e2043656c6c2043616d706169676e20436f6d706c65746564207375636365737366756c6c7921`.

### Step 5: Build the Transaction with Cell Data
I did this following the fifth step of the documentation. I constructed the transaction to create a cell carrying my message. I set the transaction output cell's lock script to the signer's script, assigned the encoded message hex string to the cell's `outputData` field, automatically selected input cells to cover the needed capacity using `tx.completeInputsByCapacity`, and computed the transaction fee at a fee rate of 1000 shannons/KW.

### Step 6: Sign and Broadcast to the Network
I did this following the sixth step of the documentation. I signed the constructed transaction with the private key of Account #1 and broadcast it to the network using the `signer.sendTransaction` method. The network processed the transaction, returned the transaction hash `0x522bc4c6d7c83b173483f0008d246ccf76d6c25ac975b298f03d41b0aed18768`, and I monitored it until it was fully committed on-chain.

### Step 7: Retrieve and Decode Live Cell Data
I did this following the seventh step of the documentation. I queried the CKB devnet RPC for the live cell at index `0x0` using my transaction hash. I read the hexadecimal message stored in the cell, converted it back into a readable UTF-8 string using the `TextDecoder` API, and verified that it matched the original message.
