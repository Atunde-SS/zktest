function getPoseidon2Params(t, d, rounds_f, rounds_p, mat_internal_diag_m_1, mat_internal, round_constants) {
    const r = rounds_f / 2;
    const rounds = rounds_f + rounds_p;
    return {
        t,
        d,
        rounds_f_beginning: r,
        rounds_p,
        rounds_f_end: r,
        rounds,
        mat_internal_diag_m_1: mat_internal_diag_m_1,
        _mat_internal: mat_internal,
        round_constants: round_constants,
    };
}
export { getPoseidon2Params };
