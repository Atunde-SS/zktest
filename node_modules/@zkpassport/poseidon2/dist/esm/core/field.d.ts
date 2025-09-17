declare class F1Field {
    prime: bigint;
    zero: bigint;
    one: bigint;
    constructor(prime: bigint);
    e(x: number | bigint | string): bigint;
    add(x: bigint, y: bigint): bigint;
    sub(x: bigint, y: bigint): bigint;
    mul(x: bigint, y: bigint): bigint;
    square(x: bigint): bigint;
    div(x: bigint, y: bigint): bigint;
}
export { F1Field };
