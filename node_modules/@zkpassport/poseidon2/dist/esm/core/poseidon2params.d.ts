interface Poseidon2Params {
    t: number;
    d: number;
    rounds_f_beginning: number;
    rounds_p: number;
    rounds_f_end: number;
    rounds: number;
    mat_internal_diag_m_1: bigint[];
    _mat_internal: bigint[][];
    round_constants: bigint[][];
}
declare function getPoseidon2Params(t: number, d: number, rounds_f: number, rounds_p: number, mat_internal_diag_m_1: bigint[], mat_internal: bigint[][], round_constants: bigint[][]): Poseidon2Params;
export type { Poseidon2Params };
export { getPoseidon2Params };
