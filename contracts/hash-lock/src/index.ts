import * as bindings from "@ckb-js-std/bindings";
import { HighLevel, log, hashCkb, bytesEq } from "@ckb-js-std/core";

function main(): number {
  log.setLevel(log.LogLevel.Debug);
  let script = bindings.loadScript();
  log.debug(`hash-lock script loaded: ${JSON.stringify(script)}`);

  // The lock script args starts with:
  // 2 bytes version (0x0000)
  // 32 bytes codeHash of the contract code cell
  // 1 byte hashType of the contract code cell
  // followed by the arguments of the contract (the expected preimage hash)
  let expect_hash = new Uint8Array(HighLevel.loadScript().args).slice(35);

  // Load the first witness of the input cell group, where the preimage is stored in the lock field
  let witness_args = HighLevel.loadWitnessArgs(0, bindings.SOURCE_GROUP_INPUT);
  let preimage = witness_args.lock!;

  // Hash the preimage using CKB Blake2b_256 hash function
  let hash = hashCkb(preimage);

  if (!bytesEq(hash, expect_hash.buffer)) {
    log.error(`Check hash failed: computed ${new Uint8Array(hash)}, expected ${expect_hash}`);
    return 11; // Error code for mismatch
  } else {
    return 0; // Success
  }
}

bindings.exit(main());
