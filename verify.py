#!/usr/bin/env python3
"""
verify.py — player-side provably-fair verifier.

Usage:
    python verify.py player_history.json operator_published.json [--verbose]

Exit code 0 = all verified, 1 = failures found, 2 = malformed input.

The player trusts ONLY their own player_history.json. Everything in
operator_published.json is treated as a CLAIM to be checked.
"""
import sys, json, hashlib, hmac, argparse

# ---------- crypto primitives (must match the operator's) ----------
def H(b: bytes) -> bytes:
    return hashlib.sha256(b).digest()

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

def node_hash(left: bytes, right: bytes) -> bytes:
    return H(b"\x01" + left + right)

def merkle_root(leaves):
    if not leaves:
        return H(b"")
    level = leaves[:]
    while len(level) > 1:
        if len(level) % 2:
            level.append(level[-1])
        level = [node_hash(level[i], level[i+1]) for i in range(0, len(level), 2)]
    return level[0]

def verify_proof(leaf: bytes, proof, root: bytes) -> bool:
    h = leaf
    for sibling_hex, side in proof:
        sib = bytes.fromhex(sibling_hex)
        h = node_hash(h, sib) if side == "right" else node_hash(sib, h)
    return h == root

# ---------- main verification ----------
def verify(player: dict, operator: dict, verbose=False):
    problems, checked = [], {"rounds": 0, "inclusions": 0, "rotations": 0}

    rounds = player.get("rounds", [])
    rots   = {r["id"]: r for r in operator.get("rotations", [])}
    epochs = operator.get("merkle_epochs", [])
    proofs = operator.get("inclusion_proofs", {})   # str(global_round_id) -> {proof, epoch}

    # ---- A. commitment + seed + result recompute, per round ----
    for r in rounds:
        checked["rounds"] += 1
        rid = r["rotation_id"]
        rot = rots.get(rid)

        if rot is None:
            problems.append(f"[A] rotation {rid} not published by operator")
            continue
        if rot.get("revealed_seed") is None:
            problems.append(f"[A] rotation {rid} seed not yet revealed "
                            f"(cannot verify rounds on it)")
            continue
        if rot["commitment"] != r["commitment"]:
            problems.append(
                f"[A] rotation {rid}: commitment mismatch "
                f"(player {r['commitment'][:8]}… vs op {rot['commitment'][:8]}…)"
            )
            continue
        if H(rot["revealed_seed"].encode()).hex() != rot["commitment"]:
            problems.append(f"[A] rotation {rid}: REVEALED SEED DOES NOT MATCH COMMITMENT")
            continue

        msg = f"{r['client_seed']}:{r['nonce']}".encode()
        expect = hmac.new(rot["revealed_seed"].encode(), msg, hashlib.sha256).hexdigest()
        if expect != r["result_hash"]:
            problems.append(
                f"[A] round cs={r['client_seed']} n={r['nonce']}: RESULT MISMATCH "
                f"(expected {expect[:12]}… got {r['result_hash'][:12]}…)"
            )

    # ---- B. nonce monotonicity per (rotation, client_seed) ----
    last = {}
    for r in rounds:
        key = (r["rotation_id"], r["client_seed"])
        prev = last.get(key, -1)
        if r["nonce"] <= prev:
            problems.append(
                f"[B] rotation {r['rotation_id']} cs={r['client_seed']}: "
                f"nonce regression {r['nonce']} <= {prev}"
            )
        last[key] = r["nonce"]

    # ---- C. Merkle inclusion (if proofs provided) ----
    for r in rounds:
        gid = r.get("global_round_id")
        if gid is None or str(gid) not in proofs:
            continue
        checked["inclusions"] += 1
        entry = proofs[str(gid)]
        epoch = next((e for e in epochs if e["epoch"] == entry["epoch"]), None)
        if epoch is None:
            problems.append(f"[C] round gid={gid}: proof references unknown epoch {entry['epoch']}")
            continue
        leaf = leaf_hash(r)
        if not verify_proof(leaf, entry["proof"], bytes.fromhex(epoch["root"])):
            problems.append(f"[C] round gid={gid}: MERKLE INCLUSION FAILED "
                            f"(round not in published epoch {entry['epoch']})")

    # ---- D. rotation chain linkage ----
    ids = set(rots)
    for rid, rot in rots.items():
        checked["rotations"] += 1
        nxt = rot.get("next_rotation_id")
        if nxt is not None and nxt not in ids:
            problems.append(f"[D] rotation {rid}: dangling next_rotation_id={nxt}")

    return problems, checked

# ---------- CLI ----------
def main():
    ap = argparse.ArgumentParser(description="Provably-fair player-side verifier")
    ap.add_argument("player_json")
    ap.add_argument("operator_json")
    ap.add_argument("--verbose", "-v", action="store_true")
    args = ap.parse_args()

    try:
        with open(args.player_json) as f: player = json.load(f)
        with open(args.operator_json) as f: operator = json.load(f)
    except (OSError, json.JSONDecodeError) as e:
        print(f"malformed input: {e}", file=sys.stderr)
        sys.exit(2)

    problems, checked = verify(player, operator, args.verbose)

    if args.verbose:
        print(f"checked: {checked['rounds']} rounds, "
              f"{checked['inclusions']} inclusions, "
              f"{checked['rotations']} rotations")

    if not problems:
        print("✅ All rounds verified against your own records.")
        sys.exit(0)

    print(f"❌ {len(problems)} problem(s) found:", file=sys.stderr)
    for p in problems:
        print("  " + p, file=sys.stderr)
    sys.exit(1)

if __name__ == "__main__":
    main()
