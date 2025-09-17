import { F1Field } from "./field.js";
import type { Poseidon2Params } from "./poseidon2params.js";
declare class Poseidon2 {
    params: Poseidon2Params;
    primeField: F1Field;
    constructor(params: Poseidon2Params, primeField: F1Field);
    getT(): number;
    sbox(input: bigint[]): bigint[];
    sboxP(input: bigint): bigint;
    matmulExternal(input: bigint[]): bigint[];
    matmulInternal(input: bigint[]): bigint[];
    permute(input: bigint[]): bigint[];
    addRc(input: bigint[], rc: bigint[]): bigint[];
}
export { Poseidon2 };
