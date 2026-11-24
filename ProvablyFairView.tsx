import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Check,
  CheckCircle2,
  Copy,
  Download,
  Link2,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Terminal,
  Upload,
} from 'lucide-react';
import { ProvablyFairVerifyReport, RoundCryptoBreakdown } from '../provablyFairEngine';
import { copyTextSafely } from '../utils/clipboard';

interface CustomApiStatus {
  hasCustomApiUrl: boolean;
  hasServerApiKey: boolean;
  hasOperatorPublishedUrl: boolean;
  lastPullAt: string | null;
  lastPullStatus: 'idle' | 'ok' | 'error';
  lastPullMessage: string | null;
  lastPullHost: string | null;
  lastIngestAt: string | null;
  lastIngestCount: number;
  hasExternalOperatorBundle: boolean;
  provider: string;
}

interface ProvablyFairViewProps {
  onApiSynced?: (payload: {
    rounds?: any[];
    roundNumber?: number;
    trends?: any;
  }) => void;
}

export const ProvablyFairView: React.FC<ProvablyFairViewProps> = ({ onApiSynced }) => {
  const [playerJson, setPlayerJson] = useState('');
  const [operatorJson, setOperatorJson] = useState('');
  const [operatorSourceLabel, setOperatorSourceLabel] = useState<string>('Session Export');
  const [report, setReport] = useState<ProvablyFairVerifyReport | null>(null);
  const [selectedRoundId, setSelectedRoundId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Custom API integration state
  const [apiStatus, setApiStatus] = useState<CustomApiStatus | null>(null);
  const [feedUrlInput, setFeedUrlInput] = useState('');
  const [operatorUrlInput, setOperatorUrlInput] = useState('');
  const [authHeaderMode, setAuthHeaderMode] = useState<'bearer' | 'x-api-key'>('bearer');
  const [pullingApi, setPullingApi] = useState(false);
  const [apiFeedback, setApiFeedback] = useState<{ ok: boolean; message: string } | null>(null);

  const playerFileRef = useRef<HTMLInputElement | null>(null);
  const operatorFileRef = useRef<HTMLInputElement | null>(null);

  const handleCopy = async (key: string, value: string) => {
    await copyTextSafely(value);
    setCopiedKey(key);
    window.setTimeout(() => setCopiedKey(null), 1600);
  };

  const fetchCustomApiStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/aviator/custom-api/status');
      if (res.ok) {
        const data = await res.json();
        setApiStatus(data);
      }
    } catch {}
  }, []);

  const runVerification = useCallback(async (pRaw: string, oRaw: string) => {
    setParseError(null);
    let parsedPlayer: unknown;
    let parsedOperator: unknown;
    try {
      parsedPlayer = JSON.parse(pRaw);
      parsedOperator = JSON.parse(oRaw);
    } catch (e: any) {
      setParseError(`Malformed JSON input: ${e?.message || 'Invalid syntax'}`);
      setReport(null);
      return;
    }

    setVerifying(true);
    try {
      const res = await fetch('/api/aviator/provably-fair/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          player: parsedPlayer,
          operator: parsedOperator,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setParseError(data?.error || 'Verification failed.');
        setReport(null);
        return;
      }
      setReport(data.report);
      const inspected: RoundCryptoBreakdown[] = data.report?.inspectedRounds || [];
      if (inspected.length > 0) {
        setSelectedRoundId((prev) =>
          prev && inspected.some((r) => r.global_round_id === prev)
            ? prev
            : inspected[inspected.length - 1].global_round_id
        );
      }
    } catch {
      setParseError('Failed to reach verification endpoint.');
    } finally {
      setVerifying(false);
    }
  }, []);

  const loadLiveBundle = useCallback(async () => {
    setLoading(true);
    setParseError(null);
    try {
      const res = await fetch('/api/aviator/provably-fair/export');
      const data = await res.json();
      if (data?.success && data.player && data.operator) {
        const pStr = JSON.stringify(data.player, null, 2);
        const oStr = JSON.stringify(data.operator, null, 2);
        setPlayerJson(pStr);
        setOperatorJson(oStr);
        setOperatorSourceLabel(
          data.operatorSource === 'EXTERNAL_API' ? 'External Operator API' : 'Session Export'
        );
        await runVerification(pStr, oStr);
      } else {
        setParseError(data?.error || 'Failed to export session proofs.');
      }
    } catch {
      setParseError('Unable to fetch provably-fair proofs from server.');
    } finally {
      setLoading(false);
    }
  }, [runVerification]);

  useEffect(() => {
    loadLiveBundle();
    fetchCustomApiStatus();
  }, [loadLiveBundle, fetchCustomApiStatus]);

  const handlePullCustomApi = async (e: React.FormEvent) => {
    e.preventDefault();
    setPullingApi(true);
    setApiFeedback(null);
    try {
      const res = await fetch('/api/aviator/custom-api/pull', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          endpointUrl: feedUrlInput.trim() || undefined,
          operatorUrl: operatorUrlInput.trim() || undefined,
          authHeaderMode,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setApiFeedback({
          ok: false,
          message: data?.error || 'Failed to pull data from custom API.',
        });
        await fetchCustomApiStatus();
        return;
      }

      setApiFeedback({
        ok: true,
        message: data.message || 'Custom API synced cleanly.',
      });

      if (data.player && data.operator) {
        const pStr = JSON.stringify(data.player, null, 2);
        const oStr = JSON.stringify(data.operator, null, 2);
        setPlayerJson(pStr);
        setOperatorJson(oStr);
        setOperatorSourceLabel(data.hasOperatorBundle ? 'External Operator API' : 'Synced Feed Export');
        await runVerification(pStr, oStr);
      }

      if (onApiSynced) {
        onApiSynced({
          rounds: data.rounds,
          roundNumber: data.roundNumber,
          trends: data.trends,
        });
      }
      await fetchCustomApiStatus();
    } catch {
      setApiFeedback({
        ok: false,
        message: 'Network error communicating with backend API proxy.',
      });
    } finally {
      setPullingApi(false);
    }
  };

  const handleUploadJsonFile = async (
    file: File | undefined,
    target: 'player' | 'operator'
  ) => {
    if (!file) return;
    try {
      const text = await file.text();
      JSON.parse(text);
      if (target === 'player') {
        setPlayerJson(text);
        if (operatorJson) await runVerification(text, operatorJson);
      } else {
        setOperatorJson(text);
        setOperatorSourceLabel(`Uploaded: ${file.name}`);
        if (playerJson) await runVerification(playerJson, text);
      }
    } catch {
      setParseError(`Uploaded file "${file.name}" is not valid JSON.`);
    }
  };

  const downloadJson = (filename: string, content: string) => {
    const blob = new Blob([content], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const inspectedRounds = useMemo(
    () => report?.inspectedRounds || [],
    [report?.inspectedRounds]
  );

  const selectedRound: RoundCryptoBreakdown | null = useMemo(() => {
    if (inspectedRounds.length === 0) return null;
    if (selectedRoundId != null) {
      const match = inspectedRounds.find((r) => r.global_round_id === selectedRoundId);
      if (match) return match;
    }
    return inspectedRounds[inspectedRounds.length - 1];
  }, [inspectedRounds, selectedRoundId]);

  const parsedOperatorSummary = useMemo(() => {
    try {
      const op = JSON.parse(operatorJson || '{}');
      const rotations = Array.isArray(op.rotations) ? op.rotations.length : 0;
      const epochs = Array.isArray(op.merkle_epochs) ? op.merkle_epochs : [];
      const proofs = op.inclusion_proofs ? Object.keys(op.inclusion_proofs).length : 0;
      return { rotations, epochs, proofs };
    } catch {
      return { rotations: 0, epochs: [], proofs: 0 };
    }
  }, [operatorJson]);

  const sampleWebhookPayload = JSON.stringify(
    {
      rounds: [
        {
          round_id: 849497,
          multiplier: 2.41,
          commitment: 'sha256_of_revealed_server_seed',
          revealed_seed: 'hex_server_seed_when_revealed',
          client_seed: '[REDACTED_CLIENT_SEED]',
          nonce: 849497,
          result_hash: 'hmac_sha256_hex_digest',
        },
      ],
    },
    null,
    2
  );

  return (
    <div className="space-y-5">
      {/* Section 1: Cryptographic Round Breakdown & Provably-Fair Verifier */}
      <section className="rounded-xl bg-[#0D1320] border border-slate-800/80 p-5 sm:p-6 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-white">
              Provably Fair Cryptographic Inspector &amp; Verifier
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Inspects original server-seed commitment, revealed seed, client seed, nonce/round ID, operator publication bundle, and HMAC-SHA256 outcome derivation
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={loading}
              onClick={loadLiveBundle}
              className="h-9 px-3.5 rounded-lg bg-[#090D16] hover:bg-slate-800 disabled:opacity-50 border border-slate-700/80 text-xs font-medium text-slate-200 flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Load Live Proofs</span>
            </button>
            <button
              type="button"
              disabled={verifying || !playerJson || !operatorJson}
              onClick={() => runVerification(playerJson, operatorJson)}
              className="h-9 px-4 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-xs font-semibold text-white flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors"
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>{verifying ? 'Verifying...' : 'Run Verifier'}</span>
            </button>
          </div>
        </div>

        {parseError && (
          <div className="p-3.5 rounded-lg bg-rose-500/10 border border-rose-500/30 text-xs text-rose-300 flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 shrink-0" />
            <span>{parseError}</span>
          </div>
        )}

        {report && (
          <div
            className={`p-4 rounded-lg border space-y-3 ${
              report.verified
                ? 'bg-emerald-500/5 border-emerald-500/30'
                : 'bg-rose-500/5 border-rose-500/30'
            }`}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                {report.verified ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                ) : (
                  <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0" />
                )}
                <span
                  className={`text-xs font-semibold ${
                    report.verified ? 'text-emerald-300' : 'text-rose-300'
                  }`}
                >
                  {report.verified
                    ? 'All rounds verified against player records (Checks A–D passed).'
                    : `${report.problems.length} verification problem(s) detected`}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-3 text-xs font-mono text-slate-300 tabular-nums">
                <span>Rounds {report.checked.rounds}</span>
                <span aria-hidden="true">·</span>
                <span>Merkle Proofs {report.checked.inclusions}</span>
                <span aria-hidden="true">·</span>
                <span>Rotations {report.checked.rotations}</span>
              </div>
            </div>

            {report.problems.length > 0 && (
              <ul className="space-y-1 text-xs font-mono text-rose-200 bg-[#090D16] p-3 rounded-lg border border-rose-500/20 max-h-40 overflow-y-auto">
                {report.problems.map((p, idx) => (
                  <li key={idx}>• {p}</li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* Selected Round Cryptographic Proof Fields */}
        {selectedRound && (
          <div className="rounded-lg bg-[#090D16] border border-slate-800/80 p-4 sm:p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-800/80">
              <div>
                <h3 className="text-xs font-semibold text-white">
                  Round Cryptographic Proof Breakdown
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Operator Source: <span className="text-slate-200">{operatorSourceLabel}</span>
                </p>
              </div>

              <div className="flex items-center gap-2">
                <label htmlFor="inspect-round-select" className="text-xs text-slate-400 whitespace-nowrap">
                  Inspect Round
                </label>
                <select
                  id="inspect-round-select"
                  value={selectedRound.global_round_id}
                  onChange={(e) => setSelectedRoundId(Number(e.target.value))}
                  className="h-9 px-3 rounded-lg bg-[#0D1320] border border-slate-700/80 text-xs font-mono text-slate-100 tabular-nums focus:border-sky-500 focus:outline-none"
                >
                  {[...inspectedRounds].reverse().map((r) => (
                    <option key={r.global_round_id} value={r.global_round_id}>
                      #{r.global_round_id} · {r.recorded_outcome}x (Nonce {r.nonce})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* 6 Core Provably-Fair Fields Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {/* 1. Nonce / Round ID */}
              <div className="p-3.5 rounded-lg bg-[#0D1320] border border-slate-800/80 space-y-1">
                <div className="flex items-center justify-between text-[11px] text-slate-400">
                  <span>Nonce / Round ID</span>
                  <span className="font-mono text-sky-400 tabular-nums">
                    Rotation {selectedRound.rotation_id}
                  </span>
                </div>
                <div className="font-mono text-sm font-semibold text-white tabular-nums">
                  Round #{selectedRound.global_round_id} · Nonce {selectedRound.nonce}
                </div>
                <div className="text-[11px] font-mono text-slate-400 tabular-nums">
                  Settled Outcome: {selectedRound.recorded_outcome}x
                  {selectedRound.formula_multiplier != null
                    ? ` · 52-bit Curve: ${selectedRound.formula_multiplier.toFixed(2)}x`
                    : ''}
                </div>
              </div>

              {/* 2. Client Seed */}
              <div className="p-3.5 rounded-lg bg-[#0D1320] border border-slate-800/80 space-y-1">
                <div className="flex items-center justify-between text-[11px] text-slate-400">
                  <span>Client Seed</span>
                  <button
                    type="button"
                    onClick={() => handleCopy('client_seed', selectedRound.client_seed)}
                    className="text-sky-400 hover:text-sky-300 flex items-center gap-1 whitespace-nowrap"
                  >
                    {copiedKey === 'client_seed' ? (
                      <Check className="w-3 h-3" />
                    ) : (
                      <Copy className="w-3 h-3" />
                    )}
                    <span>{copiedKey === 'client_seed' ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
                <div className="font-mono text-xs text-slate-100 break-all">
                  {selectedRound.client_seed}
                </div>
              </div>

              {/* 3. Original Server-Seed Commitment */}
              <div className="p-3.5 rounded-lg bg-[#0D1320] border border-slate-800/80 space-y-1">
                <div className="flex items-center justify-between text-[11px] text-slate-400">
                  <span>Original Server-Seed Commitment (SHA-256)</span>
                  <span
                    className={`font-medium whitespace-nowrap ${
                      selectedRound.commitment_valid ? 'text-emerald-400' : 'text-amber-300'
                    }`}
                  >
                    {selectedRound.commitment_valid ? 'Commitment Match' : 'Unverified / Pending'}
                  </span>
                </div>
                <div className="flex items-start justify-between gap-2">
                  <div className="font-mono text-xs text-slate-100 break-all">
                    {selectedRound.original_commitment}
                  </div>
                  <button
                    type="button"
                    onClick={() => handleCopy('commitment', selectedRound.original_commitment)}
                    aria-label="Copy original server-seed commitment"
                    className="text-slate-400 hover:text-white shrink-0 p-1"
                  >
                    {copiedKey === 'commitment' ? (
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              </div>

              {/* 4. Revealed Server Seed */}
              <div className="p-3.5 rounded-lg bg-[#0D1320] border border-slate-800/80 space-y-1">
                <div className="flex items-center justify-between text-[11px] text-slate-400">
                  <span>Revealed Server Seed</span>
                  {selectedRound.revealed_server_seed && (
                    <button
                      type="button"
                      onClick={() =>
                        handleCopy('revealed_seed', selectedRound.revealed_server_seed || '')
                      }
                      className="text-sky-400 hover:text-sky-300 flex items-center gap-1 whitespace-nowrap"
                    >
                      {copiedKey === 'revealed_seed' ? (
                        <Check className="w-3 h-3" />
                      ) : (
                        <Copy className="w-3 h-3" />
                      )}
                      <span>{copiedKey === 'revealed_seed' ? 'Copied' : 'Copy'}</span>
                    </button>
                  )}
                </div>
                <div className="font-mono text-xs text-slate-100 break-all">
                  {selectedRound.revealed_server_seed ||
                    'Not yet revealed by operator (pre-rotation active)'}
                </div>
              </div>
            </div>

            {/* 5. HMAC & Outcome-Generation Formula */}
            <div className="p-3.5 rounded-lg bg-[#0D1320] border border-slate-800/80 space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-semibold text-white">
                  HMAC &amp; Outcome-Generation Formula
                </span>
                <span
                  className={`text-[11px] font-medium whitespace-nowrap ${
                    selectedRound.hmac_valid ? 'text-emerald-400' : 'text-rose-400'
                  }`}
                >
                  {selectedRound.hmac_valid ? 'HMAC-SHA256 Verified' : 'HMAC Mismatch / Unrevealed'}
                </span>
              </div>

              <div className="space-y-1.5 font-mono text-[11px] text-slate-300">
                <div className="flex flex-wrap gap-x-2">
                  <span className="text-slate-500">Commitment Check:</span>
                  <span className="text-sky-300">SHA-256(revealed_server_seed)</span>
                  <span className="text-slate-500">=</span>
                  <span className="text-slate-200 break-all">
                    {selectedRound.commitment_recomputed || 'pending reveal'}
                  </span>
                </div>
                <div className="flex flex-wrap gap-x-2">
                  <span className="text-slate-500">HMAC Message:</span>
                  <span className="text-slate-200 break-all">
                    "{selectedRound.hmac_message}"
                  </span>
                </div>
                <div className="flex flex-wrap gap-x-2">
                  <span className="text-slate-500">HMAC Output:</span>
                  <span className="text-sky-300">HMAC-SHA256(revealed_server_seed, message)</span>
                  <span className="text-slate-500">=</span>
                  <span className="text-slate-200 break-all">
                    {selectedRound.hmac_recomputed || selectedRound.recorded_result_hash}
                  </span>
                </div>
                <div className="flex flex-wrap gap-x-2">
                  <span className="text-slate-500">Crash Formula:</span>
                  <span className="text-amber-300">
                    h52 = 0x{selectedRound.h52_hex || '0'} · mult = (h52 % 33 === 0) ? 1.00 : floor((2^52 × 0.97) / (2^52 - h52)) / 100
                  </span>
                  {selectedRound.formula_multiplier != null && (
                    <span className="text-emerald-300 tabular-nums">
                      = {selectedRound.formula_multiplier.toFixed(2)}x
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap gap-x-2">
                  <span className="text-slate-500">Merkle Leaf:</span>
                  <span className="text-slate-300">
                    SHA-256(0x00 || canonical_json) = {selectedRound.leaf_hash.slice(0, 24)}… · Epoch{' '}
                    {selectedRound.merkle_epoch ?? '—'} ({selectedRound.proof_steps_count} sibling steps ·{' '}
                    {selectedRound.merkle_valid ? 'Included' : 'Not Included'})
                  </span>
                </div>
              </div>
            </div>

            {/* 6. Operator-Publication File Summary */}
            <div className="p-3.5 rounded-lg bg-[#0D1320] border border-slate-800/80 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-semibold text-white">
                  Operator-Publication File Summary ({operatorSourceLabel})
                </span>
                <span className="text-[11px] font-mono text-slate-400 tabular-nums">
                  {parsedOperatorSummary.rotations} rotations · {parsedOperatorSummary.epochs.length} Merkle epochs · {parsedOperatorSummary.proofs} proofs
                </span>
              </div>
              {parsedOperatorSummary.epochs.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] font-mono">
                  {parsedOperatorSummary.epochs.slice(0, 4).map((ep: any) => (
                    <div
                      key={ep.epoch}
                      className="px-2.5 py-2 rounded bg-[#090D16] border border-slate-800/70 text-slate-300 truncate tabular-nums"
                    >
                      Epoch {ep.epoch} (#{ep.first_round_id}–#{ep.last_round_id} · {ep.leaf_count} leaves) · Root {String(ep.root).slice(0, 14)}…
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Export / Upload JSON Payloads */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-mono font-medium text-slate-300">
                player_history.json (Player Trusted Log)
              </span>
              <div className="flex items-center gap-1.5">
                <input
                  ref={playerFileRef}
                  type="file"
                  accept="application/json,.json"
                  className="hidden"
                  onChange={(e) => {
                    handleUploadJsonFile(e.target.files?.[0], 'player');
                    e.target.value = '';
                  }}
                />
                <button
                  type="button"
                  onClick={() => playerFileRef.current?.click()}
                  className="h-8 px-2.5 rounded-lg bg-[#090D16] hover:bg-slate-800 border border-slate-700/80 text-xs font-medium text-slate-200 flex items-center gap-1.5 whitespace-nowrap"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Upload</span>
                </button>
                <button
                  type="button"
                  disabled={!playerJson}
                  onClick={() => downloadJson('player_history.json', playerJson)}
                  className="h-8 px-2.5 rounded-lg bg-[#090D16] hover:bg-slate-800 disabled:opacity-40 border border-slate-700/80 text-xs font-medium text-slate-200 flex items-center gap-1.5 whitespace-nowrap"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download</span>
                </button>
              </div>
            </div>
            <textarea
              rows={9}
              value={playerJson}
              onChange={(e) => setPlayerJson(e.target.value)}
              spellCheck={false}
              className="w-full rounded-lg bg-[#090D16] border border-slate-800/80 p-3 text-xs font-mono text-slate-200 focus:border-sky-500 focus:outline-none"
            />
          </div>

          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-mono font-medium text-slate-300">
                operator_published.json (Operator-Publication File)
              </span>
              <div className="flex items-center gap-1.5">
                <input
                  ref={operatorFileRef}
                  type="file"
                  accept="application/json,.json"
                  className="hidden"
                  onChange={(e) => {
                    handleUploadJsonFile(e.target.files?.[0], 'operator');
                    e.target.value = '';
                  }}
                />
                <button
                  type="button"
                  onClick={() => operatorFileRef.current?.click()}
                  className="h-8 px-2.5 rounded-lg bg-[#090D16] hover:bg-slate-800 border border-slate-700/80 text-xs font-medium text-slate-200 flex items-center gap-1.5 whitespace-nowrap"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Upload</span>
                </button>
                <button
                  type="button"
                  disabled={!operatorJson}
                  onClick={() => downloadJson('operator_published.json', operatorJson)}
                  className="h-8 px-2.5 rounded-lg bg-[#090D16] hover:bg-slate-800 disabled:opacity-40 border border-slate-700/80 text-xs font-medium text-slate-200 flex items-center gap-1.5 whitespace-nowrap"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download</span>
                </button>
              </div>
            </div>
            <textarea
              rows={9}
              value={operatorJson}
              onChange={(e) => setOperatorJson(e.target.value)}
              spellCheck={false}
              className="w-full rounded-lg bg-[#090D16] border border-slate-800/80 p-3 text-xs font-mono text-slate-200 focus:border-sky-500 focus:outline-none"
            />
          </div>
        </div>

        <div className="pt-3 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
          <span className="flex items-center gap-2 font-mono">
            <Terminal className="w-3.5 h-3.5 text-sky-400 shrink-0" />
            <span>
              CLI parity: <code className="text-slate-200">python3 verify.py player_history.json operator_published.json --verbose</code>
            </span>
          </span>
          <span className="text-emerald-400 font-medium">HMAC-SHA256 · Binary Merkle</span>
        </div>
      </section>

      {/* Section 2: Custom External API & Operator Feed Integration */}
      <section className="rounded-xl bg-[#0D1320] border border-slate-800/80 p-5 sm:p-6 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-white">
              Custom API &amp; Operator Feed Integration
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Connect your external Aviator API or operator-publication JSON endpoint via server-side proxy routes; API credentials stay strictly in server environment secrets
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 text-xs font-mono text-slate-400">
            <span>
              Feed Env:{' '}
              <span className={apiStatus?.hasCustomApiUrl ? 'text-emerald-400' : 'text-slate-300'}>
                {apiStatus?.hasCustomApiUrl ? 'Configured' : 'URL Input Ready'}
              </span>
            </span>
            <span aria-hidden="true">·</span>
            <span>
              Server API Key:{' '}
              <span className={apiStatus?.hasServerApiKey ? 'text-emerald-400' : 'text-slate-300'}>
                {apiStatus?.hasServerApiKey ? 'Active in Env' : 'Optional (Env)'}
              </span>
            </span>
          </div>
        </div>

        <form onSubmit={handlePullCustomApi} className="grid grid-cols-1 lg:grid-cols-12 gap-3">
          <div className="lg:col-span-5 space-y-1">
            <label htmlFor="custom-feed-url" className="text-xs font-medium text-slate-300">
              Rounds / Casino Feed Endpoint (HTTPS)
            </label>
            <input
              id="custom-feed-url"
              type="url"
              value={feedUrlInput}
              onChange={(e) => setFeedUrlInput(e.target.value)}
              placeholder="https://api.example.com/aviator/rounds"
              className="w-full h-9 px-3 rounded-lg bg-[#090D16] border border-slate-700/80 text-xs font-mono text-slate-100 placeholder-slate-500 focus:border-sky-500 focus:outline-none"
            />
          </div>

          <div className="lg:col-span-4 space-y-1">
            <label htmlFor="custom-operator-url" className="text-xs font-medium text-slate-300">
              Operator-Publication JSON URL (Optional)
            </label>
            <input
              id="custom-operator-url"
              type="url"
              value={operatorUrlInput}
              onChange={(e) => setOperatorUrlInput(e.target.value)}
              placeholder="https://api.example.com/operator_published.json"
              className="w-full h-9 px-3 rounded-lg bg-[#090D16] border border-slate-700/80 text-xs font-mono text-slate-100 placeholder-slate-500 focus:border-sky-500 focus:outline-none"
            />
          </div>

          <div className="lg:col-span-3 flex items-end gap-2">
            <select
              aria-label="Server API key header format"
              value={authHeaderMode}
              onChange={(e) =>
                setAuthHeaderMode(e.target.value === 'x-api-key' ? 'x-api-key' : 'bearer')
              }
              className="h-9 px-2.5 rounded-lg bg-[#090D16] border border-slate-700/80 text-xs font-mono text-slate-200 focus:border-sky-500 focus:outline-none"
            >
              <option value="bearer">Bearer Env</option>
              <option value="x-api-key">x-api-key Env</option>
            </select>

            <button
              type="submit"
              disabled={pullingApi}
              className="flex-1 h-9 px-3.5 rounded-lg bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-xs font-semibold text-white flex items-center justify-center gap-1.5 whitespace-nowrap transition-colors"
            >
              <Link2 className="w-3.5 h-3.5 shrink-0" />
              <span>{pullingApi ? 'Syncing...' : 'Pull & Sync API'}</span>
            </button>
          </div>
        </form>

        {apiFeedback && (
          <div
            className={`p-3 rounded-lg border text-xs flex items-center gap-2 ${
              apiFeedback.ok
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
            }`}
          >
            {apiFeedback.ok ? (
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            ) : (
              <ShieldAlert className="w-4 h-4 shrink-0" />
            )}
            <span>{apiFeedback.message}</span>
          </div>
        )}

        {/* Webhook Push / Direct API Schema Guide */}
        <div className="rounded-lg bg-[#090D16] border border-slate-800/80 p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-xs text-slate-300">
              <span className="font-semibold text-white">Direct Push Webhook:</span>{' '}
              <code className="font-mono text-sky-400">POST /api/aviator/custom-api/ingest</code>
              <span className="text-slate-500"> · Validates server-side </span>
              <code className="font-mono text-slate-300">CUSTOM_CASINO_API_KEY</code>
              <span className="text-slate-500"> when configured</span>
            </div>
            <button
              type="button"
              onClick={() => handleCopy('webhook_schema', sampleWebhookPayload)}
              className="h-8 px-2.5 rounded-lg bg-[#0D1320] hover:bg-slate-800 border border-slate-700/80 text-xs font-medium text-slate-200 flex items-center gap-1.5 whitespace-nowrap"
            >
              {copiedKey === 'webhook_schema' ? (
                <Check className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
              <span>{copiedKey === 'webhook_schema' ? 'Copied Schema' : 'Copy JSON Schema'}</span>
            </button>
          </div>
          <pre className="text-[11px] font-mono text-slate-300 overflow-x-auto leading-relaxed">
            {sampleWebhookPayload}
          </pre>
        </div>
      </section>
    </div>
  );
};
