import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getDialogueLineWithVars } from '../../dialogueConfig';
import type { ApproachKind, EncounterPrep, GamePhase } from '../../game/types';

export type RunBeatTone = 'system' | 'route' | 'warn' | 'boss';

export type RunBeat = {
  id: string;
  title: string;
  subtitle?: string;
  moe?: string;
  tone?: RunBeatTone;
  durationMs?: number;
};

type UseRunBeatQueueParams = {
  enabled?: boolean;
  gamePhase: GamePhase;
  encounterIndex: number;
  stage: number;
  encounterPrep: EncounterPrep;
  approachScanSuccess?: boolean;
  approachKind?: ApproachKind;
};

const toRunBeat = (beat: RunBeat): RunBeat => ({
  durationMs: 1800,
  tone: 'system',
  ...beat,
});

const buildPhaseBeats = ({
  prevPhase,
  gamePhase,
  encounterIndex,
  stage,
  encounterPrep,
  approachScanSuccess,
  approachKind,
}: UseRunBeatQueueParams & { prevPhase: GamePhase }): RunBeat[] => {
  const loopLabel = getDialogueLineWithVars(
    'run.beat.loop',
    'LOOP {loop}',
    { loop: encounterIndex + 1 },
  );
  const stageLabel = getDialogueLineWithVars(
    'run.beat.stage',
    'STAGE {stage}',
    { stage },
  );
  const beats: RunBeat[] = [];
  const routeTransitSubtitle = `${stageLabel} / ${loopLabel}`;

  if (gamePhase === 'approach' && prevPhase !== 'approach') {
    const isRunEntry = prevPhase === 'garage' || prevPhase === 'prologue';
    beats.push(
      toRunBeat(
        isRunEntry
          ? {
              id: `entry-${stage}-${encounterIndex + 1}`,
              title: getDialogueLineWithVars('run.beat.entry', 'NIGHT LOOP ENTRY'),
              subtitle: routeTransitSubtitle,
              moe: getDialogueLineWithVars('moe.beat.entry', '進路同期完了。侵入開始。'),
              tone: 'route',
              durationMs: 1500,
            }
          : {
              id: `lane-transit-${stage}-${encounterIndex + 1}-${prevPhase}`,
              title: getDialogueLineWithVars('run.beat.lane_transit', 'LANE TRANSIT'),
              subtitle: routeTransitSubtitle,
              moe: getDialogueLineWithVars('moe.beat.lane_transit', '車線変更、入った。次の反応まで少しだけ走るよ。'),
              tone: 'route',
              durationMs: 1450,
            },
      ),
    );
    beats.push(
      toRunBeat({
        id: `approach-window-${stage}-${encounterIndex + 1}`,
        title: approachScanSuccess
          ? getDialogueLineWithVars('run.beat.approach_window', 'APPROACH WINDOW OPEN')
          : getDialogueLineWithVars('run.beat.brace_contact', 'BRACE FOR CONTACT'),
        tone: approachScanSuccess ? 'system' : 'warn',
        durationMs: 1200,
      }),
    );
    beats.push(
      toRunBeat({
        id: `contact-${encounterIndex + 1}`,
        title: approachScanSuccess
          ? getDialogueLineWithVars('run.beat.contact_detected', 'CONTACT DETECTED')
          : getDialogueLineWithVars('run.beat.ambush', 'AMBUSH WARNING'),
        moe: approachScanSuccess
          ? getDialogueLineWithVars('moe.beat.contact_detected', '接触反応。手順を選んで。')
          : getDialogueLineWithVars('moe.beat.ambush', '遅れた。初撃が来る。'),
        tone: approachScanSuccess ? 'system' : 'warn',
        durationMs: 1400,
      }),
    );
    return beats;
  }

  if (gamePhase === 'route_choice' && prevPhase !== 'route_choice') {
    beats.push(
      toRunBeat({
        id: `route-forecast-${stage}-${encounterIndex + 1}`,
        title: getDialogueLineWithVars('run.beat.route_forecast', 'NAVI FORECAST'),
        subtitle: getDialogueLineWithVars('run.beat.route_options', 'ROUTE OPTIONS AVAILABLE'),
        moe: getDialogueLineWithVars('moe.beat.route_forecast', '分岐候補、拾えた。少し先まで見て選ぼう。'),
        tone: 'route',
        durationMs: 1300,
      }),
    );
    return beats;
  }

  if (gamePhase === 'salvage' && prevPhase !== 'salvage') {
    beats.push(
      toRunBeat({
        id: `salvage-transit-${stage}-${encounterIndex + 1}`,
        title: getDialogueLineWithVars('run.beat.lane_transit', 'LANE TRANSIT'),
        subtitle: getDialogueLineWithVars('run.beat.salvage_lane', 'SALVAGE LANE'),
        moe: getDialogueLineWithVars('moe.beat.salvage_lane', '補給反応に寄せる。速度を落とすね。'),
        tone: 'route',
        durationMs: 1200,
      }),
    );
    beats.push(
      toRunBeat({
        id: `salvage-response-${stage}-${encounterIndex + 1}`,
        title: getDialogueLineWithVars('run.beat.salvage_response', 'SALVAGE RESPONSE'),
        subtitle: getDialogueLineWithVars('run.beat.choose_pickup', 'CHOOSE ONE PICKUP'),
        tone: 'system',
        durationMs: 1200,
      }),
    );
    return beats;
  }

  if (gamePhase === 'signal' && prevPhase !== 'signal') {
    beats.push(
      toRunBeat({
        id: `signal-transit-${stage}-${encounterIndex + 1}`,
        title: getDialogueLineWithVars('run.beat.lane_transit', 'LANE TRANSIT'),
        subtitle: getDialogueLineWithVars('run.beat.signal_lane', 'SIGNAL LANE'),
        moe: getDialogueLineWithVars('moe.beat.signal_lane', '信号帯に入る。ノイズ、少しだけ我慢して。'),
        tone: 'route',
        durationMs: 1200,
      }),
    );
    beats.push(
      toRunBeat({
        id: `signal-window-${stage}-${encounterIndex + 1}`,
        title: getDialogueLineWithVars('run.beat.signal_window', 'SIGNAL WINDOW'),
        subtitle: getDialogueLineWithVars('run.beat.choose_signal_action', 'CHOOSE SIGNAL ACTION'),
        tone: 'system',
        durationMs: 1200,
      }),
    );
    return beats;
  }

  if ((gamePhase === 'encounter' || gamePhase === 'boss_encounter') && prevPhase !== gamePhase) {
    const approachLabel = encounterPrep.approachLabel;
    if (encounterPrep.firstStrike) {
      beats.push(
        toRunBeat({
          id: `first-strike-${stage}-${encounterIndex + 1}`,
          title: getDialogueLineWithVars('run.beat.first_strike', 'FIRST STRIKE'),
          subtitle:
            encounterPrep.firstStrikeDamage && encounterPrep.firstStrikeDamage > 0
              ? getDialogueLineWithVars('run.beat.first_strike_damage', 'DAMAGE {damage}', {
                damage: encounterPrep.firstStrikeDamage,
              })
              : undefined,
          tone: 'route',
          durationMs: 1300,
        }),
      );
    } else if (encounterPrep.ambushed) {
      beats.push(
        toRunBeat({
          id: `ambush-hit-${stage}-${encounterIndex + 1}`,
          title: getDialogueLineWithVars('run.beat.ambush', 'AMBUSH WARNING'),
          tone: 'warn',
          durationMs: 1300,
        }),
      );
    } else if (approachLabel === 'TALK BOOST') {
      beats.push(
        toRunBeat({
          id: `silent-coast-${stage}-${encounterIndex + 1}`,
          title: getDialogueLineWithVars('run.beat.silent_coast', 'SILENT APPROACH'),
          tone: 'route',
          durationMs: 1200,
        }),
      );
    } else if (approachLabel === 'OPEN CHANNEL') {
      beats.push(
        toRunBeat({
          id: `open-channel-${stage}-${encounterIndex + 1}`,
          title: getDialogueLineWithVars('run.beat.open_channel', 'CHANNEL OPEN'),
          tone: 'route',
          durationMs: 1200,
        }),
      );
    }

    beats.push(
      toRunBeat({
        id: `encounter-start-${stage}-${encounterIndex + 1}`,
        title: gamePhase === 'boss_encounter'
          ? getDialogueLineWithVars('run.beat.boss_signal', 'BOSS SIGNAL')
          : getDialogueLineWithVars('run.beat.encounter_start', 'ENCOUNTER START'),
        subtitle: gamePhase === 'boss_encounter'
          ? getDialogueLineWithVars('run.beat.boss_unreadable', 'SILHOUETTE LOCK / INTEL REQUIRED')
          : `${stageLabel} / ${loopLabel}`,
        tone: gamePhase === 'boss_encounter' ? 'boss' : 'system',
        durationMs: gamePhase === 'boss_encounter' ? 2200 : 1500,
      }),
    );
    return beats;
  }

  if (gamePhase === 'boss_preview' && prevPhase !== 'boss_preview') {
    beats.push(
      toRunBeat({
        id: `boss-preview-${stage}-${encounterIndex + 1}`,
        title: getDialogueLineWithVars('run.beat.boss_signal', 'BOSS SIGNAL'),
        subtitle: getDialogueLineWithVars('run.beat.deep_signal', 'DEEP SIGNAL DETECTED'),
        moe: getDialogueLineWithVars('moe.beat.boss_signal', '深層反応。輪郭だけ見える。'),
        tone: 'boss',
        durationMs: 2400,
      }),
    );
    if (approachKind === 'boss') {
      beats.push(
        toRunBeat({
          id: `boss-preview-unreadable-${stage}-${encounterIndex + 1}`,
          title: getDialogueLineWithVars('run.beat.boss_unreadable', 'SILHOUETTE LOCK / INTEL REQUIRED'),
          tone: 'boss',
          durationMs: 1700,
        }),
      );
    }
  }

  return beats;
};

export const useRunBeatQueue = ({
  enabled = true,
  gamePhase,
  encounterIndex,
  stage,
  encounterPrep,
  approachScanSuccess,
  approachKind,
}: UseRunBeatQueueParams) => {
  const [queue, setQueue] = useState<RunBeat[]>([]);
  const [activeBeat, setActiveBeat] = useState<RunBeat | null>(null);
  const prevPhaseRef = useRef<GamePhase>(gamePhase);
  const timerRef = useRef<number | null>(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const dismissBeat = useCallback(() => {
    clearTimer();
    setActiveBeat(null);
  }, [clearTimer]);

  useEffect(() => {
    if (enabled) return;
    clearTimer();
    setQueue([]);
    setActiveBeat(null);
    prevPhaseRef.current = gamePhase;
  }, [clearTimer, enabled, gamePhase]);

  useEffect(() => {
    if (!enabled) return;
    const prevPhase = prevPhaseRef.current;
    if (prevPhase !== gamePhase) {
      const nextBeats = buildPhaseBeats({
        prevPhase,
        gamePhase,
        encounterIndex,
        stage,
        encounterPrep,
        approachScanSuccess,
        approachKind,
      });
      if (nextBeats.length > 0) {
        setQueue((current) => [...current, ...nextBeats]);
      }
      prevPhaseRef.current = gamePhase;
    }
  }, [approachKind, approachScanSuccess, enabled, encounterIndex, encounterPrep, gamePhase, stage]);

  useEffect(() => {
    if (activeBeat || queue.length === 0) return;
    setActiveBeat(queue[0]);
    setQueue((current) => current.slice(1));
  }, [activeBeat, queue]);

  useEffect(() => {
    if (!activeBeat) return;
    clearTimer();
    timerRef.current = window.setTimeout(() => {
      setActiveBeat(null);
      timerRef.current = null;
    }, activeBeat.durationMs ?? 1800);
    return () => clearTimer();
  }, [activeBeat, clearTimer]);

  useEffect(() => () => clearTimer(), [clearTimer]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!activeBeat) return;
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      dismissBeat();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [activeBeat, dismissBeat]);

  return useMemo(
    () => ({ activeBeat, dismissBeat }),
    [activeBeat, dismissBeat],
  );
};
