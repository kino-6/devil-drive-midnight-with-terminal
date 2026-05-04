import { useMemo, useReducer } from 'react';

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

const initialState = (): State => ({
  phase: 'map',
  nodes: baseNodes,
  currentId: 'n0',
  fuel: 10,
  armor: 12,
  signal: 5,
  contracts: [],
  logs: ['M.O.E.: ルートを選択して夜環へ進入してください。'],
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
  if (log.includes('Armor-') || log.includes('損耗') || log.includes('HOSTILE') || log.includes('Run Lost')) return 'damage';
  if (log.includes('低下') || log.includes('Unknown') || log.includes('警告')) return 'warning';
  return 'system';
};

function reducer(state: State, action: Action): State {
  if (action.type === 'RETRY') return initialState();

  if (state.outcome) return state;

  switch (action.type) {
    case 'MOVE': {
      const current = state.nodes.find((n) => n.id === state.currentId)!;
      if (!current.next.includes(action.nodeId)) return state;
      const nodes = state.nodes.map((node) => (node.id === state.currentId ? { ...node, done: true } : node));
      return { ...state, currentId: action.nodeId, phase: 'node', nodes, logs: [...state.logs, `Move: ${action.nodeId}へ進行。`] };
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
        logs.push('Road: Fuel消費。');
      } else if (node.type === 'signal') {
        signal += 2;
        logs.push('Signal: 通信状態改善。');
      } else if (node.type === 'wreck') {
        fuel += 1;
        armor -= 1;
        logs.push('Wreck: Fuel+1 / Armor-1');
      } else if (node.type === 'combat') {
        armor -= hasContract(state, 'silent_shape') ? 2 : 6;
        fuel -= 1;
        logs.push('Combat: 交戦で損耗。');
      } else if (node.type === 'unknown') {
        fuel -= 1;
        signal -= 1;
        logs.push('Unknown: 位相乱れ。Fuel-1 / Signal-1');
      } else if (node.type === 'entity') {
        phase = 'negotiation';
        const pool = contracts.filter((c) => !state.contracts.some((owned) => owned.id === c.id));
        pendingContract = pool[0] ?? contracts[0];
        pendingEntity = entityProfiles.find((e) => e.name === node.name) ?? entityProfiles[0];
        logs.push('M.O.E.: 交渉開始。成功率と失敗時ペナルティを確認してください。');
        logs.push(pendingEntity.hint);
      } else if (node.type === 'return_gate') {
        return { ...state, phase: 'result', outcome: 'win', logs: [...logs, 'Return Gate到達。帰還成功。'] };
      }

      if (fuel <= 0 || armor <= 0) {
        return { ...state, fuel, armor, signal, phase: 'result', outcome: 'lose', logs: [...logs, '車両機能停止。Run Lost。'] };
      }

      if (signal <= 1) logs.push('M.O.E.: Signal低下。交渉難度が上昇。');

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
              '> MODULE SLOT UPDATED',
              `> CONTRACT REGISTERED: ${state.pendingContract.name}`,
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
            logs: [...baseLogs, '取引成立。Fuel+1 / Signal+1'],
            pendingContract: undefined,
            pendingEntity: undefined,
            negotiationResult,
          };
        }
        return {
          ...state,
          phase: 'map',
          logs: [...baseLogs, '相手は観測のみで離脱。今回は契約なし。'],
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
        logs: [...state.logs, `交渉結果: HOSTILE / ${state.pendingEntity.tone}`, '交渉失敗。Armor-3。'],
        pendingContract: undefined,
        pendingEntity: undefined,
        negotiationResult: 'hostile',
        ...(state.armor - 3 <= 0 ? { phase: 'result' as const, outcome: 'lose' as const } : {}),
      };
    }
  }
}

export function App() {
  const [state, dispatch] = useReducer(reducer, undefined, initialState);
  const current = state.nodes.find((n) => n.id === state.currentId)!;
  const nextNodes = useMemo(() => current.next.map((id) => state.nodes.find((n) => n.id === id)!), [current.next, state.nodes]);
  const offerChance = getNegotiationChance(state, 'offer');
  const terminalLogs = state.logs.filter((log) => !log.startsWith('M.O.E.:'));
  const moeLogs = state.logs.filter((log) => log.startsWith('M.O.E.:'));

  return <div className="ui">
    <header className="panel header-panel"><h1>DEMON TERMINAL DRIVE</h1><div className="run-status">Run Status: {state.outcome ? state.outcome.toUpperCase() : state.phase.toUpperCase()} / NODE: {current.name}</div></header>

    <aside className="panel route-panel"><h2>Route Map</h2><div className="route-grid">{state.nodes.map((node) => {
      const isCurrent = node.id === state.currentId;
      const isSelectable = current.next.includes(node.id) && state.phase === 'map' && !state.outcome;
      const isRevealed = node.done || node.id === state.currentId || current.next.includes(node.id);
      const statusClass = isCurrent ? 'current' : isSelectable ? 'selectable' : node.done ? 'reached' : isRevealed ? 'revealed' : 'unreached';
      return <button key={node.id} className={`route-node ${statusClass}`} disabled={!isSelectable} onClick={() => dispatch({ type: 'MOVE', nodeId: node.id })}>
        <span className="icon">{nodeIcons[node.type]}</span><span>{node.name}</span>
      </button>;
    })}</div></aside>

    <main className="panel center-panel">
      {state.phase === 'map' && !state.outcome && <div className="card"><h2>Current Event</h2><p>次のノードを選択してください。</p>{nextNodes.map((n) => <p key={n.id}>{n.type.toUpperCase()} / {n.name}</p>)}</div>}
      {state.phase === 'node' && <div className="card"><h2>{current.type.toUpperCase()}</h2><p>{current.detail}</p><button onClick={() => dispatch({ type: 'RESOLVE_NODE' })}>Resolve Node</button></div>}
      {state.phase === 'negotiation' && state.pendingContract && <div className="card"><h2>Negotiation Console</h2><p>Target: {state.pendingContract.name}</p><p>Tone Hint: {state.pendingEntity?.tone}</p><p>Success(Offer): {offerChance}%</p><p>Fail Penalty: Armor -3</p><p>Reward: {state.pendingContract.effect}</p><div className="actions"><button onClick={() => dispatch({ type: 'NEGOTIATE', approach: 'offer' })}>Offer Deal</button><button onClick={() => dispatch({ type: 'NEGOTIATE', approach: 'sync' })}>Sync Logic</button><button onClick={() => dispatch({ type: 'NEGOTIATE', approach: 'threaten' })}>Threaten / Flash</button><button onClick={() => dispatch({ type: 'NEGOTIATE', approach: 'listen' })}>Answer / Listen</button></div></div>}
      {state.phase === 'result' && <div className="card"><h2>{state.outcome === 'win' ? 'RUN COMPLETE' : 'RUN LOST'}</h2><button onClick={() => dispatch({ type: 'RETRY' })}>Retry</button></div>}
    </main>

    <section className="panel dashboard-panel"><h2>Dashboard</h2>
      {[{ label: 'Fuel', value: state.fuel, max: 12 }, { label: 'Armor', value: state.armor, max: 12 }, { label: 'Signal', value: state.signal, max: 10 }].map((meter) => {
        const pct = Math.max(0, Math.min(100, (meter.value / meter.max) * 100));
        return <div key={meter.label} className="meter"><div className="meter-head"><span>{meter.label}</span><span>{meter.value}</span></div><div className="meter-bar"><span style={{ width: `${pct}%` }} /></div></div>;
      })}
      <h3>Modules</h3>{state.contracts.length === 0 ? <p>None</p> : state.contracts.map((c) => <p key={c.id}>{c.name}</p>)}
    </section>

    <footer className="panel log-panel">
      <div className="terminal"><h3>Demon Terminal Log</h3><ul>{terminalLogs.slice(-12).map((log, i) => <li key={`${log}-${i}`} className={`log-${classifyLog(log)}`}>{`> ${log}`}</li>)}</ul></div>
      <div className="moe-card"><h3>M.O.E. Dialogue</h3><ul>{moeLogs.slice(-4).map((log, i) => <li key={`${log}-${i}`}>{log.replace('M.O.E.: ', '')}</li>)}</ul></div>
    </footer>
  </div>;
}
