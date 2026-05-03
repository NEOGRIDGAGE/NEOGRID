use std::io::{self, Read};
use ndap_core::{Engine, Transaction};

fn main() {
    let mut input = String::new();
    io::stdin().read_to_string(&mut input).expect("Failed to read stdin");

    let command: serde_json::Value = match serde_json::from_str(&input) {
        Ok(v) => v,
        Err(e) => {
            eprintln!("{}", serde_json::json!({ "error": format!("JSON parse error: {}", e) }));
            std::process::exit(1);
        }
    };

    let mut engine = Engine::new();
    let cmd = command["cmd"].as_str().unwrap_or("");

    let result = match cmd {
        "validate" => {
            let tx = parse_tx(&command["tx"]);
            let r = engine.validate_transaction(&tx);
            serde_json::json!({ "valid": r.valid, "errors": r.errors })
        }
        "apply" => {
            let tx = parse_tx(&command["tx"]);
            match engine.apply_transaction(&tx) {
                Ok(transition) => serde_json::json!({
                    "ok": true,
                    "prevRoot": transition.prev_root,
                    "newRoot": transition.new_root,
                    "txHash": transition.tx_hash,
                    "logIndex": transition.log_entry.index,
                }),
                Err(e) => serde_json::json!({ "ok": false, "error": e }),
            }
        }
        "state_root" => {
            serde_json::json!({ "root": engine.compute_state_root() })
        }
        "snapshot" => {
            let snap = engine.snapshot();
            serde_json::json!({
                "stateRoot": snap.state_root,
                "mmrRoot": snap.mmr_root,
                "logSize": snap.log_size,
                "assetCount": snap.asset_count,
                "nonceCount": snap.nonce_count,
            })
        }
        _ => serde_json::json!({ "error": format!("Unknown command: {}", cmd) }),
    };

    println!("{}", result);
}

fn parse_tx(v: &serde_json::Value) -> ndap_core::Transaction {
    ndap_core::Transaction {
        id: v["id"].as_str().unwrap_or("").to_string(),
        from_did: v["fromDID"].as_str().unwrap_or("").to_string(),
        to_did: v["toDID"].as_str().unwrap_or("").to_string(),
        asset_id: v["assetId"].as_str().unwrap_or("").to_string(),
        amount: v["amount"].as_i64().unwrap_or(0),
        nonce: v["nonce"].as_str().unwrap_or("").to_string(),
        timestamp: v["timestamp"].as_u64().unwrap_or(0),
        signature: v["signature"].as_str().map(|s| s.to_string()),
    }
}
