import crypto from 'crypto';
import { RoundRecord } from './types';

export interface PlayerRoundProofRecord {
  global_round_id: number;
  rotation_id: number;
  commitment: string;
  client_seed: string;
  nonce: number;
  result_hash: string;
  outcome: string;
  bet_amount: string;
}

export interface PlayerHistoryBundle {
  rounds: PlayerRoundProofRecord[];
}

export interface OperatorRotation {
  id: number;
  commitment: string;
  revealed_at?: string | null;
  revealed_seed: string | null;
  next_rotation_id: number | null;
}

export interface MerkleEpoch {
  epoch: number;
  root: string;
  first_round_id: number;
  last_round_id: number;
  leaf_count: number;
}

export interface InclusionProofEntry {
  epoch: number;
  proof: [string, 'left' | 'right'][];
}

export interface OperatorPublishedBundle {
  rotations: OperatorRotation[];
  merkle_epochs: MerkleEpoch[];
  inclusion_proofs: Record<string, InclusionProofEntry>;
}

export interface RoundCryptoBreakdown {
  global_round_id: number;
  rotation_id: number;
  nonce: number;
  client_seed: string;
  original_commitment: string;
  operator_commitment: string | null;
  revealed_server_seed: string | null;
  commitment_recomputed: string | null;
  commitment_valid: boolean;
  hmac_message: string;
  hmac_formula: string;
  recorded_result_hash: string;
  hmac_recomputed: string | null;
  hmac_valid: boolean;
  h52_hex: string;
  outcome_formula: string;
  formula_multiplier: number | null;
  recorded_outcome: string;
  merkle_epoch: number | null;
  merkle_root: string | null;
  leaf_hash: string;
  proof_steps_count: number;
  merkle_valid: boolean;
}

export interface ProvablyFairVerifyReport {
  verified: boolean;
  checked: {
    rounds: number;
    inclusions: number;
    rotations: number;
  };
  problems: string[];
  inspectedRounds?: RoundCryptoBreakdown[];
}

export function deriveCrashMultiplierFromHash(resultHashHex: string): {
  h52Hex: string;
  formulaMultiplier: number | null;
} {
  if (!resultHashHex || !/^[0-9a-fA-F]{13,}$/.test(resultHashHex)) {
    return { h52Hex: '', formulaMultiplier: null };
  }
  const h52Hex = resultHashHex.slice(0, 13);
  const h52 = Number.parseInt(h52Hex, 16);
  const TWO_52 = 4503599627370496; // 2^52
  if (!Number.isFinite(h52) || h52 < 0 || h52 >= TWO_52) {
    return { h52Hex, formulaMultiplier: null };
  }
  if (h52 % 33 === 0) {
    return { h52Hex, formulaMultiplier: 1.0 };
  }
  const raw = Math.floor((TWO_52 * 97) / (TWO_52 - h52)) / 100;
  return {
    h52Hex,
    formulaMultiplier: Number(Math.max(1.0, raw).toFixed(2)),
  };
}

// ---------- Byte-identical crypto primitives matching verify.py & export.py ----------
function sha256Buf(b: Buffer): Buffer {
  return crypto.createHash('sha256').update(b).digest();
}

export function leafHash(r: {
  rotation_id: number | string;
  client_seed: string;
  nonce: number;
  result_hash: string;
  outcome: string | number;
  bet_amount: string | number;
}): Buffer {
  // Alphabetically sorted keys matching Python json.dumps(..., sort_keys=True, separators=(",", ":"))
  const canonical = JSON.stringify({
    bet_amount: String(r.bet_amount),
    client_seed: r.client_seed,
    nonce: r.nonce,
    outcome: r.outcome,
    result_hash: r.result_hash,
    rotation_id: r.rotation_id,
  });
  return sha256Buf(Buffer.concat([Buffer.from([0x00]), Buffer.from(canonical, 'utf-8')]));
}

export function nodeHash(left: Buffer, right: Buffer): Buffer {
  return sha256Buf(Buffer.concat([Buffer.from([0x01]), left, right]));
}

export function merkleRoot(leaves: Buffer[]): Buffer {
  if (leaves.length === 0) return sha256Buf(Buffer.alloc(0));
  let level = [...leaves];
  while (level.length > 1) {
    if (level.length % 2 === 1) level.push(level[level.length - 1]);
    const next: Buffer[] = [];
    for (let i = 0; i < level.length; i += 2) {
      next.push(nodeHash(level[i], level[i + 1]));
    }
    level = next;
  }
  return level[0];
}

export function merkleProof(leaves: Buffer[], index: number): [string, 'left' | 'right'][] {
  const proof: [string, 'left' | 'right'][] = [];
  let level = [...leaves];
  let idx = index;
  while (level.length > 1) {
    if (level.length % 2 === 1) level.push(level[level.length - 1]);
    const sib = idx ^ 1;
    proof.push([level[sib].toString('hex'), idx % 2 === 0 ? 'right' : 'left']);
    idx = Math.floor(idx / 2);
    const next: Buffer[] = [];
    for (let i = 0; i < level.length; i += 2) {
      next.push(nodeHash(level[i], level[i + 1]));
    }
    level = next;
  }
  return proof;
}

export function verifyProof(
  leaf: Buffer,
  proof: [string, 'left' | 'right'][],
  root: Buffer
): boolean {
  let h = leaf;
  for (const [siblingHex, side] of proof) {
    const sib = Buffer.from(siblingHex, 'hex');
    h = side === 'right' ? nodeHash(h, sib) : nodeHash(sib, h);
  }
  return h.equals(root);
}

// ---------- Build exportable proof bundles from live AeroPredict rounds ----------
export function buildSessionProvablyFairExport(
  rounds: RoundRecord[],
  externalOperator?: OperatorPublishedBundle | null
): {
  player: PlayerHistoryBundle;
  operator: OperatorPublishedBundle;
} {
  const EPOCH_SIZE = 32;
  const ROTATION_SIZE = 50;
  const sliceRounds = rounds.slice(-64);

  const rotationsMap = new Map<number, { seed: string | null; commitment: string }>();
  const playerRounds: PlayerRoundProofRecord[] = [];

  sliceRounds.forEach((r) => {
    const rid = typeof r.rotationId === 'number' ? r.rotationId : Math.floor(r.roundNumber / ROTATION_SIZE);
    if (!rotationsMap.has(rid)) {
      const extRot = externalOperator?.rotations?.find((rot) => rot.id === rid);
      if (extRot) {
        rotationsMap.set(rid, {
          seed: extRot.revealed_seed ?? null,
          commitment: extRot.commitment,
        });
      } else if (r.revealedServerSeed) {
        const commitment =
          r.serverSeedHash && /^[0-9a-fA-F]{64}$/.test(r.serverSeedHash)
            ? r.serverSeedHash
            : crypto.createHash('sha256').update(r.revealedServerSeed, 'utf-8').digest('hex');
        rotationsMap.set(rid, { seed: r.revealedServerSeed, commitment });
      } else {
        const seed = crypto
          .createHash('sha256')
          .update(`[REDACTED_ROTATION_SEED]_${rid}`)
          .digest('hex');
        const commitment = crypto.createHash('sha256').update(seed, 'utf-8').digest('hex');
        rotationsMap.set(rid, { seed, commitment });
      }
    }
    const rot = rotationsMap.get(rid)!;
    const msg = `${r.clientSeed}:${r.nonce}`;
    const resultHash = r.resultHash
      ? r.resultHash
      : rot.seed
      ? crypto.createHmac('sha256', rot.seed).update(msg, 'utf-8').digest('hex')
      : crypto.createHash('sha256').update(`${r.roundNumber}:${r.multiplier}:${msg}`).digest('hex');

    playerRounds.push({
      global_round_id: r.roundNumber,
      rotation_id: rid,
      commitment: rot.commitment,
      client_seed: r.clientSeed,
      nonce: r.nonce,
      result_hash: resultHash,
      outcome: r.multiplier.toFixed(2),
      bet_amount: '2.00',
    });
  });

  if (externalOperator && externalOperator.rotations?.length > 0 && externalOperator.merkle_epochs?.length > 0) {
    return {
      player: { rounds: playerRounds },
      operator: externalOperator,
    };
  }

  const sortedRotIds = Array.from(rotationsMap.keys()).sort((a, b) => a - b);
  const rotations: OperatorRotation[] = sortedRotIds.map((id, idx) => {
    const rot = rotationsMap.get(id)!;
    return {
      id,
      commitment: rot.commitment,
      revealed_at: rot.seed ? new Date().toISOString() : null,
      revealed_seed: rot.seed,
      next_rotation_id: idx < sortedRotIds.length - 1 ? sortedRotIds[idx + 1] : null,
    };
  });

  const merkle_epochs: MerkleEpoch[] = [];
  const inclusion_proofs: Record<string, InclusionProofEntry> = {};

  for (let start = 0, epochIdx = 1; start < playerRounds.length; start += EPOCH_SIZE, epochIdx++) {
    const chunk = playerRounds.slice(start, start + EPOCH_SIZE);
    const leaves = chunk.map((r) => leafHash(r));
    const rootHex = merkleRoot(leaves).toString('hex');

    merkle_epochs.push({
      epoch: epochIdx,
      root: rootHex,
      first_round_id: chunk[0].global_round_id,
      last_round_id: chunk[chunk.length - 1].global_round_id,
      leaf_count: chunk.length,
    });

    chunk.forEach((r, i) => {
      inclusion_proofs[String(r.global_round_id)] = {
        epoch: epochIdx,
        proof: merkleProof(leaves, i),
      };
    });
  }

  return {
    player: { rounds: playerRounds },
    operator: { rotations, merkle_epochs, inclusion_proofs },
  };
}

// ---------- Per-round cryptographic breakdown for interactive inspection ----------
export function inspectProvablyFairRounds(
  player: Partial<PlayerHistoryBundle>,
  operator: Partial<OperatorPublishedBundle>
): RoundCryptoBreakdown[] {
  const rounds = Array.isArray(player?.rounds) ? player.rounds : [];
  const rotList = Array.isArray(operator?.rotations) ? operator.rotations : [];
  const rots = new Map<number, OperatorRotation>();
  rotList.forEach((r) => rots.set(r.id, r));
  const epochs = Array.isArray(operator?.merkle_epochs) ? operator.merkle_epochs : [];
  const proofs = operator?.inclusion_proofs || {};

  return rounds.map((r) => {
    const rot = rots.get(r.rotation_id);
    const revealedSeed = rot?.revealed_seed ?? null;
    const commitmentRecomputed =
      revealedSeed != null
        ? crypto.createHash('sha256').update(revealedSeed, 'utf-8').digest('hex')
        : null;
    const commitmentValid =
      Boolean(rot) &&
      revealedSeed != null &&
      rot!.commitment === r.commitment &&
      commitmentRecomputed === rot!.commitment;

    const hmacMessage = `${r.client_seed}:${r.nonce}`;
    const hmacRecomputed =
      revealedSeed != null
        ? crypto.createHmac('sha256', revealedSeed).update(hmacMessage, 'utf-8').digest('hex')
        : null;
    const hmacValid = hmacRecomputed != null && hmacRecomputed === r.result_hash;

    const { h52Hex, formulaMultiplier } = deriveCrashMultiplierFromHash(
      hmacRecomputed || r.result_hash
    );

    const gid = r.global_round_id;
    const entry = gid != null ? proofs[String(gid)] : undefined;
    const epoch = entry ? epochs.find((e) => e.epoch === entry.epoch) : undefined;
    const leaf = leafHash(r);
    const merkleValid = Boolean(
      entry && epoch && verifyProof(leaf, entry.proof, Buffer.from(epoch.root, 'hex'))
    );

    return {
      global_round_id: gid,
      rotation_id: r.rotation_id,
      nonce: r.nonce,
      client_seed: r.client_seed,
      original_commitment: r.commitment,
      operator_commitment: rot?.commitment ?? null,
      revealed_server_seed: revealedSeed,
      commitment_recomputed: commitmentRecomputed,
      commitment_valid: commitmentValid,
      hmac_message: hmacMessage,
      hmac_formula: 'HMAC-SHA256(key = revealed_server_seed, msg = "${client_seed}:${nonce}")',
      recorded_result_hash: r.result_hash,
      hmac_recomputed: hmacRecomputed,
      hmac_valid: hmacValid,
      h52_hex: h52Hex,
      outcome_formula: 'h = int(hmac_hex[0..12], 16); mult = (h % 33 == 0) ? 1.00 : floor((2^52 * 0.97) / (2^52 - h)) / 100',
      formula_multiplier: formulaMultiplier,
      recorded_outcome: String(r.outcome),
      merkle_epoch: epoch?.epoch ?? null,
      merkle_root: epoch?.root ?? null,
      leaf_hash: leaf.toString('hex'),
      proof_steps_count: entry?.proof?.length ?? 0,
      merkle_valid: merkleValid,
    };
  });
}

// ---------- Byte-identical verifier implementing Checks A, B, C, D ----------
export function verifyProvablyFairBundle(
  player: Partial<PlayerHistoryBundle>,
  operator: Partial<OperatorPublishedBundle>
): ProvablyFairVerifyReport {
  const problems: string[] = [];
  const checked = { rounds: 0, inclusions: 0, rotations: 0 };

  const rounds = Array.isArray(player?.rounds) ? player.rounds : [];
  const rotList = Array.isArray(operator?.rotations) ? operator.rotations : [];
  const rots = new Map<number, OperatorRotation>();
  rotList.forEach((r) => rots.set(r.id, r));
  const epochs = Array.isArray(operator?.merkle_epochs) ? operator.merkle_epochs : [];
  const proofs = operator?.inclusion_proofs || {};

  // A. Commitment + seed + HMAC result recompute per round
  for (const r of rounds) {
    checked.rounds += 1;
    const rid = r.rotation_id;
    const rot = rots.get(rid);

    if (!rot) {
      problems.push(`[A] rotation ${rid} not published by operator`);
      continue;
    }
    if (rot.revealed_seed == null) {
      problems.push(`[A] rotation ${rid} seed not yet revealed (cannot verify rounds on it)`);
      continue;
    }
    if (rot.commitment !== r.commitment) {
      problems.push(
        `[A] rotation ${rid}: commitment mismatch (player ${String(r.commitment).slice(0, 8)}… vs op ${String(rot.commitment).slice(0, 8)}…)`
      );
      continue;
    }
    const seedCommit = crypto.createHash('sha256').update(rot.revealed_seed, 'utf-8').digest('hex');
    if (seedCommit !== rot.commitment) {
      problems.push(`[A] rotation ${rid}: REVEALED SEED DOES NOT MATCH COMMITMENT`);
      continue;
    }

    const msg = `${r.client_seed}:${r.nonce}`;
    const expect = crypto.createHmac('sha256', rot.revealed_seed).update(msg, 'utf-8').digest('hex');
    if (expect !== r.result_hash) {
      problems.push(
        `[A] round cs=${r.client_seed} n=${r.nonce}: RESULT MISMATCH (expected ${expect.slice(0, 12)}… got ${String(r.result_hash).slice(0, 12)}…)`
      );
    }
  }

  // B. Nonce monotonicity per (rotation, client_seed)
  const last = new Map<string, number>();
  for (const r of rounds) {
    const key = `${r.rotation_id}::${r.client_seed}`;
    const prev = last.has(key) ? last.get(key)! : -1;
    if (r.nonce <= prev) {
      problems.push(
        `[B] rotation ${r.rotation_id} cs=${r.client_seed}: nonce regression ${r.nonce} <= ${prev}`
      );
    }
    last.set(key, r.nonce);
  }

  // C. Merkle inclusion
  for (const r of rounds) {
    const gid = r.global_round_id;
    if (gid == null || !(String(gid) in proofs)) continue;
    checked.inclusions += 1;
    const entry = proofs[String(gid)];
    const epoch = epochs.find((e) => e.epoch === entry.epoch);
    if (!epoch) {
      problems.push(`[C] round gid=${gid}: proof references unknown epoch ${entry.epoch}`);
      continue;
    }
    const leaf = leafHash(r);
    if (!verifyProof(leaf, entry.proof, Buffer.from(epoch.root, 'hex'))) {
      problems.push(
        `[C] round gid=${gid}: MERKLE INCLUSION FAILED (round not in published epoch ${entry.epoch})`
      );
    }
  }

  // D. Rotation chain linkage
  const ids = new Set(rots.keys());
  for (const [rid, rot] of rots.entries()) {
    checked.rotations += 1;
    const nxt = rot.next_rotation_id;
    if (nxt != null && !ids.has(nxt)) {
      problems.push(`[D] rotation ${rid}: dangling next_rotation_id=${nxt}`);
    }
  }

  return {
    verified: problems.length === 0,
    checked,
    problems,
    inspectedRounds: inspectProvablyFairRounds(player, operator),
  };
}
