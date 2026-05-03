use crate::hash::sha256_hex;

#[derive(Debug, Clone)]
pub struct Transaction {
    pub id: String,
    pub from_did: String,
    pub to_did: String,
    pub asset_id: String,
    pub amount: i64,
    pub nonce: String,
    pub timestamp: u64,
    pub signature: Option<String>,
}

impl Transaction {
    pub fn new(from_did: &str, to_did: &str, asset_id: &str, amount: i64, nonce: &str, timestamp: u64) -> Self {
        let raw = format!("{}:{}:{}:{}:{}:{}", from_did, to_did, asset_id, amount, nonce, timestamp);
        let id = sha256_hex(raw.as_bytes());
        Transaction {
            id,
            from_did: from_did.to_string(),
            to_did: to_did.to_string(),
            asset_id: asset_id.to_string(),
            amount,
            nonce: nonce.to_string(),
            timestamp,
            signature: None,
        }
    }

    pub fn validate(&self) -> bool {
        !self.from_did.is_empty()
            && !self.to_did.is_empty()
            && !self.asset_id.is_empty()
            && !self.nonce.is_empty()
            && self.timestamp > 0
            && self.from_did != self.to_did
    }

    pub fn fingerprint(&self) -> String {
        let raw = format!(
            "{}:{}:{}:{}:{}:{}",
            self.from_did, self.to_did, self.asset_id, self.amount, self.nonce, self.timestamp
        );
        sha256_hex(raw.as_bytes())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_valid_transaction() {
        let tx = Transaction::new("did:neogrid:alice", "did:neogrid:bob", "asset-1", 10, "nonce-1", 1700000000);
        assert!(tx.validate());
    }

    #[test]
    fn test_self_transfer_invalid() {
        let tx = Transaction::new("alice", "alice", "asset-1", 0, "n1", 1700000000);
        assert!(!tx.validate());
    }

    #[test]
    fn test_fingerprint_deterministic() {
        let tx1 = Transaction::new("a", "b", "asset", 5, "n", 100);
        let tx2 = Transaction::new("a", "b", "asset", 5, "n", 100);
        assert_eq!(tx1.fingerprint(), tx2.fingerprint());
    }

    #[test]
    fn test_different_nonces_different_fingerprint() {
        let tx1 = Transaction::new("a", "b", "asset", 5, "n1", 100);
        let tx2 = Transaction::new("a", "b", "asset", 5, "n2", 100);
        assert_ne!(tx1.fingerprint(), tx2.fingerprint());
    }
}
