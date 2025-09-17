use std::hash::poseidon2::Poseidon2::hash;

fn main(secret_path: [Field; 3], user_path: [Field; 3], public_hash: pub Field) {
    for i in 0..3 {
        assert(secret_path[i] == user_path[i]);
    }

    assert(hash(secret_path, 3) == public_hash);
}

#[test]
fn test_main() {
    let secret_path = [0];
    println(hash(secret_path, 3));
}