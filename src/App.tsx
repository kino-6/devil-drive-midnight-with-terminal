import { useMemo, useReducer, useState } from 'react';

type NodeType = 'start' | 'road' | 'entity' | 'wreck' | 'combat' | 'signal' | 'return_gate' | 'unknown';
type ContractId = 'radio_voice' | 'silent_shape' | 'abandoned_ai_navi';
type EntityTone = 'hostile' | 'curious' | 'hungry' | 'lonely' | 'machine';
type NegotiationApproach = 'offer' | 'sync' | 'threaten' | 'listen';
type NegotiationResult = 'contract' | 'trade' | 'pass' | 'hostile';
type TerminalLogKind = 'warning' | 'contract' | 'damage' | 'system';

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

const initialState = (): State => ({
  phase: 'map',
  nodes: baseNodes,
  currentId: 'n0',
  fuel: 10,
  armor: 12,
  signal: 5,
  contracts: [],
  logs: [
    '> DEMON TERMINAL: ONLINE',
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
  return 'system';
};

const getNodeClass = (node: NodeData, state: State, current: NodeData) => {
  const isCurrent = node.id === state.currentId;
  const isAvailable = current.next.includes(node.id) && state.phase === 'map' && !state.outcome;
  const isRevealed = node.done || isCurrent || current.next.includes(node.id);
  return [
    'route-node',
    `node--${node.type}`,
    node.type === 'return_gate' ? 'node--gate' : '',
    isCurrent ? 'node--current' : '',
    isAvailable ? 'node--available' : '',
    node.done ? 'node--done' : '',
    !isRevealed ? 'node--locked' : '',
  ].filter(Boolean).join(' ');
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
  const blocks = Array.from({ length: max }, (_, index) => index < Math.max(0, Math.min(max, value)));
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

function reducer(state: State, action: Action): State {
  if (action.type === 'RETRY') return initialState();

  if (state.outcome) return state;

  switch (action.type) {
    case 'MOVE': {
      const current = state.nodes.find((n) => n.id === state.currentId)!;
      if (!current.next.includes(action.nodeId)) return state;
      const nodes = state.nodes.map((node) => (node.id === state.currentId ? { ...node, done: true } : node));
      return {
        ...state,
        currentId: action.nodeId,
        phase: 'node',
        nodes,
        logs: [...state.logs, `> NAVI ROUTE CONFIRMED: ${action.nodeId.toUpperCase()}`],
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
  const [state, dispatch] = useReducer(reducer, undefined, initialState);
  const current = state.nodes.find((n) => n.id === state.currentId)!;
  const nextNodes = useMemo(() => current.next.map((id) => state.nodes.find((n) => n.id === id)!), [current.next, state.nodes]);
  const negotiationChances: Record<NegotiationApproach, number> = {
    offer: getNegotiationChance(state, 'offer'),
    sync: getNegotiationChance(state, 'sync'),
    threaten: getNegotiationChance(state, 'threaten'),
    listen: getNegotiationChance(state, 'listen'),
  };
  const terminalLogs = state.logs.filter((log) => !log.startsWith('M.O.E.:'));
  const moeLogs = state.logs.filter((log) => log.startsWith('M.O.E.:'));
  const depth = state.nodes.filter((node) => node.done).length;
  const runStatus = state.outcome ? state.outcome.toUpperCase() : state.phase.toUpperCase();
  const linkLabel = state.signal <= 1 ? 'SIGNAL WEAK' : state.contracts.some((c) => c.id === 'radio_voice') ? 'LINK: AM 666.0' : 'SIGNAL LOCKED';
  const liveMoeLine = getMoeLiveLine(state, current, depth);
  const currentNarrative = nodeNarratives[current.type];

  return <div className="dashboard-shell">
    {showPrologue && <section className="prologue-overlay" role="dialog" aria-label="Night Loop Prologue">
      <div className="prologue-card">
        <div className="prologue-kicker">00:00 / MIDNIGHT WINDOW</div>
        <h2>NIGHT LOOP BRIEFING</h2>
        <p>午前0時。巨大道路迷宮「夜環」が開く。通常車両では入口から戻れない。</p>
        <p>あなたは新米サルベージドライバー。持ち帰るのは異界部品、契約存在、そして生きて帰った記録。</p>
        <p>車載端末 <strong>Demon Terminal</strong> を起動。交渉回線は M.O.E. が握る。</p>
        <p>「今夜も潜ろう。帰還ログは、夜を越えた人にだけ残る。」</p>
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

      <aside className="route-panel panel">
        <div className="panel-title">
          <span>NIGHT LOOP ROUTE MAP</span>
          <small>D-COMP NAVI</small>
        </div>
        <div className="route-grid">{state.nodes.map((node, index) => {
          const isAvailable = current.next.includes(node.id) && state.phase === 'map' && !state.outcome;
          const isRevealed = node.done || node.id === state.currentId || current.next.includes(node.id);
          const nodeLabel = isRevealed ? node.name : 'UNKNOWN';
          return <button
            key={node.id}
            className={getNodeClass(node, state, current)}
            disabled={!isAvailable}
            onClick={() => dispatch({ type: 'MOVE', nodeId: node.id })}
          >
            <span className="route-node__index">{String(index).padStart(2, '0')}</span>
            <span className="route-node__icon">{isRevealed ? nodeIcons[node.type] : '?'}</span>
            <span className="route-node__body">
              <span className="route-node__name">{nodeLabel}</span>
              <span className="route-node__meta">{isRevealed ? node.type.replace('_', ' ').toUpperCase() : 'NO SIGNAL'}</span>
            </span>
            {(node.type === 'combat' || node.type === 'unknown') && isRevealed && <span className="danger-chip">DANGER</span>}
          </button>;
        })}</div>
      </aside>

      <main className="action-panel panel">
        <div className="panel-title">
          <span>CURRENT EVENT</span>
          <small>{current.type.replace('_', ' ').toUpperCase()}</small>
        </div>

        {state.phase === 'map' && !state.outcome && <section className="event-card">
          <div className="event-kicker">NAVI SELECT</div>
          <h2>夜環 深度 {String(depth).padStart(2, '0')} // 進行ルート選択</h2>
          <p>サルベージ対象ログを回収しつつ、帰還可能な経路を維持してください。接続可能な出口のみ琥珀色で照合中。</p>
          <div className="event-layer">
            <p className="event-layer__system">SYS: NAVIGATION GRID STABLE / DRIVER DISCRETION ADVISED</p>
            <p className="event-layer__moe">M.O.E.: 最短は安全じゃないし、安全は無料じゃない。どっちで行く？</p>
          </div>
          <div className="next-node-list">
            {nextNodes.map((n) => <div key={n.id} className={`next-node next-node--${n.type}`}>
              <span>{nodeIcons[n.type]}</span>
              <strong>{n.name}</strong>
              <small>{n.type.replace('_', ' ').toUpperCase()}</small>
            </div>)}
          </div>
        </section>}

        {state.phase === 'node' && <section className="event-card">
          <div className="event-kicker">NODE CONTACT</div>
          <h2>{current.name}</h2>
          <p>{current.detail}</p>
          <div className="event-layer">
            <p className="event-layer__system">SYS: {currentNarrative.system}</p>
            <p className="event-layer__moe">M.O.E.: {currentNarrative.moe}</p>
          </div>
          <div className="command-window">
            <button className="command-button" onClick={() => dispatch({ type: 'RESOLVE_NODE' })}>Resolve Node</button>
          </div>
        </section>}

        {state.phase === 'negotiation' && state.pendingContract && <section className="event-card">
          <div className="event-kicker">ENTITY NEGOTIATION</div>
          <h2>{state.pendingEntity?.name ?? current.name}</h2>
          <p>端末経由の交渉は短時間で決着します。提案を選び、失敗時の装甲損耗に備えてください。</p>
          <div className="event-layer">
            <p className="event-layer__system">SYS: DEMON TERMINAL CHANNEL STABLE / CONTRACT BUS STANDBY</p>
            <p className="event-layer__moe">M.O.E.: 交渉は優しさでも暴力でもなく、相手の欲望に名前をつける作業だよ。</p>
          </div>
          <div className="negotiation-grid">
            <p><span>Tone</span><strong>{state.pendingEntity?.tone.toUpperCase()}</strong></p>
            <p><span>Target Module</span><strong>{state.pendingContract.name}</strong></p>
            <p><span>Fail Penalty</span><strong>Armor -3</strong></p>
            <p><span>Reward</span><strong>{state.pendingContract.effect}</strong></p>
          </div>
          <div className="command-window command-window--grid">
            <button className="command-button" onClick={() => dispatch({ type: 'NEGOTIATE', approach: 'offer' })}>Offer Deal <span>{negotiationChances.offer}%</span></button>
            <button className="command-button" onClick={() => dispatch({ type: 'NEGOTIATE', approach: 'sync' })}>Sync Logic <span>{negotiationChances.sync}%</span></button>
            <button className="command-button" onClick={() => dispatch({ type: 'NEGOTIATE', approach: 'threaten' })}>Threaten / Flash <span>{negotiationChances.threaten}%</span></button>
            <button className="command-button" onClick={() => dispatch({ type: 'NEGOTIATE', approach: 'listen' })}>Answer / Listen <span>{negotiationChances.listen}%</span></button>
          </div>
        </section>}

        {state.phase === 'result' && <section className="event-card event-card--result">
          <div className="event-kicker">RUN RESULT</div>
          <h2>{state.outcome === 'win' ? 'RUN COMPLETE' : 'RUN LOST'}</h2>
          <p>{state.outcome === 'win' ? 'Return Gateを通過。契約モジュールと回収ログを保持したまま帰還。' : 'FuelまたはArmorが限界を下回り、車両端末は夜環内で停止。回収ログは断片のみ。'}</p>
          <div className="event-layer">
            <p className="event-layer__system">SYS: {state.outcome === 'win' ? 'RETURN CYCLE COMPLETE / ARCHIVE READY' : 'RUN INTERRUPTED / RECOVERY REQUIRED'}</p>
            <p className="event-layer__moe">M.O.E.: {state.outcome === 'win' ? 'おかえり、ドライバー。次はもう少し深く行ける。' : 'まだ終わってない。次の夜環で、続きを拾いに行こう。'}</p>
          </div>
          <div className="command-window">
            <button className="command-button" onClick={() => dispatch({ type: 'RETRY' })}>Retry</button>
          </div>
        </section>}
      </main>

      <section className="vehicle-panel panel">
        <div className="panel-title">
          <span>VEHICLE DASHBOARD</span>
          <small>DIAGNOSTICS</small>
        </div>
        <ResourceMeter label="Fuel" value={state.fuel} max={12} tone="fuel" />
        <ResourceMeter label="Armor" value={state.armor} max={12} tone="armor" />
        <ResourceMeter label="Signal" value={state.signal} max={10} tone="signal" />

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

      <footer className="terminal-panel panel">
        <section className="terminal">
          <div className="terminal__head">
            <strong>DEMON TERMINAL</strong>
            <span>{linkLabel}</span>
          </div>
          <ul>
            {terminalLogs.slice(-12).map((log, i) => <li key={`${log}-${i}`} className={`log-${classifyLog(log)}`}>
              <span>&gt;</span>{log}
            </li>)}
          </ul>
        </section>

        <section className="moe-panel">
          <div className="moe-nameplate">
            <span>M.O.E. // NAVI AI</span>
            <i aria-hidden="true" />
          </div>
          <div className="moe-dialogue">
            <p className="moe-live">「{liveMoeLine}」</p>
            {moeLogs.length === 0
              ? <p>「午前0時。夜環、開いたよ。今日はどこまで潜る？」</p>
              : moeLogs.slice(-3).map((log, i) => <p key={`${log}-${i}`}>「{log.replace('M.O.E.: ', '')}」</p>)}
          </div>
        </section>
      </footer>
    </div>
  </div>;
}
