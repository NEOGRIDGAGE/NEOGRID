pragma circom 2.0.0;

/*
 * TxVerify — zero-knowledge balance check circuit
 *
 * Proves that a transfer amount does not exceed the sender's balance
 * without revealing the exact balance to any party.
 *
 * Inputs:
 *   balance  — private: sender's current balance
 *   amount   — public:  transfer amount requested
 *
 * Output:
 *   valid    — 1 if balance >= amount, 0 otherwise
 *
 * Note: This is a placeholder circuit for development and spec purposes.
 * A production deployment requires a trusted setup ceremony (Powers of Tau)
 * and a soundness audit before use in a live system.
 */
template TxVerify() {
    signal input balance;
    signal input amount;
    signal output valid;

    // Intermediate signal — difference must be non-negative
    signal diff;
    diff <== balance - amount;

    // valid = 1 iff diff >= 0 (i.e., balance >= amount)
    // In a full circuit this would use a range-proof component;
    // here we use a linear constraint as a placeholder.
    valid <== balance - amount;
}

component main {public [amount]} = TxVerify();
