import { useEffect, useMemo, useReducer, useRef, useState } from 'react';

type NodeType = 'start' | 'road' | 'entity' | 'wreck' | 'combat' | 'signal' | 'return_gate' | 'unknown';
type ContractId = 'radio_voice' | 'silent_shape' | 'abandoned_ai_navi';
type EntityTone = 'hostile' | 'curious' | 'hungry' | 'lonely' | 'machine';
type NegotiationApproach = 'offer' | 'sync' | 'threaten' | 'listen';
type NegotiationResult = 'contract' | 'trade' | 'pass' | 'hostile';
type TerminalLogKind = 'warning' | 'contract' | 'damage' | 'system' | 'route';
type EncounterId = 'whisper_broker' | 'roadside_phone' | 'silent_shape' | 'abandoned_ai_navi' | 'road_reaper';
type CommandId = 'attack' | 'talk' | 'analyze' | 'guard' | 'contract' | 'escape';

type Contract = { id: ContractId; name: string; effect: string };
type EntityProfile = { name: string; tone: EntityTone; hint: string };
type NodeData = { id: string; type: NodeType; name: string; detail: string; next: string[]; done?: boolean };

type State = {
  phase: 'map' | 'node' | 'negotiation' | 'result';
  nodes: NodeData[];
  currentId: string;
  fuel: number;
  armor: number;
  signal: number;
  contracts: Contract[];
  logs: string[];
  outcome?: 'win' | 'lose';
  failedNegotiations: number;
  pendingContract?: Contract;
  pendingEntity?: EntityProfile;
  negotiationResult?: NegotiationResult;
};

type Action =
  | { type: 'MOVE'; nodeId: string }
  | { type: 'RESOLVE_NODE' }
  | { type: 'NEGOTIATE'; approach: NegotiationApproach }
  | { type: 'RETRY' };

const contracts: Contract[] = [
  { id: 'radio_voice', name: 'Radio Voice', effect: 'Signal +2, 交渉成功率 +10%' },
  { id: 'silent_shape', name: 'Silent Shape', effect: 'Combat被ダメージ -4, Signal -1' },
  { id: 'abandoned_ai_navi', name: 'Abandoned AI Navi', effect: 'road消費Fuel -1（最低0）' },
];

const entityProfiles: EntityProfile[] = [
  { name: 'Whisper Broker', tone: 'hungry', hint: 'M.O.E.: この子、お腹が空いてるみたい。代価を示せば会話に乗る。' },
  { name: 'Dialtone Widow', tone: 'lonely', hint: 'M.O.E.: 声を待ってる。答えて、聞いてあげると落ち着く。' },
  { name: 'Latch Ghoul', tone: 'hostile', hint: 'M.O.E.: 怒ってる。でも、怖がってもいる。強めの姿勢が効くかも。' },
  { name: 'Null Choir', tone: 'machine', hint: 'M.O.E.: 機械語に近いね。感情より同期の方が通じそう。' },
  { name: 'Rearview Child', tone: 'curious', hint: 'M.O.E.: 興味で近づいてる。提案を見せれば反応が返る。' },
];

const baseNodes: NodeData[] = [
  { id: 'n0', type: 'start', name: 'Entry Ramp', detail: '夜環へ接続。', next: ['n1', 'n2'] },
  { id: 'n1', type: 'road', name: 'Long Bypass', detail: '燃料を使って進行。', next: ['n3', 'n4'] },
  { id: 'n2', type: 'signal', name: 'Signal Relay', detail: '通信中継でSignal回復。', next: ['n4'] },
  { id: 'n3', type: 'entity', name: 'Whisper Broker', detail: '異形との交渉。', next: ['n5'] },
  { id: 'n4', type: 'wreck', name: 'Wreck Zone', detail: '残骸漁り。', next: ['n5', 'n6'] },
  { id: 'n5', type: 'combat', name: 'Road Reaper', detail: '襲撃戦。', next: ['n7'] },
  { id: 'n6', type: 'unknown', name: 'Blind Tunnel', detail: '未知の位相。', next: ['n7'] },
  { id: 'n7', type: 'return_gate', name: 'Return Gate', detail: 'ゲート帰還。', next: [] },
];

const toneAffinity: Record<EntityTone, Partial<Record<NegotiationApproach, number>>> = {
  hungry: { offer: 20, listen: 5, sync: -5, threaten: -10 },
  machine: { sync: 20, offer: 5, threaten: -5, listen: -5 },
  hostile: { threaten: 15, offer: 5, sync: -10, listen: -10 },
  lonely: { listen: 20, offer: 5, sync: 0, threaten: -15 },
  curious: { offer: 10, sync: 10, listen: 5, threaten: -5 },
};

const nodeIcons: Record<NodeType, string> = {
  start: '●',
  road: '─',
  unknown: '?',
  entity: '◇',
  combat: '☠',
  wreck: '▣',
  signal: '◎',
  return_gate: '▲',
};

const contractLabels: Record<ContractId, string> = {
  radio_voice: 'AM 666.0',
  silent_shape: 'SILENT',
  abandoned_ai_navi: 'AI NAVI',
};

const nodeNarratives: Record<NodeType, { system: string; moe: string }> = {
  start: {
    system: 'D-COMP: ENTRY RAMP LINK STABLE. MIDNIGHT WINDOW ACTIVE.',
    moe: '最初の一歩が一番危ない。迷ったら、迷わない方を選んで。',
  },
  road: {
    system: 'SYS: LONG BYPASS OPEN. FUEL BURN RATE ELEVATED.',
    moe: '真っ直ぐな道ほど、何かを置いていくのが夜環の流儀。',
  },
  entity: {
    system: 'SYS: UNKNOWN ENTITY SIGNATURE WITHIN HAIL RANGE.',
    moe: '交渉は会話じゃなくて握手。先にどこを差し出すか、だけ。',
  },
  wreck: {
    system: 'SYS: WRECK CLUSTER DETECTED. SALVAGE PROTOCOL ENABLED.',
    moe: '拾えるものは拾おう。代わりに何か削れるけど、それも込みで。',
  },
  combat: {
    system: 'SYS: HOSTILE CONTACT CLOSING. IMPACT WINDOW IMMINENT.',
    moe: '来るよ。ハンドルは渡さないで、目だけは私に預けて。',
  },
  signal: {
    system: 'SYS: SIGNAL RELAY FOUND. HANDSHAKE CHANNEL OPEN.',
    moe: '雑音が減る。今のうちに深いところの声を拾っておこう。',
  },
  return_gate: {
    system: 'SYS: RETURN GATE LOCK DETECTED. EXIT VECTOR AVAILABLE.',
    moe: '帰るなら今。欲張るなら、その代償も今夜払う。',
  },
  unknown: {
    system: 'WARNING: BLIND TUNNEL PHASE SHIFT. TELEMETRY UNRELIABLE.',
    moe: 'ここは地図が嘘をつく区画。嘘でも進むなら、速度は落とさないで。',
  },
};

const encounterProfiles: Record<EncounterId, { label: string; subtitle: string; threat: 'LOW' | 'MED' | 'HIGH' | 'CRITICAL'; signal: string; contractable: boolean }> = {
  whisper_broker: {
    label: 'WHISPER BROKER',
    subtitle: 'A slim broker exchanging routes for promises.',
    threat: 'MED',
    signal: 'CONTRACT TRACE / VIOLET BAND',
    contractable: true,
  },
  roadside_phone: {
    label: 'ROADSIDE PHONE',
    subtitle: 'Ringing public line with an impossible child voice.',
    threat: 'MED',
    signal: 'VOICE CARRIER / AM 666.0',
    contractable: true,
  },
  silent_shape: {
    label: 'SILENT SHAPE',
    subtitle: 'A black mass that swallows engine noise.',
    threat: 'HIGH',
    signal: 'AUDIO NULL / EDGE BLUR',
    contractable: true,
  },
  abandoned_ai_navi: {
    label: 'ABANDONED AI NAVI',
    subtitle: 'Cracked guidance unit with haunted pathing.',
    threat: 'LOW',
    signal: 'LEGACY BUS / GHOST ARROW',
    contractable: true,
  },
  road_reaper: {
    label: 'ROAD REAPER',
    subtitle: 'Traffic marshal silhouette with terminal intent.',
    threat: 'CRITICAL',
    signal: 'HOSTILE SIGNAL / COLLISION VECTOR',
    contractable: false,
  },
};

const commandOptions: { id: CommandId; label: string; tone: 'danger' | 'contract' | 'route' | 'system' }[] = [
  { id: 'attack', label: 'Attack', tone: 'danger' },
  { id: 'talk', label: 'Talk', tone: 'route' },
  { id: 'analyze', label: 'Analyze', tone: 'system' },
  { id: 'guard', label: 'Guard', tone: 'system' },
  { id: 'contract', label: 'Contract', tone: 'contract' },
  { id: 'escape', label: 'Escape', tone: 'route' },
];

const commandDescriptions: Record<CommandId, { description: string; terminal: string; moe: string }> = {
  attack: {
    description: '前方の敵へ攻撃ルーチンを実行する。',
    terminal: 'COMBAT ROUTINE READY',
    moe: '中央から行く？ 了解、照準合わせる。',
  },
  talk: {
    description: '交渉可能な悪魔へ呼びかける。',
    terminal: 'NEGOTIATION CHANNEL OPEN',
    moe: '左のやつなら会話に乗るかも。',
  },
  analyze: {
    description: '敵の危険度と傾向を解析する。',
    terminal: 'SIGNATURE SCAN START',
    moe: '少し待って。署名を読む。',
  },
  contract: {
    description: '条件が揃っていれば契約を試みる。',
    terminal: 'CONTRACT PROTOCOL STANDBY',
    moe: '条件が揃えば積めるよ。',
  },
  guard: {
    description: '装甲姿勢を取り、被害を抑える。',
    terminal: 'DEFENSIVE POSTURE LOCKED',
    moe: '守りに入るね。衝撃を吸収する。',
  },
  escape: {
    description: '速度を上げて遭遇圏から離脱する。',
    terminal: 'THROTTLE OVERRIDE READY',
    moe: '逃げるなら今。ラインを開ける。',
  },
};

const getEncounterSquad = (activeEncounterId: EncounterId | null): EncounterId[] => {
  if (activeEncounterId === 'road_reaper') return ['silent_shape', 'road_reaper', 'roadside_phone'];
  if (activeEncounterId === 'silent_shape') return ['whisper_broker', 'silent_shape', 'roadside_phone'];
  if (activeEncounterId === 'whisper_broker') return ['silent_shape', 'whisper_broker', 'abandoned_ai_navi'];
  if (activeEncounterId === 'abandoned_ai_navi') return ['abandoned_ai_navi', 'roadside_phone', 'silent_shape'];
  if (activeEncounterId === 'roadside_phone') return ['roadside_phone', 'silent_shape', 'abandoned_ai_navi'];
  return ['whisper_broker', 'silent_shape', 'road_reaper'];
};

const initialState = (): State => ({
  phase: 'map',
  nodes: baseNodes,
  currentId: 'n0',
  fuel: 10,
  armor: 12,
  signal: 5,
  contracts: [],
  logs: [
    '> DEVIL TERMINAL: ONLINE',
    '> MIDNIGHT WINDOW: OPEN',
    '> DRIVER PROFILE: NOVICE SALVAGER',
    '> NIGHT LOOP NAVIGATION READY',
    'M.O.E.: 午前0時。夜環が開いたよ。今夜も潜ろう、ドライバー。',
    'M.O.E.: ルートを選択して。帰る道は、帰るって決めた人にしか見えない。',
  ],
  failedNegotiations: 0,
});

const hasContract = (s: State, id: ContractId) => s.contracts.some((c) => c.id === id);

const getNegotiationChance = (state: State, approach: NegotiationApproach): number => {
  const baseRate = 70;
  const signalBonus = Math.max(-15, Math.min(20, (state.signal - 5) * 5));
  const radioBonus = hasContract(state, 'radio_voice') ? 10 : 0;
  const failPenalty = state.failedNegotiations * -6;
  const contractLoadPenalty = Math.max(0, state.contracts.length - 1) * -8;
  const toneBonus = state.pendingEntity ? toneAffinity[state.pendingEntity.tone][approach] ?? 0 : 0;
  return Math.max(5, Math.min(95, baseRate + signalBonus + radioBonus + failPenalty + contractLoadPenalty + toneBonus));
};

const classifyLog = (log: string): TerminalLogKind => {
  if (log.includes('CONTRACT') || log.includes('契約')) return 'contract';
  if (log.includes('DAMAGE') || log.includes('Armor-') || log.includes('Fuel-') || log.includes('損耗') || log.includes('HOSTILE') || log.includes('Run Lost')) return 'damage';
  if (log.includes('WARNING') || log.includes('UNKNOWN') || log.includes('Unknown') || log.includes('AM 666') || log.includes('低下') || log.includes('警告')) return 'warning';
  if (log.includes('ROUTE') || log.includes('NAVI')) return 'route';
  return 'system';
};

const getLogBadge = (kind: TerminalLogKind) => {
  if (kind === 'warning') return 'WARN';
  if (kind === 'contract') return 'CNTR';
  if (kind === 'damage') return 'DMG';
  if (kind === 'route') return 'ROUTE';
  return 'SYS';
};

const getPseudoTimecode = (index: number, total: number, depth: number) => {
  const t = Math.max(0, (depth * 14) + (index - total + 18) * 3 + 12);
  const m = Math.floor(t / 60);
  const s = t % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
};

const getMoeMood = (state: State, current: NodeData) => {
  if (state.outcome === 'win') return 'RELIEVED';
  if (state.outcome === 'lose') return 'COLD';
  if (state.phase === 'negotiation') return 'CALCULATING';
  if (state.phase === 'node' && current.type === 'combat') return 'ALERT';
  if (state.phase === 'node' && current.type === 'entity') return 'CURIOUS';
  return 'GUIDING';
};

const getMoeLiveLine = (state: State, current: NodeData, depth: number): string => {
  if (state.outcome === 'win') return '門が閉じる前に戻れた。いい夜だった、って言っておく？';
  if (state.outcome === 'lose') return 'ここで停止か。次は私の警告を半分くらい信じて。';
  if (state.phase === 'negotiation') return '相手の欲しいものを当てて。正解はいつも一つじゃない。';
  if (state.phase === 'node') {
    if (current.type === 'combat') return '衝突まで数秒。恐怖より先に操作して。';
    if (current.type === 'unknown') return '未知位相。計器が黙っても、私の声は拾って。';
    if (current.type === 'entity') return '交渉圏内。言葉より代価が効く相手だよ。';
    if (current.type === 'return_gate') return '出口が見えてる。ここで終えるか、もう一歩か。';
    return nodeNarratives[current.type].moe;
  }
  if (state.negotiationResult === 'contract') return '契約完了。車が少しだけ、夜環の住人になったね。';
  if (depth === 0) return '新人ドライバー向けの夜はない。あるのは今夜だけ。';
  return '次の分岐を選んで。深く潜るほど、帰還ログの価値が上がる。';
};

function StatusLamp({ label, active = false, tone = 'green' }: { label: string; active?: boolean; tone?: 'green' | 'red' | 'amber' | 'cyan' }) {
  return <span className={`status-lamp status-lamp--${tone} ${active ? 'is-active' : ''}`}>
    <span className="status-lamp__bulb" />
    <span>{label}</span>
  </span>;
}

function ResourceMeter({ label, value, max, tone }: { label: string; value: number; max: number; tone: 'fuel' | 'armor' | 'signal' }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  const isLow = tone !== 'signal' && pct <= 35;
  const blockCount = Math.min(max, 12);
  const filledBlocks = Math.round((pct / 100) * blockCount);
  const blocks = Array.from({ length: blockCount }, (_, index) => index < filledBlocks);
  return <div className={`resource-meter resource-meter--${tone} ${isLow ? 'resource-meter--low' : ''}`}>
    <div className="resource-meter__head">
      <span>{label.toUpperCase()}</span>
      <span>{String(Math.max(0, value)).padStart(2, '0')} / {String(max).padStart(2, '0')}</span>
    </div>
    <div className="resource-meter__bar" aria-label={`${label} ${value} of ${max}`}>
      <span style={{ width: `${pct}%` }} />
    </div>
    <div className="resource-meter__blocks" aria-hidden="true">
      {blocks.map((filled, index) => <span key={index} className={filled ? 'is-filled' : ''} />)}
    </div>
  </div>;
}

function EncounterVisual({ profile, pulse }: { profile: EncounterId; pulse: boolean }) {
  const data = encounterProfiles[profile];

  const art = profile === 'roadside_phone'
    ? <svg viewBox="0 0 220 150" role="img" aria-label="Roadside Phone silhouette">
      <g fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
        <rect x="85" y="36" width="50" height="72" rx="4" />
        <rect x="95" y="47" width="30" height="24" rx="2" />
        <path d="M72 46c7-10 18-10 25 0m26 0c7-10 18-10 25 0" />
        <path d="M110 70v24m0 0c-12 6-20 18-20 32m20-32c12 6 20 18 20 32" />
        <path d="M63 130h94" />
        <path d="M71 48c-6 13-10 30-10 46" opacity=".55" />
      </g>
    </svg>
    : profile === 'whisper_broker'
      ? <svg viewBox="0 0 220 150" role="img" aria-label="Whisper Broker silhouette">
        <g fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
          <path d="M110 24c10 0 18 8 18 18v12H92V42c0-10 8-18 18-18z" />
          <path d="M84 60c8-9 44-9 52 0l-9 66H93z" fill="currentColor" fillOpacity=".26" />
          <path d="M95 78c7-5 24-5 31 0M97 94c6-5 22-5 28 0" />
          <path d="M110 126v28m0-19l-22 19m22-15l22 19" />
          <path d="M76 73l-18 25m86-25l18 25" opacity=".6" />
        </g>
      </svg>
      : profile === 'silent_shape'
      ? <svg viewBox="0 0 220 150" role="img" aria-label="Silent Shape silhouette">
        <defs>
          <radialGradient id="silentMist" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="currentColor" stopOpacity=".55" />
            <stop offset="100%" stopColor="currentColor" stopOpacity=".05" />
          </radialGradient>
        </defs>
        <ellipse cx="110" cy="76" rx="60" ry="42" fill="url(#silentMist)" />
        <path d="M79 120c9-30-6-35 10-70 8-19 35-19 43 2 13 35-1 40 10 68-11-6-22-7-32-7s-21 1-31 7z" fill="currentColor" fillOpacity=".55" />
        <path d="M78 84c20-17 43-16 64 0" stroke="currentColor" strokeWidth="2" fill="none" opacity=".55" />
      </svg>
      : profile === 'abandoned_ai_navi'
        ? <svg viewBox="0 0 220 150" role="img" aria-label="Abandoned AI Navi silhouette">
          <g fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="46" y="36" width="128" height="78" rx="8" />
            <path d="M58 50h104v50H58z" opacity=".45" />
            <path d="M72 84l26-20 18 10 22-18" />
            <path d="M139 62l11-7-2 13z" fill="currentColor" />
            <path d="M68 59l16 16m27-19l19 23m-8-7l15 15" opacity=".55" />
            <path d="M84 118h52" />
          </g>
        </svg>
        : <svg viewBox="0 0 220 150" role="img" aria-label="Road Reaper silhouette">
          <g fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M108 22h4v16h-4z" />
            <path d="M90 38h40v28H90z" />
            <path d="M110 66v38" />
            <path d="M110 80l-21 20m21-15l21 19" />
            <path d="M98 52h24m-24 7h24" />
            <path d="M75 122h70" />
            <path d="M87 42l-20 14m86-14l20 14" opacity=".6" />
            <path d="M70 64h16m48 0h16" opacity=".5" />
          </g>
        </svg>;

  return <section className={`encounter-visual ${pulse ? 'is-pulse' : ''} ${data.contractable ? 'encounter-visual--contractable' : 'encounter-visual--hostile'}`}>
    <div className="encounter-visual__header">
      <span>ENCOUNTER VISUAL LOCK</span>
      <span className={`encounter-visual__threat encounter-visual__threat--${data.threat.toLowerCase()}`}>THREAT {data.threat}</span>
    </div>
    <div className="encounter-visual__body">
      <div className="encounter-visual__art">{art}</div>
      <div className="encounter-visual__meta">
        <strong>{data.label}</strong>
        <p>{data.subtitle}</p>
        <div className="encounter-visual__tags">
          <span>{data.contractable ? 'CONTRACTABLE PRESENCE' : 'HOSTILE SIGNAL'}</span>
          <span>{data.signal}</span>
        </div>
      </div>
    </div>
    <div className="encounter-visual__noise" aria-hidden="true" />
  </section>;
}

function BattleDevilSprite({ profile, focused, lane, onSelect }: { profile: EncounterId; focused: boolean; lane: 'left' | 'center' | 'right'; onSelect: () => void }) {
  const data = encounterProfiles[profile];
  const art = profile === 'whisper_broker'
    ? <svg viewBox="0 0 180 180" role="img" aria-label="Whisper Broker silhouette">
      <g fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
        <path d="M90 28c10 0 18 8 18 18v10h-36V46c0-10 8-18 18-18z" />
        <path d="M68 62c8-8 36-8 44 0l-8 64H76z" fill="currentColor" fillOpacity=".3" />
        <path d="M76 74c6-5 22-5 28 0M78 90c6-5 20-5 26 0" />
        <path d="M90 126v34m0-22l-20 20m20-16l20 20" />
        <path d="M58 74l-18 26m82-26l18 26" opacity=".6" />
      </g>
    </svg>
    : profile === 'road_reaper'
      ? <svg viewBox="0 0 180 180" role="img" aria-label="Road Reaper silhouette">
        <g fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M88 18h4v20h-4z" />
          <rect x="64" y="40" width="52" height="34" />
          <path d="M90 74v52m0-30l-26 26m26-22l26 26" />
          <path d="M72 52h36m-36 8h36" />
          <path d="M50 138h80" />
          <path d="M62 40l-22 16m78-16l22 16" opacity=".6" />
        </g>
      </svg>
      : profile === 'silent_shape'
        ? <svg viewBox="0 0 180 180" role="img" aria-label="Silent Shape silhouette">
          <defs>
            <radialGradient id="silentMass" cx="50%" cy="48%" r="58%">
              <stop offset="0%" stopColor="currentColor" stopOpacity=".62" />
              <stop offset="100%" stopColor="currentColor" stopOpacity=".05" />
            </radialGradient>
          </defs>
          <ellipse cx="90" cy="94" rx="62" ry="52" fill="url(#silentMass)" />
          <path d="M62 136c11-25-8-43 15-74 9-12 25-12 34 0 24 31 5 48 17 74-17-10-34-12-66 0z" fill="currentColor" fillOpacity=".4" />
        </svg>
        : profile === 'roadside_phone'
          ? <svg viewBox="0 0 180 180" role="img" aria-label="Roadside Phone silhouette">
            <g fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <rect x="64" y="36" width="52" height="88" rx="5" />
              <rect x="74" y="48" width="32" height="26" rx="2" />
              <path d="M58 48c7-10 16-10 22 0m20 0c7-10 16-10 22 0" />
              <path d="M90 74v34m0 0c-11 7-20 20-22 34m22-34c11 7 20 20 22 34" />
              <path d="M52 144h76" />
            </g>
          </svg>
          : <svg viewBox="0 0 180 180" role="img" aria-label="Abandoned AI Navi silhouette">
            <g fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="40" y="44" width="100" height="70" rx="9" />
              <path d="M54 58h72v42H54z" opacity=".45" />
              <path d="M66 86l22-16 16 8 18-14" />
              <path d="M123 66l10-6-2 12z" fill="currentColor" />
              <path d="M60 64l15 15m24-18l20 24" opacity=".5" />
            </g>
          </svg>;

  return <article
    className={`battle-devil battle-devil--${lane} ${focused ? 'is-focused' : ''} ${data.contractable ? 'is-contractable' : 'is-hostile'}`}
    onClick={onSelect}
    role="button"
    tabIndex={0}
    onKeyDown={(event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        onSelect();
      }
    }}
  >
    <div className="battle-devil__body">
      <div className="battle-devil__art">{art}</div>
      <div className="battle-devil__label">
        <strong>{data.label}</strong>
        <span>{data.contractable ? 'CONTRACTABLE' : 'HOSTILE'} / {data.threat}</span>
      </div>
    </div>
    {focused && <span className="battle-devil__target">TARGET LOCK</span>}
  </article>;
}

function reducer(state: State, action: Action): State {
  if (action.type === 'RETRY') return initialState();

  if (state.outcome) return state;

  switch (action.type) {
    case 'MOVE': {
      const current = state.nodes.find((n) => n.id === state.currentId)!;
      if (!current.next.includes(action.nodeId)) return state;
      const nodes = state.nodes.map((node) => (node.id === state.currentId ? { ...node, done: true } : node));
      const nextNode = state.nodes.find((node) => node.id === action.nodeId);
      const encounterLogs = nextNode?.type === 'entity'
        ? ['> SIGNAL ANOMALY DETECTED', '> VISUAL LOCK ACQUIRED: CONTRACTABLE PRESENCE']
        : nextNode?.type === 'combat'
          ? ['> HOSTILE SIGNAL DETECTED', '> VISUAL LOCK ACQUIRED: ROAD REAPER']
          : [];
      return {
        ...state,
        currentId: action.nodeId,
        phase: 'node',
        nodes,
        logs: [...state.logs, `> NAVI ROUTE CONFIRMED: ${action.nodeId.toUpperCase()}`, ...encounterLogs],
      };
    }
    case 'RESOLVE_NODE': {
      const node = state.nodes.find((n) => n.id === state.currentId)!;
      let fuel = state.fuel;
      let armor = state.armor;
      let signal = state.signal;
      const logs = [...state.logs];
      let phase: State['phase'] = 'map';
      let pendingContract = state.pendingContract;
      let pendingEntity = state.pendingEntity;
      if (node.type === 'road') {
        fuel -= Math.max(0, 2 - (hasContract(state, 'abandoned_ai_navi') ? 1 : 0));
        logs.push('> ROAD SEGMENT ENGAGED: FUEL DRAW REGISTERED');
        logs.push('M.O.E.: 直線区間を通過。燃料は予定どおり削れてる。');
      } else if (node.type === 'signal') {
        signal += 2;
        logs.push('> SIGNAL HANDSHAKE ACCEPTED');
        logs.push('M.O.E.: 通信が澄んだ。交渉ログの解像度が戻ったよ。');
      } else if (node.type === 'wreck') {
        fuel += 1;
        armor -= 1;
        logs.push('> SALVAGE EXTRACTED: Fuel+1 / Armor-1');
        logs.push('M.O.E.: 残骸から回収成功。車体は少し擦れたけどね。');
      } else if (node.type === 'combat') {
        armor -= hasContract(state, 'silent_shape') ? 2 : 6;
        fuel -= 1;
        logs.push('> HOSTILE IMPACT: Armor LOSS / Fuel-1');
        logs.push('M.O.E.: 交戦終了。大破じゃないだけ、まだ運がある。');
      } else if (node.type === 'unknown') {
        fuel -= 1;
        signal -= 1;
        logs.push('> WARNING: UNKNOWN PHASE DRIFT');
        logs.push('> TELEMETRY NOISE: Fuel-1 / Signal-1');
        logs.push('M.O.E.: 観測が乱れてる。見えてるもの全部は信じないで。');
      } else if (node.type === 'entity') {
        phase = 'negotiation';
        const pool = contracts.filter((c) => !state.contracts.some((owned) => owned.id === c.id));
        pendingContract = pool[0] ?? contracts[0];
        pendingEntity = entityProfiles.find((e) => e.name === node.name) ?? entityProfiles[0];
        logs.push('> UNKNOWN ENTITY DETECTED');
        logs.push('> NEGOTIATION CHANNEL OPEN');
        logs.push('M.O.E.: 交渉開始。成功率と失敗時ペナルティを確認して。');
        logs.push(pendingEntity.hint);
      } else if (node.type === 'return_gate') {
        return {
          ...state,
          phase: 'result',
          outcome: 'win',
          logs: [
            ...logs,
            '> RETURN GATE LOCK ACQUIRED',
            '> EXIT VECTOR CONFIRMED',
            'M.O.E.: 帰還ライン確保。ログと契約、ちゃんと持ち帰ろう。',
          ],
        };
      }

      if (fuel <= 0 || armor <= 0) {
        return {
          ...state,
          fuel,
          armor,
          signal,
          phase: 'result',
          outcome: 'lose',
          logs: [...logs, '> CRITICAL FAILURE: VEHICLE OFFLINE', 'M.O.E.: ここで途切れた。次はもう少しだけ、慎重に。'],
        };
      }

      if (signal <= 1) {
        logs.push('> WARNING: SIGNAL BELOW SAFE THRESHOLD');
        logs.push('M.O.E.: Signal低下。交渉難度が上がる、気をつけて。');
      }

      return { ...state, fuel, armor, signal, phase, pendingContract, pendingEntity, logs };
    }
    case 'NEGOTIATE': {
      if (state.phase !== 'negotiation' || !state.pendingContract || !state.pendingEntity) return state;
      const chance = getNegotiationChance(state, action.approach);
      const roll = 42;
      const success = roll <= chance;

      if (success) {
        const negotiationResult: NegotiationResult = action.approach === 'offer' ? 'contract' : action.approach === 'sync' ? 'trade' : 'pass';
        const baseLogs = [...state.logs, `交渉結果: ${negotiationResult.toUpperCase()} / ${state.pendingEntity.tone}`];
        if (negotiationResult === 'contract') {
          return {
            ...state,
            phase: 'map',
            contracts: [...state.contracts, state.pendingContract],
            signal: state.pendingContract.id === 'radio_voice' ? state.signal + 2 : state.signal,
            logs: [
              ...baseLogs,
              '> CONTRACT PROTOCOL START',
              '> ENTITY SIGNATURE CAPTURED',
              '> SIGNAL HANDSHAKE ACCEPTED',
              '> MODULE SLOT UPDATED',
              `> CONTRACT REGISTERED: ${state.pendingContract.name}`,
              'M.O.E.: 契約成立。いい取引だよ、たぶんね。',
            ],
            pendingContract: undefined,
            pendingEntity: undefined,
            negotiationResult,
          };
        }
        if (negotiationResult === 'trade') {
          return {
            ...state,
            phase: 'map',
            fuel: state.fuel + 1,
            signal: state.signal + 1,
            logs: [...baseLogs, '> LIMITED TRADE ACCEPTED: Fuel+1 / Signal+1', 'M.O.E.: 契約までは届かない。でも悪くない交換だった。'],
            pendingContract: undefined,
            pendingEntity: undefined,
            negotiationResult,
          };
        }
        return {
          ...state,
          phase: 'map',
          logs: [...baseLogs, '> CONTACT ENDED: NO CONTRACT BOUND', 'M.O.E.: 今日は観測だけ。次はもう少し深く踏み込もう。'],
          pendingContract: undefined,
          pendingEntity: undefined,
          negotiationResult,
        };
      }

      return {
        ...state,
        phase: 'map',
        armor: state.armor - 3,
        failedNegotiations: state.failedNegotiations + 1,
        logs: [...state.logs, `交渉結果: HOSTILE / ${state.pendingEntity.tone}`, '> NEGOTIATION COLLAPSE: Armor-3', 'M.O.E.: 交渉決裂。次は強気か、静かに寄るかを先に決めよう。'],
        pendingContract: undefined,
        pendingEntity: undefined,
        negotiationResult: 'hostile',
        ...(state.armor - 3 <= 0 ? { phase: 'result' as const, outcome: 'lose' as const } : {}),
      };
    }
  }
}

export function App() {
  const [showPrologue, setShowPrologue] = useState(true);
  const [encounterPulse, setEncounterPulse] = useState(false);
  const [selectedCommand, setSelectedCommand] = useState<CommandId>('talk');
  const [selectedTargetIndex, setSelectedTargetIndex] = useState(1);
  const [commandTelemetry, setCommandTelemetry] = useState<string[]>([]);
  const [state, dispatch] = useReducer(reducer, undefined, initialState);
  const terminalLogRef = useRef<HTMLUListElement | null>(null);
  const previousCommandRef = useRef<CommandId | null>(null);
  const current = state.nodes.find((n) => n.id === state.currentId)!;
  const nextNodes = useMemo(() => current.next.map((id) => state.nodes.find((n) => n.id === id)!), [current.next, state.nodes]);
  const negotiationChances: Record<NegotiationApproach, number> = {
    offer: getNegotiationChance(state, 'offer'),
    sync: getNegotiationChance(state, 'sync'),
    threaten: getNegotiationChance(state, 'threaten'),
    listen: getNegotiationChance(state, 'listen'),
  };
  const terminalLogs = state.logs.filter((log) => !log.startsWith('M.O.E.:'));
  const depth = state.nodes.filter((node) => node.done).length;
  const runStatus = state.outcome ? state.outcome.toUpperCase() : state.phase.toUpperCase();
  const linkLabel = state.signal <= 1 ? 'SIGNAL WEAK' : state.contracts.some((c) => c.id === 'radio_voice') ? 'LINK: AM 666.0' : 'SIGNAL LOCKED';
  const liveMoeLine = getMoeLiveLine(state, current, depth);
  const activeEncounterId: EncounterId | null = state.phase === 'negotiation' && state.pendingContract
    ? state.pendingContract.id === 'radio_voice'
      ? 'roadside_phone'
      : state.pendingContract.id === 'silent_shape'
        ? 'silent_shape'
        : 'abandoned_ai_navi'
    : state.phase === 'node' && current.type === 'entity'
      ? 'whisper_broker'
      : state.phase === 'node' && current.type === 'combat'
        ? 'road_reaper'
      : null;
  const isEncounterActive = activeEncounterId !== null;
  const encounterSquad = useMemo(() => getEncounterSquad(activeEncounterId), [activeEncounterId]);
  const focusEncounterId = encounterSquad[Math.max(0, Math.min(encounterSquad.length - 1, selectedTargetIndex))];
  const focusedEncounterProfile = encounterProfiles[focusEncounterId];
  const speed = state.phase === 'map' ? 92 : state.phase === 'negotiation' ? 74 : state.phase === 'result' ? 0 : 81;
  const terminalStatus = [
    linkLabel,
    state.phase === 'map' ? 'ROUTE LINK' : 'ROUTE ACTIVE',
    state.signal <= 2 ? 'NOISE HIGH' : 'NOISE LOW',
    state.contracts.some((contract) => contract.id === 'radio_voice') ? 'AM 666.0' : 'AM BAND CLOSED',
  ];
  const tacticalLines = [
    isEncounterActive ? 'ENTITY DETECTED' : 'ROAD SCAN ACTIVE',
    isEncounterActive ? (encounterSquad.length >= 3 ? 'MULTIPLE HOSTILES' : 'SINGLE CONTACT') : 'NO HOSTILES IN LANE',
    state.phase === 'negotiation' ? 'NEGOTIATION WINDOW OPEN' : 'CONTRACT CHANNEL STANDBY',
  ];
  const selectedCommandInfo = commandDescriptions[selectedCommand];
  const isContractAvailable = focusedEncounterProfile.contractable && (isEncounterActive || state.phase === 'negotiation');
  const commandEnabledMap: Record<CommandId, boolean> = {
    attack: isEncounterActive || state.phase === 'negotiation',
    talk: isEncounterActive || state.phase === 'negotiation',
    analyze: true,
    contract: isContractAvailable,
    guard: true,
    escape: true,
  };
  const commandUnavailableReason = selectedCommand === 'contract' && !isContractAvailable
    ? 'Contract: 対象が契約可能な状態ではない。'
    : null;
  const commandMoeLine = `M.O.E.: ${selectedCommandInfo.moe}`;
  const displayTerminalLogs = [...terminalLogs, ...commandTelemetry];
  useEffect(() => {
    if (!terminalLogRef.current) return;
    terminalLogRef.current.scrollTop = terminalLogRef.current.scrollHeight;
  }, [displayTerminalLogs.length]);

  useEffect(() => {
    if (!isEncounterActive) return;
    setEncounterPulse(true);
    const timer = setTimeout(() => setEncounterPulse(false), 550);
    return () => clearTimeout(timer);
  }, [isEncounterActive, state.currentId, state.phase]);

  useEffect(() => {
    const preferredIndex = activeEncounterId ? encounterSquad.findIndex((id) => id === activeEncounterId) : 1;
    setSelectedTargetIndex(preferredIndex < 0 ? 1 : preferredIndex);
  }, [activeEncounterId, encounterSquad]);

  useEffect(() => {
    if (showPrologue) return;
    if (previousCommandRef.current === selectedCommand) return;
    previousCommandRef.current = selectedCommand;
    const terminalLine = `> ${commandDescriptions[selectedCommand].terminal}`;
    setCommandTelemetry((prev) => [...prev, terminalLine].slice(-8));
  }, [selectedCommand, showPrologue]);

  useEffect(() => {
    if (showPrologue) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return;

      const currentIndex = commandOptions.findIndex((option) => option.id === selectedCommand);
      if (event.key === 'ArrowUp') {
        event.preventDefault();
        const next = (currentIndex - 1 + commandOptions.length) % commandOptions.length;
        setSelectedCommand(commandOptions[next].id);
        return;
      }
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        const next = (currentIndex + 1) % commandOptions.length;
        setSelectedCommand(commandOptions[next].id);
        return;
      }
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        setSelectedTargetIndex((prev) => (prev - 1 + encounterSquad.length) % encounterSquad.length);
        return;
      }
      if (event.key === 'ArrowRight') {
        event.preventDefault();
        setSelectedTargetIndex((prev) => (prev + 1) % encounterSquad.length);
        return;
      }
      if (/^[1-6]$/.test(event.key)) {
        event.preventDefault();
        const idx = Number(event.key) - 1;
        setSelectedCommand(commandOptions[idx].id);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [selectedCommand, encounterSquad, showPrologue]);

  return <div className={`dashboard-shell ${isEncounterActive ? 'is-encounter' : ''}`}>
    <div className="road-runner-bg" aria-hidden="true">
      <span className="road-runner-bg__lane" />
      <span className="road-runner-bg__lights" />
      <span className="road-runner-bg__fog" />
      <span className="road-runner-bg__noise" />
    </div>
    {showPrologue && <section className="prologue-overlay" role="dialog" aria-label="Night Loop Prologue">
      <div className="prologue-card">
        <div className="prologue-kicker">00:00 / MIDNIGHT WINDOW</div>
        <h2>NIGHT LOOP BRIEFING</h2>
        <p>午前0時。巨大道路迷宮「夜環」が開く。通常車両では入口から戻れない。</p>
        <p>あなたは新米サルベージドライバー。持ち帰るのは異界部品、契約存在、そして生きて帰った記録。</p>
        <p>車載端末 <strong>Devil Terminal</strong> を起動。交渉回線は M.O.E. が握る。</p>
        <p>「今夜も潜ろう。帰還ログは、夜を越えた人にだけ残る。」</p>
        <ul className="prologue-boot">
          <li>&gt; BOOT: D-COMP CHASSIS LINKED</li>
          <li>&gt; BOOT: NAVI CORE / M.O.E. ATTACHED</li>
          <li>&gt; BOOT: NIGHT LOOP GATE RESPONSE GREEN</li>
        </ul>
        <div className="prologue-actions">
          <button className="command-button" onClick={() => setShowPrologue(false)}>ENTER NIGHT LOOP</button>
          <button className="command-button command-button--ghost" onClick={() => setShowPrologue(false)}>START RUN</button>
        </div>
      </div>
    </section>}
    <div className="cockpit-frame">
      <header className="cockpit-header panel">
        <div className="brand-stack" aria-label="Devil Drive Midnight Terminal">
          <span>DEVIL DRIVE</span>
          <strong>MIDNIGHT TERMINAL</strong>
        </div>
        <div className="header-readouts">
          <div className="readout"><span>RUN STATUS</span><strong>{runStatus}</strong></div>
          <div className="readout"><span>DEPTH</span><strong>{String(depth).padStart(2, '0')}</strong></div>
          <div className="readout readout--wide"><span>CURRENT NODE</span><strong>{current.name}</strong></div>
          <div className="readout"><span>TIME</span><strong>00:00</strong></div>
        </div>
        <div className="lamp-row" aria-label="System indicators">
          <StatusLamp label="SYS" active tone={state.outcome === 'lose' ? 'red' : 'green'} />
          <StatusLamp label="NAVI" active={state.phase === 'map'} tone="cyan" />
          <StatusLamp label="WARN" active={state.fuel <= 3 || state.armor <= 3 || state.signal <= 1} tone="red" />
        </div>
      </header>

      <main className="action-panel panel">
        <div className="panel-title">
          <span>WINDSHIELD ENCOUNTER VIEW</span>
          <small>{isEncounterActive ? 'ENCOUNTER ACTIVE' : 'PATROL MODE'}</small>
        </div>
        <section className={`battle-view ${isEncounterActive ? 'is-hot' : ''}`}>
          <div className="battle-view__frame" aria-hidden="true">
            <span className="battle-view__pillar battle-view__pillar--left" />
            <span className="battle-view__pillar battle-view__pillar--right" />
            <span className="battle-view__dashboard-lip" />
          </div>
          <div className="battle-view__road">
            <span className="battle-view__roadline" />
            <span className="battle-view__rail battle-view__rail--left" />
            <span className="battle-view__rail battle-view__rail--right" />
            <span className="battle-view__viaduct" />
            <span className="battle-view__streetlights" />
            <span className="battle-view__city" />
            <span className="battle-view__speedlines" />
            <span className="battle-view__mist" />
          </div>
          <div className="battle-view__hud">
            <span>THREAT FIELD {isEncounterActive ? 'ACTIVE' : 'STANDBY'}</span>
            <strong>{focusedEncounterProfile.label}</strong>
          </div>
          {state.phase === 'map' && !state.outcome && <div className="battle-view__navi-select">
            <div className="battle-view__navi-head">
              <span>NAVI SELECT</span>
              <small>ROUTE LINK / DEPTH {String(depth).padStart(2, '0')}</small>
            </div>
            <div className="battle-view__route-list">
              {nextNodes.map((node) => <button
                key={`windshield-route-${node.id}`}
                type="button"
                className={`battle-route battle-route--${node.type}`}
                onClick={() => dispatch({ type: 'MOVE', nodeId: node.id })}
              >
                <span className="battle-route__icon">{nodeIcons[node.type]}</span>
                <span className="battle-route__main">
                  <strong>{node.name}</strong>
                  <small>{node.type.replace('_', ' ').toUpperCase()}</small>
                </span>
                <span className="battle-route__tag">MOVE</span>
              </button>)}
            </div>
            <p className="battle-view__navi-note">M.O.E.: ルートは前方ガラスに投影した。進路を選んで。</p>
          </div>}
          <div className="battle-view__devils">
            {state.phase !== 'map' && encounterSquad.map((encounterId, index) => <BattleDevilSprite
              key={`${encounterId}-${index}`}
              profile={encounterId}
              lane={index === 0 ? 'left' : index === 1 ? 'center' : 'right'}
              focused={focusEncounterId === encounterId}
              onSelect={() => setSelectedTargetIndex(index)}
            />)}
          </div>
        </section>

        <section className="battle-deck">
          <section className="terminal-stack panel">
            <section className={`terminal terminal-log ${isEncounterActive ? 'terminal--anomaly' : ''}`}>
              <div className="terminal__head terminal-status">
                <strong>DEVIL TERMINAL</strong>
                <span>{runStatus}</span>
              </div>
              <div className="terminal-status__chips">
                {terminalStatus.map((status) => <span key={status} className="terminal-status__chip">{status}</span>)}
                {tacticalLines.map((line) => <span key={line} className="terminal-status__chip terminal-status__chip--tactical">{line}</span>)}
              </div>
              <ul ref={terminalLogRef} className="terminal-log__list">
                {displayTerminalLogs.slice(-18).map((log, i, logs) => {
                  const kind = classifyLog(log);
                  return <li key={`${log}-${i}`} className={`terminal-log__line log-${kind} ${i === logs.length - 1 ? 'is-latest' : ''}`}>
                    <span className="terminal-log__time">{getPseudoTimecode(i, logs.length, depth)}</span>
                    <span className="terminal-log__badge">{getLogBadge(kind)}</span>
                    <span className="terminal-log__caret">&gt;</span>
                    <span className="terminal-log__text">{log}</span>
                  </li>;
                })}
              </ul>
            </section>

            <section className="radio-panel">
              <div className="radio-panel__head">
                <span>RADIO // M.O.E.</span>
                <small>{getMoeMood(state, current)} / {state.signal <= 2 ? 'NOISY' : 'CLEAR'}</small>
              </div>
              <div className="radio-bubble">
                <p className="moe-live">「{liveMoeLine}」</p>
                <p className="moe-command">「{commandMoeLine}」</p>
              </div>
            </section>
          </section>

          <section className={`command-core ${state.phase === 'map' ? 'command-core--standby' : ''}`}>
            <div className="panel-title panel-title--compact">
              <span>RPG COMMAND</span>
              <small>{state.phase === 'map' ? 'STANDBY / SELECT ROUTE' : 'SELECT ACTION'}</small>
            </div>
            <div className="command-window command-list command-window--grid">
              {commandOptions.map((command) => <button
                key={command.id}
                className={`command-button command-button--${command.tone} ${selectedCommand === command.id ? 'is-selected' : ''}`}
                onClick={() => setSelectedCommand(command.id)}
                disabled={!commandEnabledMap[command.id]}
                type="button"
                data-desc={commandDescriptions[command.id].description}
              >
                {command.label}
              </button>)}
            </div>
            <small className="command-hint">Keys: ↑↓ command / ←→ target / 1-6 quick select</small>
            {commandUnavailableReason && <small className="command-hint command-hint--warn">{commandUnavailableReason}</small>}
          </section>

          <section className="vehicle-panel vehicle-panel--inline panel">
            <div className="panel-title">
              <span>VEHICLE DASHBOARD</span>
              <small>SPD {String(speed).padStart(3, '0')} km/h</small>
            </div>
            <div className="vehicle-panel__meters">
              <ResourceMeter label="Fuel" value={state.fuel} max={12} tone="fuel" />
              <ResourceMeter label="Armor" value={state.armor} max={12} tone="armor" />
              <ResourceMeter label="Signal" value={state.signal} max={10} tone="signal" />
            </div>
            <div className="contract-slots">
              <div className="panel-title panel-title--compact">
                <span>CONTRACT SLOTS</span>
                <small>{state.contracts.length}/3</small>
              </div>
              {state.contracts.length === 0
                ? <div className="empty-slot">[EMPTY] No entity bound to the vehicle bus.</div>
                : state.contracts.map((contract) => <article key={contract.id} className={`module-card module-card--${contract.id.split('_').join('-')}`}>
                  <span className="module-card__band">[{contractLabels[contract.id]}]</span>
                  <strong>{contract.name}</strong>
                  <p>{contract.effect}</p>
                </article>)}
            </div>
          </section>
        </section>

        <section className="system-event-panel">
          {isEncounterActive && <div className="encounter-stinger">
            <span>{activeEncounterId === 'road_reaper' ? 'HOSTILE SIGNAL' : 'ENTITY DETECTED'}</span>
            <strong>{activeEncounterId === 'road_reaper' ? 'ROAD REAPER' : 'CONTRACTABLE PRESENCE'}</strong>
          </div>}

        {state.phase === 'node' && <section className="node-quickbar">
          <div className="node-quickbar__meta">
            <span className="node-quickbar__kicker">NODE CONTACT</span>
            <strong>{current.name}</strong>
            <small>{current.type.replace('_', ' ').toUpperCase()}</small>
          </div>
          <button className="command-button command-button--route" onClick={() => dispatch({ type: 'RESOLVE_NODE' })}>Resolve Node</button>
        </section>}

        {state.phase === 'negotiation' && state.pendingContract && <section className="event-card">
          <div className="event-header">
            <div className="event-kicker">ENTITY NEGOTIATION</div>
            <span className="event-chip event-chip--contract">CONTRACT WINDOW</span>
          </div>
          <h2>{state.pendingEntity?.name ?? current.name}</h2>
          <h3 className="event-subtitle">Devil Terminal Bargain Sequence</h3>
          <p>端末経由の交渉は短時間で決着します。提案を選び、失敗時の装甲損耗に備えてください。</p>
          <div className="event-layer">
            <p className="event-layer__system">SYS: DEVIL TERMINAL CHANNEL STABLE / CONTRACT BUS STANDBY</p>
            <p className="event-layer__moe">M.O.E.: 交渉は優しさでも暴力でもなく、相手の欲望に名前をつける作業だよ。</p>
          </div>
          {activeEncounterId && <EncounterVisual profile={activeEncounterId} pulse={encounterPulse} />}
          <div className="negotiation-grid">
            <p><span>Tone</span><strong>{state.pendingEntity?.tone.toUpperCase()}</strong></p>
            <p><span>Target Module</span><strong>{state.pendingContract.name}</strong></p>
            <p><span>Fail Penalty</span><strong>Armor -3</strong></p>
            <p><span>Reward</span><strong>{state.pendingContract.effect}</strong></p>
          </div>
          <div className="command-window command-window--grid command-list">
            <button className="command-button command-button--contract" onClick={() => dispatch({ type: 'NEGOTIATE', approach: 'offer' })}>Offer Deal <span>{negotiationChances.offer}%</span></button>
            <button className="command-button command-button--route" onClick={() => dispatch({ type: 'NEGOTIATE', approach: 'sync' })}>Sync Logic <span>{negotiationChances.sync}%</span></button>
            <button className="command-button command-button--danger" onClick={() => dispatch({ type: 'NEGOTIATE', approach: 'threaten' })}>Threaten / Flash <span>{negotiationChances.threaten}%</span></button>
            <button className="command-button command-button--system" onClick={() => dispatch({ type: 'NEGOTIATE', approach: 'listen' })}>Answer / Listen <span>{negotiationChances.listen}%</span></button>
          </div>
        </section>}

        {state.phase === 'result' && <section className="event-card event-card--result">
          <div className="event-header">
            <div className="event-kicker">RUN RESULT</div>
            <span className={`event-chip ${state.outcome === 'win' ? 'event-chip--route' : 'event-chip--danger'}`}>{state.outcome === 'win' ? 'RETURNED' : 'OFFLINE'}</span>
          </div>
          <h2>{state.outcome === 'win' ? 'RUN COMPLETE' : 'RUN LOST'}</h2>
          <h3 className="event-subtitle">Midnight Cycle Report</h3>
          <p>{state.outcome === 'win' ? 'Return Gateを通過。契約モジュールと回収ログを保持したまま帰還。' : 'FuelまたはArmorが限界を下回り、車両端末は夜環内で停止。回収ログは断片のみ。'}</p>
          <div className="event-layer">
            <p className="event-layer__system">SYS: {state.outcome === 'win' ? 'RETURN CYCLE COMPLETE / ARCHIVE READY' : 'RUN INTERRUPTED / RECOVERY REQUIRED'}</p>
            <p className="event-layer__moe">M.O.E.: {state.outcome === 'win' ? 'おかえり、ドライバー。次はもう少し深く行ける。' : 'まだ終わってない。次の夜環で、続きを拾いに行こう。'}</p>
          </div>
          <div className="command-window command-list">
            <button className="command-button command-button--route" onClick={() => dispatch({ type: 'RETRY' })}>Retry</button>
          </div>
        </section>}
        </section>
      </main>
    </div>
  </div>;
}
