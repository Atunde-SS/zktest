import { hashToField as poseidon2Hash } from "./hash.js";
import { hashToFieldAsync as poseidon2HashAsync } from "./hash-async.js";
export declare const permute: (input: bigint[]) => bigint[];
export declare const F: import("../index.js").F1Field;
export { poseidon2Hash, poseidon2HashAsync };
