type IHashOut = [bigint, bigint, bigint];
export declare const F: import("../index.js").F1Field;
export declare const permute: (input: bigint[]) => bigint[];
export declare function hashToFieldAsync(input: bigint[]): Promise<bigint>;
export type { IHashOut };
