use crate::hash::sha256_hex;

const DEPTH: usize = 256;

fn empty_hash() -> String {
    sha256_hex(b"ndap:v2:empty_node")
}

fn leaf_hash(key: &str, value: &str) -> String {
    sha256_hex(format!("ndap:v2:leaf:{}:{}", key, value).as_bytes())
}

fn node_hash(left: &str, right: &str) -> String {
    sha256_hex(format!("ndap:v2:node:{}:{}", left, right).as_bytes())
}

fn get_bit(hex_key: &str, depth: usize) -> u8 {
    let byte_idx = depth / 8;
    let bit_pos = 7 - (depth % 8);
    let hex_byte = &hex_key[byte_idx * 2..byte_idx * 2 + 2];
    let byte = u8::from_str_radix(hex_byte, 16).unwrap_or(0);
    (byte >> bit_pos) & 1
}

#[derive(Clone, Debug)]
pub enum Node {
    Empty,
    Leaf { key: String, value: String },
    Internal { left: Box<Node>, right: Box<Node> },
}

impl Node {
    pub fn hash(&self) -> String {
        match self {
            Node::Empty => empty_hash(),
            Node::Leaf { key, value } => leaf_hash(key, value),
            Node::Internal { left, right } => node_hash(&left.hash(), &right.hash()),
        }
    }
}

#[derive(Debug)]
pub struct InclusionProof {
    pub key: String,
    pub value: Option<String>,
    pub exists: bool,
    pub root: String,
    pub path: Vec<String>,
    pub directions: Vec<u8>,
    pub leaf_hash: String,
}

pub struct SparseMerkleTree {
    root: Node,
}

impl SparseMerkleTree {
    pub fn new() -> Self {
        SparseMerkleTree { root: Node::Empty }
    }

    pub fn compute_root(&self) -> String {
        self.root.hash()
    }

    pub fn set(&mut self, key: &str, value: &str) {
        self.root = Self::insert(std::mem::replace(&mut self.root, Node::Empty), key, value, 0);
    }

    fn insert(node: Node, key: &str, value: &str, depth: usize) -> Node {
        match node {
            Node::Empty => Node::Leaf { key: key.to_string(), value: value.to_string() },
            Node::Leaf { key: ref lk, value: ref _lv } if lk == key => {
                Node::Leaf { key: key.to_string(), value: value.to_string() }
            }
            Node::Leaf { key: existing_key, value: existing_value } => {
                let existing_bit = get_bit(&existing_key, depth);
                let new_bit = get_bit(key, depth);
                let existing_leaf = Node::Leaf { key: existing_key.clone(), value: existing_value.clone() };
                let new_leaf = Node::Leaf { key: key.to_string(), value: value.to_string() };
                if existing_bit == new_bit {
                    let child = Self::insert(existing_leaf, key, value, depth + 1);
                    if existing_bit == 0 {
                        Node::Internal { left: Box::new(child), right: Box::new(Node::Empty) }
                    } else {
                        Node::Internal { left: Box::new(Node::Empty), right: Box::new(child) }
                    }
                } else if existing_bit == 0 {
                    Node::Internal { left: Box::new(existing_leaf), right: Box::new(new_leaf) }
                } else {
                    Node::Internal { left: Box::new(new_leaf), right: Box::new(existing_leaf) }
                }
            }
            Node::Internal { left, right } => {
                let bit = get_bit(key, depth);
                if bit == 0 {
                    Node::Internal { left: Box::new(Self::insert(*left, key, value, depth + 1)), right }
                } else {
                    Node::Internal { left, right: Box::new(Self::insert(*right, key, value, depth + 1)) }
                }
            }
        }
    }

    pub fn get_proof(&self, key: &str) -> InclusionProof {
        let mut path = Vec::new();
        let mut directions = Vec::new();
        let mut node = &self.root;
        let mut depth = 0;
        let mut exists = false;
        let mut value: Option<String> = None;

        loop {
            match node {
                Node::Empty => break,
                Node::Leaf { key: lk, value: lv } => {
                    if lk == key {
                        exists = true;
                        value = Some(lv.clone());
                    }
                    break;
                }
                Node::Internal { left, right } => {
                    let bit = get_bit(key, depth);
                    directions.push(bit);
                    if bit == 0 {
                        path.push(right.hash());
                        node = left;
                    } else {
                        path.push(left.hash());
                        node = right;
                    }
                    depth += 1;
                }
            }
        }

        let root = self.compute_root();
        let lh = match &value {
            Some(v) => leaf_hash(key, v),
            None => empty_hash(),
        };

        InclusionProof { key: key.to_string(), value, exists, root, path, directions, leaf_hash: lh }
    }

    pub fn verify_proof(proof: &InclusionProof) -> bool {
        let mut current = if proof.exists {
            match &proof.value {
                Some(v) => leaf_hash(&proof.key, v),
                None => return false,
            }
        } else {
            empty_hash()
        };

        for i in (0..proof.path.len()).rev() {
            let sibling = &proof.path[i];
            let dir = proof.directions[i];
            current = if dir == 0 {
                node_hash(&current, sibling)
            } else {
                node_hash(sibling, &current)
            };
        }
        current == proof.root
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn make_key(seed: &str) -> String {
        sha256_hex(seed.as_bytes())
    }

    #[test]
    fn test_empty_root() {
        let smt = SparseMerkleTree::new();
        assert_eq!(smt.compute_root(), sha256_hex(b"ndap:v2:empty_node"));
    }

    #[test]
    fn test_insert_and_proof() {
        let mut smt = SparseMerkleTree::new();
        let key = make_key("asset-001");
        smt.set(&key, "owner-alice");
        let proof = smt.get_proof(&key);
        assert!(proof.exists);
        assert_eq!(proof.value.as_deref(), Some("owner-alice"));
        assert!(SparseMerkleTree::verify_proof(&proof));
    }

    #[test]
    fn test_non_membership_proof() {
        let mut smt = SparseMerkleTree::new();
        let key1 = make_key("asset-001");
        let key2 = make_key("asset-002");
        smt.set(&key1, "alice");
        let proof = smt.get_proof(&key2);
        assert!(!proof.exists);
        assert!(SparseMerkleTree::verify_proof(&proof));
    }

    #[test]
    fn test_root_changes_on_insert() {
        let mut smt = SparseMerkleTree::new();
        let r0 = smt.compute_root();
        smt.set(&make_key("key1"), "val1");
        let r1 = smt.compute_root();
        smt.set(&make_key("key2"), "val2");
        let r2 = smt.compute_root();
        assert_ne!(r0, r1);
        assert_ne!(r1, r2);
    }
}
