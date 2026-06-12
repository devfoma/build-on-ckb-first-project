# My CKB Store Data on Cell: On-Chain Message Storage Process

Documented by: Maduegbunam Faith Amarachi (Devfoma)


I chose to complete this Store Data on Cell campaign using a custom automated Node script integrated with CKB's native CLI wrapper and developer network (offckb) because:

1. **Local Network Control**: Running my own private node via `offckb` allows me to inspect cell capacities and balance modifications instantly in a controlled sandbox without relying on public testnet latency.
2. **Direct API Integration**: Constructing and executing transactions programmatically using the `@ckb-ccc/core` client library gives me full visibility into fee estimation, UTXO cell inputs, and raw witness structures.
3. **Precise Verification**: Querying the devnet blockchain directly using the cell's transaction hash and output index ensures absolute, tamper-proof verification that my message was written on-chain.













### Step 1: Bootstrap the Local Devnet
I did this following the first step of the documentation to spin up a local network. I ran `offckb.cmd node` in my workspace root. The CLI wrapper downloaded and installed the CKB binary version 0.205.0 and successfully launched my devnet node and miner, exposing the RPC proxy at `http://127.0.0.1:28114`.
My Action: I started the local node in the background and verified it began producing blocks.








### Step 2: Retrieve Funded Developer Accounts
I did this following the documentation's account setup guide. I ran `offckb.cmd accounts` to output the list of pre-funded accounts generated in the devnet genesis block.
My Action: I extracted the private key for Account #1 (`0x9f315d5a9618a39fdc487c7a67a8581d40b045bd7a42d83648ca80ef3b2cb4a1`) and verified that it held a balance of `42,000,000 CKB`.








### Step 3: Setup Node Client and Register Devnet Script Hashes
I did this following the client setup guidelines in the documentation. I copied `system-scripts.json` containing the script configurations and loaded them into my test script.
My Action: I instantiated the `ClientPublicTestnet` with my local proxy URL and configured the `SignerCkbPrivateKey` using the funded private key from Step 2.








### Step 4: Encode the UTF-8 Message to Hexadecimal
I did this following the message encoding instructions. I wrote a utility function `utf8ToHex` using the `TextEncoder` API to convert my plain text message into a hex payload.
My Action: I encoded the message `"Hello CKB, Store Data on Cell Campaign Completed successfully!"` into the hexadecimal string: `0x48656c6c6f20434b422c2053746f72652044617461206f6e2043656c6c2043616d706169676e20436f6d706c65746564207375636365737366756c6c7921`.










### Step 5: Build the Transaction with Cell Data
I did this following the transaction building specifications. I constructed the transaction output cell using `@ckb-ccc/core`.
My Action: I set the lock script of my output cell to the signer's script, loaded the encoded hex message into the output data, completed the inputs based on my signer's capacity, and completed the fee estimation at a rate of 1000 shannons/KW.







### Step 6: Sign and Broadcast to the Network
I did this following the signature and broadcast instructions. I used my local private key signer to sign the transaction payload and push it to the node.
My Action: I executed `signer.sendTransaction(tx)`, generating the transaction hash `0x522bc4c6d7c83b173483f0008d246ccf76d6c25ac975b298f03d41b0aed18768`, and waited for confirmation.







### Step 7: Retrieve and Decode Live Cell Data
I did this following the reading data instructions to query my saved cell data from the blockchain.
My Action: I fetched the live cell at index `0x0` using the transaction hash from Step 6. I retrieved the raw hex payload `0x48656c...`, decoded it back to UTF-8 using `TextDecoder`, and confirmed that the retrieved message matched my original input string.
