import type { ChangeEvent, RefObject } from 'react';
import type { EncounterProfile } from '../../devilConfig';
import type { EncounterId } from '../../game/types';
import type { SaveData } from '../../saveSystem';
import type { PlaytestReport, TelemetryEvent } from '../../telemetry';

type DebugSaveHeader = { id: string; label?: string; createdAt: number };

type ArchiveEntry = {
  id: string;
  name: string;
  profile?: string;
  seenCount: number;
  defeatedCount: number;
  contractedCount: number;
  analyzed: boolean;
  affinityRevealed: boolean;
  intelProgress?: number;
  affinities?: Record<string, string>;
};

type UtilityPanelsProps = {
  showUtilityPanels: boolean;
  showPlaytestReport: boolean;
  showSaveTools: boolean;
  showArchive: boolean;
  telemetryEvents: TelemetryEvent[];
  playtestReport: PlaytestReport;
  saveSnapshot: SaveData;
  latestResult: string;
  archiveEntries: ArchiveEntry[];
  contractsAcquiredTotal: number;
  routeLogEntriesCount: number;
  moeMemoryEntriesCount: number;
  autoSaveSnapshotLabel: string;
  autoSaveReason: string;
  debugSaveHeaders: DebugSaveHeader[];
  saveMessage: string;
  saveImportInputRef: RefObject<HTMLInputElement>;
  encounterProfileMap: Record<EncounterId, EncounterProfile>;
  demonArchiveFlavor: Partial<Record<EncounterId, string>>;
  onToggleUtilityPanels: () => void;
  onTogglePlaytestReport: () => void;
  onToggleSaveTools: () => void;
  onToggleArchive: () => void;
  onCopyMarkdownReport: () => void | Promise<void>;
  onDownloadTelemetryJson: () => void;
  onResetTelemetry: () => void;
  onDownloadSaveJson: () => void;
  onTriggerSaveImport: () => void;
  onResetMainSave: () => void;
  onSaveDebugNow: () => void;
  onRestoreAutoSaveNow: () => void;
  onRestoreLatestDebugNow: () => void;
  onDownloadAutoSaveJson: () => void;
  onDownloadDebugSavesJson: () => void;
  onDownloadCorruptBackupJson: () => void;
  onClearAutoSaveNow: () => void;
  onClearDebugSavesNow: () => void;
  onImportSaveFile: (event: ChangeEvent<HTMLInputElement>) => void;
  onRestoreDebugById: (id: string) => void;
};

export const UtilityPanels = ({
  showUtilityPanels,
  showPlaytestReport,
  showSaveTools,
  showArchive,
  telemetryEvents,
  playtestReport,
  saveSnapshot,
  latestResult,
  archiveEntries,
  contractsAcquiredTotal,
  routeLogEntriesCount,
  moeMemoryEntriesCount,
  autoSaveSnapshotLabel,
  autoSaveReason,
  debugSaveHeaders,
  saveMessage,
  saveImportInputRef,
  encounterProfileMap,
  demonArchiveFlavor,
  onToggleUtilityPanels,
  onTogglePlaytestReport,
  onToggleSaveTools,
  onToggleArchive,
  onCopyMarkdownReport,
  onDownloadTelemetryJson,
  onResetTelemetry,
  onDownloadSaveJson,
  onTriggerSaveImport,
  onResetMainSave,
  onSaveDebugNow,
  onRestoreAutoSaveNow,
  onRestoreLatestDebugNow,
  onDownloadAutoSaveJson,
  onDownloadDebugSavesJson,
  onDownloadCorruptBackupJson,
  onClearAutoSaveNow,
  onClearDebugSavesNow,
  onImportSaveFile,
  onRestoreDebugById,
}: UtilityPanelsProps) => (
  <>
    <div className="utility-strip">
      <button
        className="command-button command-button--ghost command-button--inline"
        onClick={onToggleUtilityPanels}
      >
        {showUtilityPanels ? '▼ HIDE DEV PANELS' : '▶ DEV PANELS'}
      </button>
      {showUtilityPanels && <div className="utility-strip__toggles">
        <button className="command-button command-button--system command-button--inline" onClick={onTogglePlaytestReport}>
          {showPlaytestReport ? 'HIDE REPORT' : 'PLAYTEST REPORT'}
        </button>
        <button className="command-button command-button--system command-button--inline" onClick={onToggleSaveTools}>
          {showSaveTools ? 'HIDE SAVE' : 'SAVE TOOLS'}
        </button>
        <button className="command-button command-button--system command-button--inline" onClick={onToggleArchive}>
          {showArchive ? 'HIDE ARCHIVE' : 'ARCHIVE'}
        </button>
      </div>}
    </div>

    {showPlaytestReport && <section className="event-card playtest-report-card">
      <div className="event-header">
        <div className="event-kicker">PLAYTEST ANALYTICS (LOCAL)</div>
        <span className="event-chip event-chip--route">{telemetryEvents.length} EVENTS</span>
      </div>
      <div className="negotiation-grid">
        <p><span>Runs started</span><strong>{playtestReport.runsStarted}</strong></p>
        <p><span>Runs finished</span><strong>{playtestReport.runsFinished}</strong></p>
        <p><span>Completion rate</span><strong>{playtestReport.completionRate.toFixed(1)}%</strong></p>
        <p><span>Garage entries</span><strong>{playtestReport.garageEntries}</strong></p>
        <p><span>Next run starts</span><strong>{playtestReport.nextRunStarts}</strong></p>
        <p><span>Second-run rate</span><strong>{playtestReport.secondRunStartRate.toFixed(1)}%</strong></p>
        <p><span>Boss challenged</span><strong>{playtestReport.bossChallenged}</strong></p>
        <p><span>Boss cleared</span><strong>{playtestReport.bossCleared}</strong></p>
        <p><span>Return gate used</span><strong>{playtestReport.returnGateUsed}</strong></p>
        <p><span>Game over</span><strong>{playtestReport.gameOverCount}</strong></p>
        <p><span>Analyze used</span><strong>{playtestReport.analyzeUsed}</strong></p>
        <p><span>Talk used</span><strong>{playtestReport.talkUsed}</strong></p>
        <p><span>Contract attempts</span><strong>{playtestReport.contractAttempts}</strong></p>
        <p><span>Contract success</span><strong>{playtestReport.contractSuccesses}</strong></p>
        <p><span>Contract success rate</span><strong>{playtestReport.contractSuccessRate.toFixed(1)}%</strong></p>
        <p><span>Direct attack ratio</span><strong>{playtestReport.directAttackRatio.toFixed(1)}%</strong></p>
        <p><span>Saved runs</span><strong>{playtestReport.persistedRuns}</strong></p>
        <p><span>Demon archive</span><strong>{playtestReport.archiveDiscoveryCount}</strong></p>
        <p><span>Route log</span><strong>{playtestReport.routeLogCount}</strong></p>
        <p><span>M.O.E. memories</span><strong>{playtestReport.memoryUnlockCount}</strong></p>
      </div>
      <div className="next-node-list">
        <div className="next-node">
          <span>◎</span>
          <strong>Most Used Commands</strong>
          <small>{playtestReport.mostUsedCommands.map((command) => `${command.id} (${command.count})`).join(' / ') || 'no data yet'}</small>
        </div>
        <div className="next-node">
          <span>{playtestReport.directAttackRatio > 70 ? '▲' : '◎'}</span>
          <strong>Combat Behavior</strong>
          <small>{playtestReport.directAttackRatio > 70 ? 'Direct attacks dominate (>70%). Analyze/Talk incentives may be too weak.' : 'Command mix looks reasonably varied.'}</small>
        </div>
        <div className="next-node">
          <span>◎</span>
          <strong>MVP Judgment</strong>
          <small>{playtestReport.judgment}</small>
        </div>
        <div className="next-node">
          <span>◎</span>
          <strong>Persistent Progression</strong>
          <small>{playtestReport.previousRunSummaryText}</small>
          <small>M.O.E.: {playtestReport.latestMoeSuggestion}</small>
        </div>
      </div>
      <div className="next-node-list">
        {playtestReport.notes.map((note, index) => <div key={`note-${index}`} className="next-node">
          <span>•</span>
          <small>{note}</small>
        </div>)}
      </div>
      <div className="command-window command-list">
        <button className="command-button command-button--system" onClick={() => void onCopyMarkdownReport()}>Copy Markdown Report</button>
        <button className="command-button command-button--route" onClick={onDownloadTelemetryJson}>Download Telemetry JSON</button>
        <button className="command-button command-button--danger" onClick={onResetTelemetry}>Clear Telemetry</button>
      </div>
    </section>}

    {showSaveTools && <section className="event-card playtest-report-card">
      <div className="event-header">
        <div className="event-kicker">LOCAL SAVE TOOLS</div>
        <span className="event-chip event-chip--route">MAIN SAVE / AUTOSAVE / DEBUG</span>
      </div>
      <div className="negotiation-grid">
        <p><span>Total runs</span><strong>{saveSnapshot.totalRuns}</strong></p>
        <p><span>Latest result</span><strong>{latestResult}</strong></p>
        <p><span>Best result</span><strong>{saveSnapshot.bestResult ?? '-'}</strong></p>
        <p><span>Demons discovered</span><strong>{archiveEntries.length}</strong></p>
        <p><span>Contracts acquired total</span><strong>{contractsAcquiredTotal}</strong></p>
        <p><span>Routes discovered</span><strong>{routeLogEntriesCount}</strong></p>
        <p><span>M.O.E. memories unlocked</span><strong>{moeMemoryEntriesCount}</strong></p>
        <p><span>Main Save Updated</span><strong>{new Date(saveSnapshot.updatedAt).toLocaleString()}</strong></p>
        <p><span>AutoSave</span><strong>{autoSaveSnapshotLabel}</strong></p>
        <p><span>AutoSave Reason</span><strong>{autoSaveReason}</strong></p>
        <p><span>Debug Slots</span><strong>{debugSaveHeaders.length}</strong></p>
      </div>
      <div className="command-window command-list">
        <button className="command-button command-button--route" onClick={onDownloadSaveJson}>Export Save JSON</button>
        <button className="command-button command-button--route" onClick={onTriggerSaveImport}>Import Save JSON</button>
        <button className="command-button command-button--danger" onClick={onResetMainSave}>Reset Save</button>
        <button className="command-button command-button--system" onClick={onSaveDebugNow}>Save Debug Snapshot</button>
        <button className="command-button command-button--route" onClick={onRestoreAutoSaveNow}>Restore AutoSave</button>
        <button className="command-button command-button--route" onClick={onRestoreLatestDebugNow}>Restore Latest Debug</button>
        <button className="command-button command-button--route" onClick={onDownloadAutoSaveJson}>Download AutoSave JSON</button>
        <button className="command-button command-button--route" onClick={onDownloadDebugSavesJson}>Download Debug Saves JSON</button>
        <button className="command-button command-button--route" onClick={onDownloadCorruptBackupJson}>Download Corrupt Backup</button>
        <button className="command-button command-button--danger" onClick={onClearAutoSaveNow}>Clear AutoSave</button>
        <button className="command-button command-button--danger" onClick={onClearDebugSavesNow}>Clear Debug Saves</button>
      </div>
      <input
        ref={saveImportInputRef}
        type="file"
        accept="application/json,.json"
        style={{ display: 'none' }}
        onChange={onImportSaveFile}
      />
      {saveMessage && <p className="event-layer__system">{saveMessage}</p>}
      {debugSaveHeaders.length > 0 && <div className="next-node-list">
        {debugSaveHeaders.slice(0, 5).map((entry) => <div key={entry.id} className="next-node">
          <span>◎</span>
          <strong>{entry.label ?? entry.id}</strong>
          <small>{new Date(entry.createdAt).toLocaleString()}</small>
          <button className="command-button command-button--system command-button--inline" onClick={() => onRestoreDebugById(entry.id)}>Restore</button>
        </div>)}
      </div>}
    </section>}

    {showArchive && <section className="event-card playtest-report-card">
      <div className="event-header">
        <div className="event-kicker">DEMON ARCHIVE</div>
        <span className="event-chip event-chip--route">{archiveEntries.length} ENTRIES</span>
      </div>
      {archiveEntries.length === 0
        ? <p>No demon profile recorded yet. Enter an encounter to initialize archive data.</p>
        : <div className="next-node-list">
          {archiveEntries.map((entry) => {
            const profileId = entry.profile as EncounterId | undefined;
            const profile = profileId ? encounterProfileMap[profileId] : undefined;
            return <div key={entry.id} className="next-node">
              <span>{entry.analyzed ? '◎' : '□'}</span>
              <strong>{entry.name.toUpperCase()}</strong>
              <small>
                seen:{entry.seenCount} / defeated:{entry.defeatedCount} / contracted:{entry.contractedCount}
              </small>
              <small>
                analyze:{entry.analyzed ? 'yes' : 'no'} / affinity:{entry.affinityRevealed ? 'revealed' : 'locked'} / intel:{Math.floor(entry.intelProgress ?? 0)}
              </small>
              {!entry.analyzed
                ? <small>Profile locked. Use Analyze to reveal more.</small>
                : <small>{(profile?.subtitle || (profileId ? demonArchiveFlavor[profileId] : undefined)) ?? 'No additional profile note.'}</small>}
              {entry.affinityRevealed && entry.affinities && (
                <small>
                  AFF: {Object.entries(entry.affinities).map(([k, v]) => `${k}:${v}`).join(' / ')}
                </small>
              )}
            </div>;
          })}
        </div>}
    </section>}
  </>
);
