import { useMemo, useReducer } from 'react';

type NodeType = 'start' | 'road' | 'entity' | 'wreck' | 'combat' | 'signal' | 'return_gate' | 'unknown';
type ContractId = 'radio_voice' | 'silent_shape' | 'abandoned_ai_navi';

type Contract = { id: ContractId; name: string; effect: string };
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
};

type Action =
  | { type: 'MOVE'; nodeId: string }
  | { type: 'RESOLVE_NODE' }
  | { type: 'NEGOTIATE'; accept: boolean }
  | { type: 'RETRY' };

const contracts: Contract[] = [
  { id: 'radio_voice', name: 'Radio Voice', effect: 'Signal +2, 交渉成功率 +10%' },
  { id: 'silent_shape', name: 'Silent Shape', effect: 'Combat被ダメージ -4, Signal -1' },
  { id: 'abandoned_ai_navi', name: 'Abandoned AI Navi', effect: 'road消費Fuel -1（最低0）' },
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

function reducer(state: State, action: Action): State {
  if (action.type === 'RETRY') return initialState();

  if (state.outcome) return state;

  switch (action.type) {
    case 'MOVE': {
      const current = state.nodes.find((n) => n.id === state.currentId)!;
      if (!current.next.includes(action.nodeId)) return state;
      return { ...state, currentId: action.nodeId, phase: 'node', logs: [...state.logs, `Move: ${action.nodeId}へ進行。`] };
    }
    case 'RESOLVE_NODE': {
      const node = state.nodes.find((n) => n.id === state.currentId)!;
      let fuel = state.fuel;
      let armor = state.armor;
      let signal = state.signal;
      const logs = [...state.logs];
      let phase: State['phase'] = 'map';
      let pendingContract = state.pendingContract;
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
        logs.push('M.O.E.: 交渉開始。成功率と失敗時ペナルティを確認してください。');
      } else if (node.type === 'return_gate') {
        return { ...state, phase: 'result', outcome: 'win', logs: [...logs, 'Return Gate到達。帰還成功。'] };
      }

      if (fuel <= 0 || armor <= 0) {
        return { ...state, fuel, armor, signal, phase: 'result', outcome: 'lose', logs: [...logs, '車両機能停止。Run Lost。'] };
      }

      if (signal <= 1) logs.push('M.O.E.: Signal低下。交渉難度が上昇。');

      return { ...state, fuel, armor, signal, phase, pendingContract, logs };
    }
    case 'NEGOTIATE': {
      if (state.phase !== 'negotiation' || !state.pendingContract) return state;
      const baseRate = 65;
      const signalBonus = Math.max(-15, Math.min(20, (state.signal - 5) * 5));
      const radioBonus = hasContract(state, 'radio_voice') ? 10 : 0;
      const failPenalty = state.failedNegotiations * -10;
      const chance = baseRate + signalBonus + radioBonus + failPenalty;
      const roll = 42;
      const success = action.accept && roll <= chance;
      if (success) {
        return {
          ...state,
          phase: 'map',
          contracts: [...state.contracts, state.pendingContract],
          signal: state.pendingContract.id === 'radio_voice' ? state.signal + 2 : state.signal,
          logs: [...state.logs, `交渉成功: ${state.pendingContract.name} を契約。`],
          pendingContract: undefined,
        };
      }
      return {
        ...state,
        phase: 'map',
        armor: state.armor - 3,
        failedNegotiations: state.failedNegotiations + 1,
        logs: [...state.logs, '交渉失敗。Armor-3。'],
        pendingContract: undefined,
        ...(state.armor - 3 <= 0 ? { phase: 'result' as const, outcome: 'lose' as const } : {}),
      };
    }
  }
}

export function App() {
  const [state, dispatch] = useReducer(reducer, undefined, initialState);
  const current = state.nodes.find((n) => n.id === state.currentId)!;
  const nextNodes = useMemo(() => current.next.map((id) => state.nodes.find((n) => n.id === id)!), [current.next, state.nodes]);
  const chance = Math.max(5, Math.min(95, 65 + (state.signal - 5) * 5 + (hasContract(state, 'radio_voice') ? 10 : 0) - state.failedNegotiations * 10));

  return <div className="ui">
    <header><h1>DEMON TERMINAL DRIVE / MVP</h1><div>NODE: {current.name}</div></header>
    <aside><h3>Vehicle</h3><p>Fuel: {state.fuel}</p><p>Armor: {state.armor}</p><p>Signal: {state.signal}</p>
      <h3>Contracts</h3>{state.contracts.length === 0 ? <p>None</p> : state.contracts.map((c) => <p key={c.id}>{c.name}</p>)}</aside>
    <main>
      {state.phase === 'map' && !state.outcome && <div><h2>Route Map</h2>{nextNodes.map((n) => <button key={n.id} onClick={() => dispatch({ type: 'MOVE', nodeId: n.id })}>{n.type.toUpperCase()} / {n.name}</button>)}</div>}
      {state.phase === 'node' && <div><h2>{current.type.toUpperCase()}</h2><p>{current.detail}</p><button onClick={() => dispatch({ type: 'RESOLVE_NODE' })}>Resolve</button></div>}
      {state.phase === 'negotiation' && state.pendingContract && <div><h2>Negotiation</h2><p>Target: {state.pendingContract.name}</p><p>Success: {chance}%</p><p>Fail Penalty: Armor -3</p><p>Reward: {state.pendingContract.effect}</p><button onClick={() => dispatch({ type: 'NEGOTIATE', accept: true })}>Accept Deal</button><button onClick={() => dispatch({ type: 'NEGOTIATE', accept: false })}>Reject</button></div>}
      {state.phase === 'result' && <div><h2>{state.outcome === 'win' ? 'RUN COMPLETE' : 'RUN LOST'}</h2><button onClick={() => dispatch({ type: 'RETRY' })}>Retry</button></div>}
    </main>
    <section><h3>M.O.E. Log</h3><ul>{state.logs.slice(-8).map((log, i) => <li key={`${log}-${i}`}>{log}</li>)}</ul></section>
  </div>;
}
