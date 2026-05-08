import { getDialogueLine } from '../../../dialogueConfig';
import { getMoeLine } from '../../../game/moeDialogue';
import { resultLabel } from '../../../game/runInsights';
import { storyLogCatalog } from '../../../game/catalogs';
import type { MoeMemoryEntry, RouteLogEntry, RunRecord, SaveData } from '../../../saveSystem';
import type { StoryState } from '../../../game/types';

type GaragePreviousRunSectionProps = {
  saveSnapshot: SaveData;
  latestRunRecord?: RunRecord;
  latest3Runs: RunRecord[];
  showRunHistory: boolean;
  onSetShowRunHistory: (next: boolean) => void;
  routeLogEntries: RouteLogEntry[];
  moeMemoryEntries: MoeMemoryEntry[];
  story: StoryState;
};

export const GaragePreviousRunSection = ({
  saveSnapshot,
  latestRunRecord,
  latest3Runs,
  showRunHistory,
  onSetShowRunHistory,
  routeLogEntries,
  moeMemoryEntries,
  story,
}: GaragePreviousRunSectionProps) => (
  <div className="garage-block">
    <details className="garage-fold">
      <summary>PREVIOUS RUN</summary>
      <div className="garage-fold__body">
        <div className="negotiation-grid">
          <p><span>Total Runs</span><strong>{saveSnapshot.totalRuns}</strong></p>
          <p><span>Best Result</span><strong>{saveSnapshot.bestResult ?? '-'}</strong></p>
          <p><span>Demon Archive</span><strong>{Object.keys(saveSnapshot.demonArchive).length}</strong></p>
          <p><span>Route Log</span><strong>{Object.keys(saveSnapshot.routeLog).length}</strong></p>
          <p><span>M.O.E. Memory</span><strong>{Object.keys(saveSnapshot.moeMemory).length}</strong></p>
          <p><span>Run History</span><strong>{saveSnapshot.runHistory.length}</strong></p>
        </div>
        {latestRunRecord
          ? <div className="negotiation-grid">
            <p><span>Result</span><strong>{resultLabel(latestRunRecord.resultType)}</strong></p>
            <p><span>Ended</span><strong>{new Date(latestRunRecord.endedAt).toLocaleString()}</strong></p>
            <p><span>Encounters</span><strong>{latestRunRecord.encountersCleared}</strong></p>
            <p><span>Boss</span><strong>{latestRunRecord.bossChallenged ? (latestRunRecord.bossCleared ? 'Cleared' : 'Challenged') : 'Not challenged'}</strong></p>
            <p><span>Contracts</span><strong>{latestRunRecord.contractsAcquired.length}</strong></p>
            <p><span>Return Gate</span><strong>{latestRunRecord.returnGateUsed ? 'Used' : 'No'}</strong></p>
            <p><span>Final</span><strong>{latestRunRecord.finalResources.fuel}/{latestRunRecord.finalResources.armor}/{latestRunRecord.finalResources.signal}/{latestRunRecord.finalResources.mainAmmo}/{latestRunRecord.finalResources.seAmmo}</strong></p>
          </div>
          : <p>{getDialogueLine('ui.common.no_previous_run', 'No previous run data')}</p>}
        {latestRunRecord && <div className="command-window">
          <strong>M.O.E. Suggestion</strong>
          <p>M.O.E.: 「{latestRunRecord.moeComment ?? '-'}」</p>
        </div>}
        <div className="command-window command-list">
          <button className="command-button command-button--system command-button--inline" onClick={() => onSetShowRunHistory(!showRunHistory)}>
            {showRunHistory ? 'HIDE RUN HISTORY' : 'SHOW RUN HISTORY'}
          </button>
        </div>
        {showRunHistory && <div className="next-node-list">
          {latest3Runs.map((run) => <div key={run.id} className="next-node">
            <span>◎</span>
            <strong>{new Date(run.endedAt).toLocaleString()} / {resultLabel(run.resultType)}</strong>
            <small>contracts: {run.contractsAcquired.length} / boss: {run.bossChallenged ? (run.bossCleared ? 'cleared' : 'challenged') : 'no'} / encounters: {run.encountersCleared}</small>
          </div>)}
        </div>}
      </div>
    </details>
    <details className="garage-fold">
      <summary>ARCHIVE / ROUTE LOG / M.O.E. MEMORY</summary>
      <div className="garage-fold__body">
        <h3>Archive</h3>
        <div className="negotiation-grid">
          <p><span>Chapter</span><strong>{story.chapter}</strong></p>
          <p><span>M.O.E. Memory</span><strong>{story.moeMemory}</strong></p>
          <p><span>Driver Clues</span><strong>{story.previousDriverClues}</strong></p>
          <p><span>Recovered</span><strong>{story.recoveredLogs.length}/{storyLogCatalog.length}</strong></p>
        </div>
        <h3>ROUTE LOG</h3>
        <div className="negotiation-grid">
          <p><span>Routes discovered</span><strong>{routeLogEntries.length}</strong></p>
        </div>
        {routeLogEntries.length > 0
          ? <div className="next-node-list">
            {routeLogEntries.slice(0, 8).map((entry) => <div key={entry.id} className="next-node">
              <span>◎</span>
              <strong>{entry.name}</strong>
              <small>chosen {entry.seenCount}x / {new Date(entry.lastChosenAt).toLocaleString()}</small>
              <small>{entry.notes?.[0] ?? 'Route trace recorded.'}</small>
            </div>)}
          </div>
          : <p>No route records yet.</p>}
        <h3>M.O.E. MEMORY</h3>
        <div className="negotiation-grid">
          <p><span>Unlocked memories</span><strong>{moeMemoryEntries.length}</strong></p>
        </div>
        {moeMemoryEntries.length > 0
          ? <div className="next-node-list">
            {moeMemoryEntries.slice(0, 10).map((entry) => <div key={entry.id} className="next-node">
              <span>◎</span>
              <strong>{entry.title}</strong>
              <small>{entry.text}</small>
              <small>{new Date(entry.unlockedAt).toLocaleString()} / {entry.source.toUpperCase()}</small>
            </div>)}
          </div>
          : <p>No memory fragments unlocked yet.</p>}
        <h3>Story Logs</h3>
        <div className="next-node-list">
          {storyLogCatalog.map((entry) => {
            const unlocked = story.recoveredLogs.includes(entry.id);
            return <div key={entry.id} className="next-node">
              <span>{unlocked ? '◎' : '□'}</span>
              <strong>{entry.id}: {entry.title}</strong>
              <small>{unlocked ? entry.text : 'LOCKED'}</small>
            </div>;
          })}
        </div>
        <p>M.O.E.: 「{getMoeLine('moe.garage.memory', '断片が増えるほど、わたしの地図も変わる。', undefined, 'soft')}」</p>
      </div>
    </details>
  </div>
);
