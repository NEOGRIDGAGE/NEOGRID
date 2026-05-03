use std::collections::{HashMap, HashSet};
use crate::hash::sha256_hex;
use crate::smt::SparseMerkleTree;
use crate::mmr::MerkleMountainRange;

pub struct State {
    pub smt: SparseMerkleTree,
    pub mmr: MerkleMountainRange,
    pub ownership: HashMap<String, String>,
    pub balances: HashMap<String, i64>,
    pub used_nonces: HashSet<String>,
}

impl State {
    pub fn new() -> Self {
        State {
            smt: SparseMerkleTree::new(),
            mmr: MerkleMountainRange::new(),
            ownership: HashMap::new(),
            balances: HashMap::new(),
            used_nonces: HashSet::new(),
        }
    }

    pub fn state_root(&self) -> String {
        self.smt.compute_root()
    }

    pub fn mmr_root(&self) -> &str {
        self.mmr.current_root()
    }

    pub fn snapshot(&self) -> StateSnapshot {
        StateSnapshot {
            state_root: self.state_root(),
            mmr_root: self.mmr_root().to_string(),
            log_size: self.mmr.size(),
            asset_count: self.ownership.len(),
            nonce_count: self.used_nonces.len(),
        }
    }
}

#[derive(Debug)]
pub struct StateSnapshot {
    pub state_root: String,
    pub mmr_root: String,
    pub log_size: usize,
    pub asset_count: usize,
    pub nonce_count: usize,
}
