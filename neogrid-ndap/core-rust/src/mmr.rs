use crate::hash::sha256_hex;

fn genesis_root() -> String {
    sha256_hex(b"ndap:v2:mmr:genesis")
}

#[derive(Debug, Clone)]
pub struct LogEntry {
    pub index: usize,
    pub tx_hash: String,
    pub prev_root: String,
    pub new_root: String,
    pub timestamp: u64,
    pub mmr_root: String,
}

impl LogEntry {
    fn compute_mmr_root(prev_root: &str, tx_hash: &str, index: usize, timestamp: u64) -> String {
        sha256_hex(format!("ndap:v2:mmr:{}:{}:{}:{}", prev_root, tx_hash, index, timestamp).as_bytes())
    }
}

pub struct MerkleMountainRange {
    entries: Vec<LogEntry>,
    current_root: String,
}

impl MerkleMountainRange {
    pub fn new() -> Self {
        MerkleMountainRange {
            entries: Vec::new(),
            current_root: genesis_root(),
        }
    }

    pub fn append_linked(&mut self, tx_hash: &str, prev_root: &str, new_root: &str, timestamp: u64) -> LogEntry {
        let index = self.entries.len();
        let mmr_root = LogEntry::compute_mmr_root(prev_root, tx_hash, index, timestamp);
        let entry = LogEntry {
            index,
            tx_hash: tx_hash.to_string(),
            prev_root: prev_root.to_string(),
            new_root: new_root.to_string(),
            timestamp,
            mmr_root: mmr_root.clone(),
        };
        self.entries.push(entry.clone());
        self.current_root = mmr_root;
        entry
    }

    pub fn current_root(&self) -> &str {
        &self.current_root
    }

    pub fn entries(&self) -> &[LogEntry] {
        &self.entries
    }

    pub fn size(&self) -> usize {
        self.entries.len()
    }

    pub fn verify(&self) -> bool {
        for entry in &self.entries {
            let expected = LogEntry::compute_mmr_root(&entry.prev_root, &entry.tx_hash, entry.index, entry.timestamp);
            if expected != entry.mmr_root {
                return false;
            }
        }
        true
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_empty_mmr() {
        let mmr = MerkleMountainRange::new();
        assert_eq!(mmr.size(), 0);
        assert_eq!(mmr.current_root(), sha256_hex(b"ndap:v2:mmr:genesis"));
    }

    #[test]
    fn test_append_and_verify() {
        let mut mmr = MerkleMountainRange::new();
        let r0 = mmr.current_root().to_string();
        let e1 = mmr.append_linked("txhash1", &r0, "newroot1", 1700000000);
        let r1 = mmr.current_root().to_string();
        assert_ne!(r0, r1);
        let e2 = mmr.append_linked("txhash2", &r1, "newroot2", 1700000001);
        assert_ne!(r1, mmr.current_root());
        assert!(mmr.verify());
        assert_eq!(mmr.size(), 2);
    }

    #[test]
    fn test_monotonic_roots() {
        let mut mmr = MerkleMountainRange::new();
        let roots: Vec<String> = (0..5).map(|i| {
            let prev = mmr.current_root().to_string();
            mmr.append_linked(&format!("tx{}", i), &prev, &format!("root{}", i), i as u64);
            mmr.current_root().to_string()
        }).collect();
        let unique: std::collections::HashSet<_> = roots.iter().collect();
        assert_eq!(unique.len(), 5);
    }
}
