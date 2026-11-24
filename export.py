#!/usr/bin/env python3
"""
export.py — operator-side exporter.

Usage:
    python export.py out.json [--db db.sqlite] [--player-client-seed SEED]

Produces the operator_published.json consumed by verify.py:
  - every rotation (id, commitment, revealed_seed if revealed, next_rotation_id)
  - every merkle_epoch (epoch, root, first/last round id, leaf_count)
  - per-round inclusion proofs (for rounds the operator chooses to expose,
    or for a specific player's client_seed when --player-client-seed is given)
"""
import sys, json, sqlite3, argparse, hashlib

# ---- must be byte-identical to verify.py ----
def H(b: bytes) -> bytes: return hashlib.sha256(b).digest()

def leaf_hash(r: dict) -> bytes:
    payload = json.dumps({
        "rotation_id": r["rotation_id"],
        "client_seed": r["client_seed"],
        "nonce":       r["nonce"],
        "result_hash": r["result_hash"],
        "outcome":     r["outcome"],
        "bet_amount":  str(r["bet_amount"]),
    }, sort_keys=True, separators=(",", ":")).encode()
    return H(b"\x00" + payload)

def node_hash(l, r): return H(b"\x01" + l + r)

def merkle_root(leaves):
    if not leaves: return H(b"")
    level = leaves[:]
    while len(level) > 1:
        if len(level) % 2: level.append(level[-1])
        level = [node_hash(level[i], level[i+1]) for i in range(0, len(level), 2)]
    return level[0]

def merkle_proof(leaves, index):
    proof, level, idx = [], leaves[:], index
    while len(level) > 1:
        if len(level) % 2: level.append(level[-1])
        sib = idx ^ 1
        proof.append([level[sib].hex(), "right" if idx % 2 == 0 else "left"])
        idx //= 2
        level = [node_hash(level[i], level[i+1]) for i in range(0, len(level), 2)]
    return proof

# ---- DB -> published JSON ----
def export(db_path, out_path, player_client_seed=None):
    con = sqlite3.connect(db_path); con.row_factory = sqlite3.Row

    rotations = []
    for r in con.execute("""
        SELECT id, commitment, revealed_at,
               CASE WHEN revealed_at IS NOT NULL THEN server_seed END AS revealed_seed,
               next_rotation_id
        FROM seed_rotations ORDER BY id
    """):
        rotations.append(dict(r))

    epochs = [dict(e) for e in con.execute(
        "SELECT epoch, root, first_round_id, last_round_id, leaf_count "
        "FROM merkle_epochs ORDER BY epoch")]

    # rebuild leaves per epoch and emit proofs for chosen rounds
    inclusion_proofs = {}
    for e in epochs:
        rows = con.execute("""
            SELECT id AS global_round_id, rotation_id, client_seed, nonce,
                   result_hash, outcome, bet_amount
            FROM rounds
            WHERE state='settled'
              AND id BETWEEN ? AND ?
            ORDER BY id
        """, (e["first_round_id"], e["last_round_id"])).fetchall()

        leaves = [leaf_hash(dict(r)) for r in rows]
        if len(leaves) != e["leaf_count"]:
            raise SystemExit(f"epoch {e['epoch']}: leaf count mismatch "
                             f"(db {len(leaves)} vs claimed {e['leaf_count']})")
        if merkle_root(leaves).hex() != e["root"]:
            raise SystemExit(f"epoch {e['epoch']}: DB does not reproduce stored root "
                             f"— history was tampered with")

        for i, r in enumerate(rows):
            if player_client_seed is not None and r["client_seed"] != player_client_seed:
                continue
            inclusion_proofs[str(r["global_round_id"])] = {
                "epoch": e["epoch"],
                "proof": merkle_proof(leaves, i),
            }

    out = {"rotations": rotations, "merkle_epochs": epochs,
           "inclusion_proofs": inclusion_proofs}
    with open(out_path, "w") as f:
        json.dump(out, f, indent=2)
    print(f"wrote {out_path}: {len(rotations)} rotations, "
          f"{len(epochs)} epochs, {len(inclusion_proofs)} inclusion proofs")

if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("out")
    ap.add_argument("--db", default="provablyfair.sqlite")
    ap.add_argument("--player-client-seed", default=None,
                    help="only export inclusion proofs for this player's rounds")
    args = ap.parse_args()
    export(args.db, args.out, args.player_client_seed)
