import type { RefObject } from 'react';
import { AssetFigure } from '../../components/EncounterVisuals';
import type { GamePhase } from '../../game/types';
import type { TerminalLogKind } from '../../game/types';

type TerminalPanelProps = {
  moeAsset?: string;
  gamePhase: GamePhase;
  signal: number;
  liveMoeLine: string;
  runStatus: string;
  terminalStatus: string[];
  tacticalLines: string[];
  logLines: string[];
  encounterIndex: number;
  encounterTurn: number;
  isEncounterActive: boolean;
  terminalLogRef: RefObject<HTMLUListElement>;
  classifyLog: (log: string) => TerminalLogKind;
  getLogBadge: (kind: TerminalLogKind) => string;
  getPseudoTimecode: (idx: number, total: number, encounterIndex: number, turn: number) => string;
};

export const TerminalPanel = ({
  moeAsset,
  gamePhase,
  signal,
  liveMoeLine,
  runStatus,
  terminalStatus,
  tacticalLines,
  logLines,
  encounterIndex,
  encounterTurn,
  isEncounterActive,
  terminalLogRef,
  classifyLog,
  getLogBadge,
  getPseudoTimecode,
}: TerminalPanelProps) => (
  <section className="terminal-stack panel">
    <section className="radio-panel radio-panel--terminal">
      <div className="terminal-tabs terminal-tabs--moe">
        <span className="terminal-tab is-active">M.O.E.</span>
        <span className="terminal-tab">NAVI</span>
        <span className="terminal-tab">MSG</span>
        <small>{gamePhase.toUpperCase()} / {signal <= 2 ? 'NOISY' : 'CLEAR'}</small>
      </div>
      <div className="moe-terminal">
        <div className="moe-terminal__portrait">
          <AssetFigure
            src={moeAsset}
            alt="M.O.E."
            className="radio-panel__avatar radio-panel__avatar--moe"
            fallback={<></>}
            transparencyMode="auto-corner"
          />
        </div>
        <div className="moe-terminal__console">
          <div className="moe-terminal__prompt">
            <span>M.O.E. // NAVI AI</span>
            <small>LIVE CHANNEL</small>
          </div>
          <p className="moe-live"><span>&gt;</span>{liveMoeLine}</p>
        </div>
      </div>
    </section>
    <section className={`terminal terminal-log ${isEncounterActive ? 'terminal--anomaly' : ''}`}>
      <div className="terminal-tabs terminal-tabs--log">
        <span className="terminal-tab is-active">LOG</span>
        <span className="terminal-tab">SYS</span>
        <span className="terminal-tab">NAVI</span>
        <small>{runStatus}</small>
      </div>
      <div className="terminal-status__chips">
        {terminalStatus.map((status) => (
          <span key={status} className="terminal-status__chip">{status}</span>
        ))}
        {tacticalLines.map((line) => (
          <span key={line} className="terminal-status__chip terminal-status__chip--tactical">{line}</span>
        ))}
      </div>
      <ul ref={terminalLogRef} className="terminal-log__list">
        {logLines.map((log, i, logs) => {
          const kind = classifyLog(log);
          return (
            <li key={`${log}-${i}`} className={`terminal-log__line log-${kind} ${i === logs.length - 1 ? 'is-latest' : ''}`}>
              <span className="terminal-log__time">{getPseudoTimecode(i, logs.length, encounterIndex, encounterTurn)}</span>
              <span className="terminal-log__badge">{getLogBadge(kind)}</span>
              <span className="terminal-log__caret">&gt;</span>
              <span className="terminal-log__text">{log}</span>
            </li>
          );
        })}
      </ul>
    </section>
  </section>
);
