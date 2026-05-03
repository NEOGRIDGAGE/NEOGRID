use crate::hash::sha256_hex;

#[derive(Debug, Clone)]
pub struct Transaction {
    pub id: String,
    pub from: String,
    pub to: String,
    pub asset_key: String,
    pub timestamp: u64,
}

impl Transaction {
    pub fn new(from: &str, to: &str, asset_key: &str, timestamp: u64) -> Self {
        let raw = format!("{}:{}:{}:{}", from, to, asset_key, timestamp);
        let id = sha256_hex(raw.as_bytes());
        Transaction {
            id,
            from: from.to_string(),
            to: to.to_string(),
            asset_key: asset_key.to_string(),
            timestamp,
        }
    }

    pub fn validate(&self) -> bool {
        !self.from.is_empty()
            && !self.to.is_empty()
            && !self.asset_key.is_empty()
            && self.timestamp > 0
            && self.from != self.to
    }

    pub fn fingerprint(&self) -> String {
        let raw = format!(
            "{}:{}:{}:{}:{}",
            self.id, self.from, self.to, self.asset_key, self.timestamp
        );
        sha256_hex(raw.as_bytes())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_valid_transaction() {
        let tx = Transaction::new("alice", "bob", "asset-001", 1700000000);
        assert!(tx.validate());
    }

    #[test]
    fn test_self_transfer_invalid() {
        let tx = Transaction::new("alice", "alice", "asset-001", 1700000000);
        assert!(!tx.validate());
    }

    #[test]
    fn test_empty_from_invalid() {
        let tx = Transaction::new("", "bob", "asset-001", 1700000000);
        assert!(!tx.validate());
    }

    #[test]
    fn test_id_deterministic() {
        let tx1 = Transaction::new("alice", "bob", "asset-001", 1700000000);
        let tx2 = Transaction::new("alice", "bob", "asset-001", 1700000000);
        assert_eq!(tx1.id, tx2.id);
    }
}
