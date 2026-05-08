import { useEffect, useRef, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';
import {
  touchDemonArchive,
  touchRouteLog,
  unlockMoeMemory,
  updateSaveData,
  type RunRecord,
} from '../../saveSystem';
import { trackEvent, type TelemetryEventName } from '../../telemetry';
import { storyLogById, routeLogCatalog } from '../../game/catalogs';
import { devilTemplates } from '../../game/runtimeHelpers';
import type { GamePhase, State } from '../../game/types';

type UseTelemetryEffectsParams = {
  state: State;
  setTelemetryRefresh: Dispatch<SetStateAction<number>>;
  runIndexRef: MutableRefObject<number>;
  phaseRef: MutableRefObject<GamePhase>;
  bossChallengedRef: MutableRefObject<boolean>;
  processedLogCountRef: MutableRefObject<number>;
  loadoutHashRef: MutableRefObject<string>;
  activeRunRef: MutableRefObject<RunRecord | null>;
  beginRunRecord: () => void;
  finalizeRunRecord: (resultType: string, gameOverReason?: string) => void;
  refreshSaveSnapshot: () => void;
  refreshDebugHeaders: () => void;
  autoSaveNow: (reason: string) => void;
};

export const useTelemetryEffects = ({
  state,
  setTelemetryRefresh,
  runIndexRef,
  phaseRef,
  bossChallengedRef,
  processedLogCountRef,
  loadoutHashRef,
  activeRunRef,
  beginRunRecord,
  finalizeRunRecord,
  refreshSaveSnapshot,
  refreshDebugHeaders,
  autoSaveNow,
}: UseTelemetryEffectsParams) => {
  const routeNodeSignatureRef = useRef<string | undefined>(undefined);

  const buildTelemetryContext = (): Record<string, unknown> => ({
    gamePhase: state.gamePhase,
    runIndex: runIndexRef.current,
    stage: state.stage,
    encounterIndex: state.encounterIndex,
    turn: state.encounter.turn,
    resources: {
      fuel: state.fuel,
      armor: state.armor,
      signal: state.signal,
      mainAmmo: state.mainAmmo,
      seAmmo: state.seAmmo,
    },
    contracts: state.contracts.map((contract) => contract.id),
    loadout: {
      mainGunId: state.selectedLoadout.mainGunId,
      subGunId: state.selectedLoadout.subGunId,
      specialEquipmentId: state.selectedLoadout.specialEquipmentId,
      contractSupportId: state.selectedLoadout.contractSupportId,
    },
    routeState: state.routeState
      ? {
        stageRouteId: state.routeState.stageRouteId,
        currentNodeId: state.routeState.currentNodeId,
        currentEventId: state.routeState.currentEventId,
      }
      : undefined,
  });

  const emitTelemetry = (name: TelemetryEventName, payload: Record<string, unknown> = {}) => {
    trackEvent(name, { ...buildTelemetryContext(), ...payload });
    setTelemetryRefresh((value) => value + 1);
  };

  useEffect(() => {
    emitTelemetry('app_loaded');
    emitTelemetry('prologue_started');
    updateSaveData((current) => current);
    refreshSaveSnapshot();
    refreshDebugHeaders();
    phaseRef.current = state.gamePhase;
    bossChallengedRef.current = state.bossChallenged;
    processedLogCountRef.current = state.logs.length;
    autoSaveNow('app_loaded');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const prevPhase = phaseRef.current;
    if (prevPhase !== state.gamePhase) {
      if (state.gamePhase === 'prologue') emitTelemetry('prologue_started');
      if (state.gamePhase === 'approach') emitTelemetry('approach_started');
      if (state.gamePhase === 'encounter' || state.gamePhase === 'boss_encounter') {
        emitTelemetry('encounter_started', {
          encounterKind: state.encounter.kind,
          enemies: state.encounter.enemies.map((enemy) => ({ id: enemy.id, profile: enemy.profile })),
        });
        for (const enemy of state.encounter.enemies) {
          touchDemonArchive(enemy.profile, {
            name: enemy.name,
            profile: enemy.profile,
            intelProgress: enemy.intelProgress,
          });
        }
        refreshSaveSnapshot();
      }
      if (state.gamePhase === 'reward') emitTelemetry('reward_shown');
      if (state.gamePhase === 'route_choice') emitTelemetry('route_choice_shown');
      if (state.gamePhase === 'boss_preview') {
        emitTelemetry('boss_preview_seen');
        unlockMoeMemory({
          id: 'memory_toll_gate',
          title: 'Toll Gate Signal',
          text: 'The toll is not fuel, not a name. It is the will to return.',
          source: 'boss',
        });
        refreshSaveSnapshot();
      }
      if (state.gamePhase === 'garage') emitTelemetry('garage_entered');
      if (state.gamePhase === 'game_over') emitTelemetry('game_over');
      if (state.gamePhase === 'result') {
        emitTelemetry('result_shown', { resultType: state.resultType ?? 'unknown' });
        if (prevPhase === 'return_gate' || state.resultType === 'Early Return' || state.resultType === 'Boss Avoided') {
          emitTelemetry('return_gate_used', { resultType: state.resultType ?? 'unknown' });
        }
        if (state.resultType === 'Early Return' || state.resultType === 'Boss Avoided') {
          emitTelemetry('route_choice_selected', { route: 'return_gate' });
        }
        if (state.resultType === 'Boss Cleared') emitTelemetry('boss_cleared');
        finalizeRunRecord(state.resultType ?? 'Unknown');
      }
      if (state.gamePhase === 'game_over') {
        finalizeRunRecord('Vehicle Disabled', 'fuel_or_armor_zero');
      }
      phaseRef.current = state.gamePhase;
    }
  }, [state.gamePhase, state.encounter, state.resultType, finalizeRunRecord]);

  useEffect(() => {
    const routeState = state.routeState;
    if (!routeState?.currentNodeId) {
      routeNodeSignatureRef.current = undefined;
      return;
    }
    const signature = `${routeState.stageRouteId}:${routeState.currentNodeId}:${routeState.currentEventId ?? ''}`;
    if (routeNodeSignatureRef.current === undefined) {
      routeNodeSignatureRef.current = signature;
      return;
    }
    if (routeNodeSignatureRef.current === signature) return;
    routeNodeSignatureRef.current = signature;
    emitTelemetry('route_node_selected', {
      stageRouteId: routeState.stageRouteId,
      nodeId: routeState.currentNodeId,
      eventId: routeState.currentEventId,
    });
  }, [state.routeState?.stageRouteId, state.routeState?.currentNodeId, state.routeState?.currentEventId]);

  useEffect(() => {
    if (!bossChallengedRef.current && state.bossChallenged) emitTelemetry('boss_challenged');
    if (!bossChallengedRef.current && state.bossChallenged && activeRunRef.current) {
      activeRunRef.current.bossChallenged = true;
    }
    bossChallengedRef.current = state.bossChallenged;
  }, [state.bossChallenged]);

  useEffect(() => {
    if (state.gamePhase !== 'garage') return;
    const nextHash = JSON.stringify(state.selectedLoadout);
    if (loadoutHashRef.current !== nextHash) {
      emitTelemetry('loadout_changed', { loadout: state.selectedLoadout });
      loadoutHashRef.current = nextHash;
    }
  }, [state.gamePhase, state.selectedLoadout]);

  useEffect(() => {
    if (state.story.recentRecoveredLogs.length === 0) return;
    for (const id of state.story.recentRecoveredLogs) {
      const log = storyLogById[id];
      if (!log) continue;
      unlockMoeMemory({
        id: `story-${id}`,
        title: log.title,
        text: log.text,
        source: 'story',
      });
      if (id === 'LOG_00') {
        unlockMoeMemory({
          id: 'memory_previous_driver',
          title: 'Previous Driver',
          text: 'M.O.E., if you hear this, do not trust the toll gate.',
          source: 'story',
        });
      }
      if (id === 'LOG_02') {
        unlockMoeMemory({
          id: 'memory_am_666',
          title: 'AM 666.0',
          text: 'AM 666.0 does not broadcast the future. It broadcasts the roads we did not choose.',
          source: 'story',
        });
      }
    }
    refreshSaveSnapshot();
  }, [state.story.recentRecoveredLogs, refreshSaveSnapshot]);

  useEffect(() => {
    const startIndex = processedLogCountRef.current;
    if (startIndex >= state.logs.length) return;
    const fresh = state.logs.slice(startIndex);
    for (const line of fresh) {
      const clean = line.replace(/^>\s*/, '').trim();
      if (clean.startsWith('RUN START')) {
        runIndexRef.current += 1;
        emitTelemetry('run_started', { runIndex: runIndexRef.current });
        if (runIndexRef.current >= 2) emitTelemetry('next_run_started', { runIndex: runIndexRef.current });
        beginRunRecord();
      }
      if (clean.startsWith('COMMAND:')) {
        const token = clean.split(':')[1]?.split('/')[0]?.trim().toLowerCase() ?? 'unknown';
        const commandId = token;
        const selected = state.encounter.enemies.find((enemy) => enemy.id === state.encounter.selectedEnemyId);
        emitTelemetry('command_used', {
          commandId,
          enemyId: selected?.id,
          enemyProfile: selected?.profile,
        });
        if (commandId === 'analyze') emitTelemetry('analyze_used');
        if (commandId === 'talk') emitTelemetry('talk_used');
        if (commandId === 'contract') emitTelemetry('contract_attempted');
      }
      if (clean.includes('SIGNATURE SCAN COMPLETE')) {
        emitTelemetry('analyze_success');
        const selected = state.encounter.enemies.find((enemy) => enemy.id === state.encounter.selectedEnemyId);
        if (selected && activeRunRef.current) {
          if (selected.intelProgress >= selected.intelThreshold) {
            activeRunRef.current.analyzedEnemies = Array.from(new Set([...activeRunRef.current.analyzedEnemies, selected.profile]));
          }
          touchDemonArchive(selected.profile, {
            name: selected.name,
            profile: selected.profile,
            analyzed: selected.intelProgress >= selected.intelThreshold,
            affinityRevealed: !!selected.affinityRevealed,
            intelProgress: selected.intelProgress,
            affinities: Object.fromEntries(
              Object.entries(selected.affinities).map(([key, value]) => [key, String(value)]),
            ),
          });
          refreshSaveSnapshot();
        }
      }
      if (clean.includes('CONTRACT WINDOW OPEN') || clean.includes('CONTRACT WINDOW: PARTIAL OPEN')) emitTelemetry('contract_window_opened');
      if (clean.includes('CONTRACT REGISTERED')) {
        emitTelemetry('contract_success');
        if (activeRunRef.current) {
          activeRunRef.current.contractsAcquired = Array.from(new Set([
            ...activeRunRef.current.contractsAcquired,
            ...state.contracts.map((contract) => contract.id),
          ]));
        }
        const contractTargetName = clean.split('CONTRACT REGISTERED:')[1]?.trim();
        if (contractTargetName) {
          const match = Object.entries(devilTemplates()).find(([, template]) => template.name.toUpperCase() === contractTargetName.toUpperCase());
          if (match) {
            const [profile, template] = match;
            touchDemonArchive(profile, {
              name: template.name,
              profile,
              analyzed: true,
            });
            if (profile === 'abandoned_ai_navi') {
              unlockMoeMemory({
                id: 'memory_moe_identity',
                title: 'M.O.E. Identity',
                text: 'I am registered as a navigation AI. Then who recorded this voice?',
                source: 'contract',
              });
            }
            refreshSaveSnapshot();
          }
        }
      }
      if (clean.includes('SUPPORT DAEMON LINKED:')) {
        const daemonName = clean.split('SUPPORT DAEMON LINKED:')[1]?.split('//')[0]?.trim();
        if (daemonName) {
          const match = Object.entries(devilTemplates()).find(([, template]) => template.name.toUpperCase() === daemonName.toUpperCase());
          if (match) {
            const [profile, template] = match;
            touchDemonArchive(profile, {
              name: template.name,
              profile,
              contractedDelta: 1,
              analyzed: true,
            });
            refreshSaveSnapshot();
          }
        }
      }
      if (clean.includes('TARGET DOWN:')) {
        const enemyName = clean.split('TARGET DOWN:')[1]?.split('/')[0]?.trim();
        emitTelemetry('enemy_defeated', { enemyName });
        const match = Object.entries(devilTemplates()).find(([, template]) => template.name.toUpperCase() === (enemyName ?? '').toUpperCase());
        if (match && activeRunRef.current) {
          const [profile, template] = match;
          activeRunRef.current.defeatedEnemies = Array.from(new Set([...activeRunRef.current.defeatedEnemies, profile]));
          touchDemonArchive(profile, {
            name: template.name,
            profile,
            defeatedDelta: 1,
            intelProgress: Math.max(100, state.encounter.enemies.find((enemy) => enemy.profile === profile)?.intelProgress ?? 0),
          });
          refreshSaveSnapshot();
        }
      }
      if (clean.includes('SALVAGE APPLIED:')) {
        const rewardName = clean.split('SALVAGE APPLIED:')[1]?.trim();
        emitTelemetry('reward_selected', { rewardName });
      }
      if (clean === 'SALVAGE LANE SELECTED') {
        emitTelemetry('route_choice_selected', { route: 'salvage' });
        if (activeRunRef.current) activeRunRef.current.routeChoices.push('salvage');
        touchRouteLog('salvage', routeLogCatalog.salvage.name, routeLogCatalog.salvage.note);
        refreshSaveSnapshot();
      }
      if (clean === 'SIGNAL LANE SELECTED') {
        emitTelemetry('route_choice_selected', { route: 'signal' });
        if (activeRunRef.current) activeRunRef.current.routeChoices.push('signal');
        touchRouteLog('signal', routeLogCatalog.signal.name, routeLogCatalog.signal.note);
        refreshSaveSnapshot();
      }
      if (clean.startsWith('SIGNAL TUNNEL CHOICE:')) {
        const rawChoice = clean.split('SIGNAL TUNNEL CHOICE:')[1]?.trim().toLowerCase();
        if (rawChoice) emitTelemetry('route_choice_selected', { route: `signal:${rawChoice}` });
      }
      if (clean === 'PUSH FORWARD SELECTED') {
        emitTelemetry('route_choice_selected', { route: 'push_forward' });
        if (activeRunRef.current) activeRunRef.current.routeChoices.push('push_forward');
        touchRouteLog('push_forward', routeLogCatalog.push_forward.name, routeLogCatalog.push_forward.note);
        refreshSaveSnapshot();
      }
      if (clean.includes('RETURN GATE ROUTE OPEN')) {
        emitTelemetry('route_choice_selected', { route: 'return_gate' });
        if (activeRunRef.current) activeRunRef.current.routeChoices.push('return_gate');
        touchRouteLog('return_gate', routeLogCatalog.return_gate.name, routeLogCatalog.return_gate.note);
        refreshSaveSnapshot();
      }
      if (clean.includes('BOSS ENCOUNTER: TOLL GATE SAINT')) {
        if (activeRunRef.current) activeRunRef.current.routeChoices.push('boss');
        touchRouteLog('boss', routeLogCatalog.boss.name, routeLogCatalog.boss.note);
        refreshSaveSnapshot();
      }
      if (clean.includes('AM 666.0')) {
        unlockMoeMemory({
          id: 'memory_am_666',
          title: 'AM 666.0',
          text: 'AM 666.0 does not broadcast the future. It broadcasts the roads we did not choose.',
          source: 'run',
        });
        refreshSaveSnapshot();
      }
    }
    processedLogCountRef.current = state.logs.length;
  }, [state.logs, state.encounter, state.gamePhase]);
};
