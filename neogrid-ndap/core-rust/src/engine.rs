use crate::hash::sha256_hex;
use crate::tx::Transaction;
use crate::state::State;
use crate::smt::InclusionProof;
use crate::mmr::LogEntry;

#[derive(Debug)]
pub struct StateTransition {
    pub prev_root: String,
    pub new_root: String,
    pub tx_hash: String,
    pub log_entry: LogEntry,
}

#[derive(Debug)]
pub struct ValidationResult {
    pub valid: bool,
    pub errors: Vec<String>,
}

pub struct Engine {
    state: State,
}

impl Engine {
    pub fn new() -> Self {
        Engine { state: State::new() }
    }

    pub fn validate_transaction(&self, tx: &Transaction) -> ValidationResult {
        let mut errors = Vec::new();

        if tx.from_did.is_empty() { errors.push("Missing: fromDID".to_string()); }
        if tx.to_did.is_empty() { errors.push("Missing: toDID".to_string()); }
        if tx.asset_id.is_empty() { errors.push("Missing: assetId".to_string()); }
        if tx.nonce.is_empty() { errors.push("Missing: nonce".to_string()); }
        if tx.timestamp == 0 { errors.push("Missing: timestamp".to_string()); }
        if tx.from_did == tx.to_did { errors.push("fromDID and toDID must differ".to_string()); }

        if self.state.used_nonces.contains(&tx.nonce) {
            errors.push(format!("Replay attack: nonce \"{}\" already consumed", tx.nonce));
        }

        if let Some(owner) = self.state.ownership.get(&tx.asset_id) {
            if owner != &tx.from_did {
                errors.push(format!("Ownership violation: asset owned by \"{}\"", owner));
            }
        }

        if tx.amount > 0 {
            let balance = self.state.balances.get(&tx.from_did).copied().unwrap_or(0);
            if balance < tx.amount {
                errors.push(format!("Insufficient balance: have {}, need {}", balance, tx.amount));
            }
        }

        ValidationResult { valid: errors.is_empty(), errors }
    }

    pub fn apply_transaction(&mut self, tx: &Transaction) -> Result<StateTransition, String> {
        let result = self.validate_transaction(tx);
        if !result.valid {
            return Err(format!("Transaction rejected: {}", result.errors.join("; ")));
        }

        let prev_root = self.state.state_root();
        let tx_hash = tx.fingerprint();

        self.state.used_nonces.insert(tx.nonce.clone());
        self.state.ownership.insert(tx.asset_id.clone(), tx.to_did.clone());
        self.state.smt.set(&tx.asset_id, &tx.to_did);

        if tx.amount > 0 {
            *self.state.balances.entry(tx.from_did.clone()).or_insert(0) -= tx.amount;
            *self.state.balances.entry(tx.to_did.clone()).or_insert(0) += tx.amount;
        }

        let new_root = self.state.state_root();
        let timestamp = tx.timestamp;
        let log_entry = self.state.mmr.append_linked(&tx_hash, &prev_root, &new_root, timestamp);

        Ok(StateTransition { prev_root, new_root, tx_hash, log_entry })
    }

    pub fn compute_state_root(&self) -> String {
        self.state.state_root()
    }

    pub fn get_proof(&self, key: &str) -> InclusionProof {
        self.state.smt.get_proof(key)
    }

    pub fn snapshot(&self) -> crate::state::StateSnapshot {
        self.state.snapshot()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn make_tx(asset: &str, from: &str, to: &str, nonce: &str) -> Transaction {
        Transaction {
            id: String::new(),
            from_did: from.to_string(),
            to_did: to.to_string(),
            asset_id: asset.to_string(),
            amount: 0,
            nonce: nonce.to_string(),
            timestamp: 1700000000,
            signature: None,
        }
    }

    #[test]
    fn test_apply_and_state_root_changes() {
        let mut engine = Engine::new();
        let r0 = engine.compute_state_root();
        let tx = make_tx("asset-1", "alice", "bob", "nonce-1");
        engine.apply_transaction(&tx).unwrap();
        let r1 = engine.compute_state_root();
        assert_ne!(r0, r1);
    }

    #[test]
    fn test_nonce_replay_rejected() {
        let mut engine = Engine::new();
        let tx = make_tx("asset-1", "alice", "bob", "nonce-dup");
        engine.apply_transaction(&tx).unwrap();
        let tx2 = make_tx("asset-1", "bob", "carol", "nonce-dup");
        let result = engine.apply_transaction(&tx2);
        assert!(result.is_err());
    }

    #[test]
    fn test_ownership_violation_rejected() {
        let mut engine = Engine::new();
        let tx1 = make_tx("asset-X", "alice", "bob", "n1");
        engine.apply_transaction(&tx1).unwrap();
        let tx2 = make_tx("asset-X", "charlie", "dave", "n2");
        let result = engine.apply_transaction(&tx2);
        assert!(result.is_err());
    }
}
