import { bossIntel, storyLogById } from '../../game/catalogs';
import { WIPEOUT_CARRYBACK_RATE, isWipeoutCarryback } from '../../game/carryback';
import { getMoeLine } from '../../game/moeDialogue';
import { getReturnDecisionStatus } from '../../game/returnDecision';
import { getDialogueLine } from '../../dialogueConfig';
import { buildResultDecisionLines } from '../../game/runInsights';
import { hasAiNaviContract } from '../state/stateReducer';
import { isAlive } from '../../game/runtimeHelpers';
import { getRouteEventScenario } from '../../scenario/scenarioLoader';
import { getEventById } from '../../eventConfig';
import { getCurrentNaviRouteBriefing, getNaviRouteIntelStatus } from '../state/routeGraph';
import type { State } from '../../game/types';

type RunGrowth = {
  driverXp: number;
  moeSync: number;
  salvageCreditGain: number;
};

type EventPanelsProps = {
  state: State;
  runGrowth: RunGrowth;
};

export const EventPanels = ({ state, runGrowth }: EventPanelsProps) => {
  const aliveEnemies = state.encounter.enemies.filter(isAlive);
  const naviRouteBriefing = state.gamePhase === 'route_choice' ? getCurrentNaviRouteBriefing(state) : undefined;
  const naviRouteIntelStatus = state.gamePhase === 'route_choice' ? getNaviRouteIntelStatus(state) : undefined;
  const salvageEvent = state.gamePhase === 'salvage' ? getEventById(state.routeState?.currentEventId) : undefined;
  const returnStatus = getReturnDecisionStatus(state);
  const wipeoutCarryback = isWipeoutCarryback(state);
  const wipeoutCarrybackPercent = Math.round(WIPEOUT_CARRYBACK_RATE * 100);
  const abyssLoopCleared = state.resultType === 'Boss Cleared' && state.stage >= 4;
  const resultDecisionLines = (state.gamePhase === 'result' || state.gamePhase === 'game_over')
    ? buildResultDecisionLines(state)
    : [];
  const funTestRewards = state.funTestMode
    ? [
      state.salvageCredits > 0 ? `salvage +${state.salvageCredits}` : '',
      state.contracts.length > 0 ? state.contracts.map((module) => module.name).join(' / ') : '',
      ...state.negotiationRewards,
    ].filter(Boolean)
    : [];
  const funTestWeakHits = state.logs.filter((line) => line.includes('WEAK POINT DETECTED')).length;
  const funTestTalkSuccesses = state.logs.filter((line) => line.includes('NEGOTIATION RESPONSE: ACCEPTED')).length;
  const funTestContractWindowOpened = state.logs.some((line) => line.includes('CONTRACT WINDOW'));
  const funTestPassed = state.logs.some((line) => line.includes('Paid Passage') || line.includes('Toll paid'));
  const funTestContractSuccess = state.logs.some((line) => line.includes('CONTRACT REGISTERED'));
  const funTestPeacefulLeft = state.lastReport?.fled ? state.lastReport.fled > 0 : false;
  const funTestBossFuel = state.logs.some((line) => line.includes('Toll paid') || line.includes('Paid Passage'));
  const funTestBossSignal = state.logs.some((line) => line.includes('Toll token recognized') || line.includes('TOLL TOKEN ACCEPTED'));
  const funTestBossMain = !!state.funTestMode && state.funTestMode.id === 'toll_gate_boss'
    && (state.lastReport?.defeated ?? 0) > 0
    && state.logs.some((line) => line.includes('COMMAND: MAIN_GUN') || line.includes('MAIN GUN:'));
  const funTestGoodMoves = state.funTestMode
    ? [
      funTestTalkSuccesses > 0 ? 'Talk success created a better window' : '',
      funTestContractWindowOpened ? 'Opened a Contract Window' : '',
      funTestContractSuccess ? 'Registered a contract reward' : '',
      funTestWeakHits > 0 ? 'Hit a revealed weakness' : '',
      funTestPeacefulLeft ? 'Resolved contact without destroying it' : '',
      funTestBossFuel ? 'Solved Toll Gate by paying fuel' : '',
      funTestBossSignal ? 'Used Signal toward the Toll route' : '',
      funTestBossMain ? 'Forced the boss with Main Gun' : '',
    ].filter(Boolean)
    : [];
  const funTestMissed = state.funTestMode
    ? [
      funTestContractWindowOpened && !funTestContractSuccess ? 'Contract Window opened but Contract was not used' : '',
      funTestWeakHits === 0 && state.logs.some((line) => line.includes('WEAKNESS VISIBLE')) ? 'Weakness was visible but not exploited' : '',
      state.funTestMode.id === 'toll_gate_boss' && !funTestBossFuel && !funTestBossSignal && !funTestBossMain ? 'Try one route: Fuel, Signal, or Main Gun' : '',
      state.funTestMode.id === 'pixie_talk' && funTestTalkSuccesses === 0 ? 'Try Talk before shooting Pixie' : '',
    ].filter(Boolean)
    : [];
  const funTestMoeComment = (() => {
    if (!state.funTestMode) return state.moeLine;
    if (funTestContractSuccess) return '契約判断は良かった。報酬が次の判断に効くよ。';
    if (funTestWeakHits > 0) return '弱点を突けた。次は被弾前に畳みかけよう。';
    if (funTestBossFuel || funTestBossSignal || funTestBossMain) return '通り方を選べた。残る資源で次の正解が変わるよ。';
    if (funTestTalkSuccesses > 0) return 'Talkは通った。窓が開いたら契約まで試して。';
    return state.moeLine;
  })();
  type FunCheckStatus = 'OK' | 'Weak' | 'Missing';
  const statusClass = (value: FunCheckStatus) => value === 'OK' ? 'route' : value === 'Weak' ? 'contract' : 'danger';
  const funTestChecks: Array<{ group: string; items: Array<[string, FunCheckStatus]> }> = state.funTestMode
    ? [
      {
        group: 'Pixie Talk',
        items: [
          ['Talk Incentive', state.funTestMode.id === 'pixie_talk' ? (funTestTalkSuccesses > 0 ? 'OK' : 'Weak') : 'Missing'],
          ['Contract Reward', state.funTestMode.id === 'pixie_talk' ? (funTestContractSuccess ? 'OK' : funTestContractWindowOpened ? 'Weak' : 'Missing') : 'Missing'],
          ['M.O.E. Guidance', state.funTestMode.id === 'pixie_talk' ? 'OK' : 'Missing'],
        ],
      },
      {
        group: 'Road Reaper Combat',
        items: [
          ['Main Gun Incentive', state.funTestMode.id === 'road_reaper_combat' ? (funTestWeakHits > 0 ? 'OK' : 'Weak') : 'Missing'],
          ['Weak Feedback', state.logs.some((line) => line.includes('WARNING BATON BROKEN')) ? 'OK' : state.funTestMode.id === 'road_reaper_combat' ? 'Weak' : 'Missing'],
          ['Defensive Choice', state.funTestMode.id === 'road_reaper_combat' ? (state.logs.some((line) => line.includes('DEFENSIVE POSTURE') || line.includes('ESCAPE') || line.includes('RAM')) ? 'OK' : 'Weak') : 'Missing'],
        ],
      },
      {
        group: 'Toll Gate Boss',
        items: [
          ['Multiple Solutions', state.funTestMode.id === 'toll_gate_boss' ? 'OK' : 'Missing'],
          ['Signal Route', funTestBossSignal ? 'OK' : state.funTestMode.id === 'toll_gate_boss' ? 'Weak' : 'Missing'],
          ['Fuel Toll Route', funTestBossFuel ? 'OK' : state.funTestMode.id === 'toll_gate_boss' ? 'Weak' : 'Missing'],
          ['Main Gun Route', funTestBossMain ? 'OK' : state.funTestMode.id === 'toll_gate_boss' ? 'Weak' : 'Missing'],
        ],
      },
      {
        group: 'Overall',
        items: [
          ['Result clarity', funTestGoodMoves.length > 0 || funTestMissed.length > 0 ? 'OK' : 'Weak'],
          ['Replay motivation', funTestMissed.length > 0 || funTestRewards.length > 0 ? 'OK' : 'Weak'],
        ],
      },
    ]
    : [];
  const funTestAimCards = (() => {
    if (!state.funTestMode) return [];
    if (state.funTestMode.id === 'pixie_talk') {
      return [
        ['Talk first', 'Talk weak / safe reward route'],
        ['Listen', 'safe / opens trust / reveals intent'],
        ['Offer Signal', 'Signal cost / high contract chance / signal returns clean'],
        ['Threaten', 'forces escape / loses contract chance'],
      ];
    }
    if (state.funTestMode.id === 'road_reaper_combat') {
      return [
        ['Main Gun', 'Ballistic weak / breaks lane control'],
        ['Talk', 'resist / only road-language replies may work'],
        ['Guard or Escape', 'defensive choice matters after the first shot'],
      ];
    }
    return [
      ['Traits', 'armored / bargain / guard / toll demand'],
      ['Pay Fuel', 'safe passage / lower reward'],
      ['Present Signal', 'opens contract route / signal weak'],
      ['Main Gun', 'force breakthrough with heavy damage'],
    ];
  })();

  return (
    <>
      {returnStatus.visible && <section className={`event-card event-card--return-status event-card--return-${returnStatus.tone}`}>
        <div className="event-header">
          <div className="event-kicker">RETURN STATUS</div>
          <span className={`event-chip ${returnStatus.tone === 'risk' ? 'event-chip--danger' : 'event-chip--route'}`}>
            {returnStatus.actionLabel}
          </span>
        </div>
        <div className="negotiation-grid">
          <p><span>Return Point</span><strong>{returnStatus.checkpointLabel.replace('Return Point: ', '').toUpperCase()}</strong></p>
          <p><span>Extract</span><strong>{returnStatus.actionLabel}</strong></p>
        </div>
        <p>{returnStatus.detail}</p>
        <p>M.O.E.: 「{getDialogueLine(returnStatus.moeKey, returnStatus.moeFallback)}」</p>
      </section>}

      {state.gamePhase === 'route_choice' && <section className="event-card">
        <div className="event-header">
          <div className="event-kicker">NIGHT LOOP ROUTE</div>
          <span className="event-chip event-chip--route">MAP SELECT</span>
        </div>
        {naviRouteBriefing && <div className="command-window command-window--compact">
          <strong>{naviRouteBriefing.title}</strong>
          {naviRouteBriefing.effects && <p>{naviRouteBriefing.effects}</p>}
        </div>}
        {naviRouteIntelStatus?.isLimited && <div className={`command-alert command-alert--${naviRouteIntelStatus.level}`}>
          <strong>{naviRouteIntelStatus.label}</strong>
          <span>MASKED PATHS</span>
        </div>}
        <div className="route-map-legend" aria-label="Route map legend">
          <span>○ selectable</span>
          <span>● current</span>
          <span>？ masked</span>
        </div>
      </section>}

      {state.gamePhase === 'salvage' && <section className="event-card">
        <div className="event-header">
          <div className="event-kicker">{state.rewardTarget === 'boss' ? 'EMERGENCY SALVAGE' : 'SALVAGE LANE'}</div>
          <span className="event-chip event-chip--route">ONE SAFE PULL</span>
        </div>
        <h2>{salvageEvent?.title ?? 'Salvage Window'}</h2>
        <p>{salvageEvent?.body ?? 'Supply window. One safe pull.'}</p>
        <div className="next-node-list">
          <div className="next-node">
            <span>◎</span>
            <strong>Why one?</strong>
            <small>{salvageEvent?.effects ?? 'ONE PULL / THEN CLOSE'}</small>
          </div>
          <div className="next-node">
            <span>▲</span>
            <strong>Current need</strong>
            <small>Fuel {state.fuel} / Armor {state.armor} / Signal {state.signal} / Main {state.mainAmmo} / S-E {state.seAmmo}</small>
          </div>
          {state.rewardOptions.map((option) => (
            <div key={`salvage-preview-${option.id}`} className="next-node">
              <span>{option.salvagePriority === 'critical' ? '!' : option.salvagePriority === 'event' ? '◎' : '△'}</span>
              <strong>{option.label}</strong>
              <small>{option.salvageContext ?? option.detail}</small>
            </div>
          ))}
        </div>
      </section>}

      {state.gamePhase === 'signal' && <section className="event-card">
        <div className="event-header">
          <div className="event-kicker">SIGNAL LANE</div>
          <span className="event-chip event-chip--route">BOOSTED</span>
        </div>
        {(() => {
          const signalTunnelScenario = getRouteEventScenario('signal_tunnel_01');
          return <>
            <p>{signalTunnelScenario?.title ?? 'Signal Tunnel'}: {signalTunnelScenario?.body ?? 'AM帯干渉を検知。進入手順を選択してください。'}</p>
            <div className="next-node-list">
              {(signalTunnelScenario?.choices ?? []).map((choice) => <div key={`signal-choice-${choice.id}`} className="next-node">
                <span>◎</span>
                <strong>{choice.label}</strong>
                <small>{choice.text}</small>
              </div>)}
            </div>
          </>;
        })()}
        <p>Signal boosted / NAVI Forecast temporarily enhanced ({state.tempForecastBoost > 1 ? '+2' : '+1'} lane gain).</p>
      </section>}

      {state.gamePhase === 'boss_preview' && <section className="event-card">
        <div className="event-header">
          <div className="event-kicker">BOSS PREVIEW</div>
          <span className="event-chip event-chip--danger">DEEP SIGNAL</span>
        </div>
        <h2>Toll Gate Saint</h2>
        <div className="next-node-list">
          <div className="next-node"><span>▲</span><strong>Traits</strong><small>armored / bargain / guard / toll demand</small></div>
          <div className="next-node"><span>▲</span><strong>Likely</strong><small>{bossIntel.likelyEnemyTags}</small></div>
          <div className="next-node"><span>▲</span><strong>Suggested Weakness</strong><small>{bossIntel.likelyWeaknesses}</small></div>
          <div className="next-node"><span>▲</span><strong>Risk / Reward</strong><small>{bossIntel.riskTags} / {bossIntel.rewardTags}</small></div>
        </div>
        <p>M.O.E.: 「{getMoeLine('moe.run.boss_preview', '関門級の強い反応。無理なら引き返そ。', undefined, 'serious')}」</p>
      </section>}

      {(state.gamePhase === 'encounter' || state.gamePhase === 'boss_encounter') && <section className="event-card">
        <div className="event-header">
          <div className="event-kicker">NAVI FORECAST</div>
          <span className={`event-chip ${state.encounter.forecastUnstable ? 'event-chip--danger' : 'event-chip--route'}`}>
            {hasAiNaviContract(state.contracts)
              ? 'AI NAVI +2'
              : state.selectedLoadout.contractSupportId === 'abandoned_ai_navi'
                ? 'SUPPORT NAVI +1'
                : 'TURN +1'}
          </span>
        </div>
        <div className="next-node-list">
          {aliveEnemies.map((enemy) => <div key={`forecast-${enemy.id}`} className="next-node">
            <span>◎</span>
            <strong>{enemy.name}</strong>
            <small>{(state.encounter.forecast[enemy.id] ?? []).map((intent, idx) => `T+${idx + 1}:${intent}`).join(' / ') || 'NO DATA'}</small>
          </div>)}
        </div>
        <div className="next-node-list">
          {state.encounterPrep.approachLabel && <div className="next-node"><span>▲</span><strong>{state.encounterPrep.approachLabel}</strong><small>Approach effect active</small></div>}
          {state.encounterPrep.firstStrike && <div className="next-node"><span>▲</span><strong>FIRST STRIKE</strong><small>Preemptive hit applied</small></div>}
          {state.encounterPrep.talkPrepared && <div className="next-node"><span>▲</span><strong>TALK BOOST</strong><small>First Talk bonus +{Math.round(state.encounterPrep.firstTalkBonus * 100)}%</small></div>}
          {state.encounterPrep.ambushed && <div className="next-node"><span>▲</span><strong>AMBUSHED</strong><small>Opening disadvantage applied</small></div>}
          {state.encounterPrep.intentDisrupted && <div className="next-node"><span>▲</span><strong>INTENT DISRUPTED</strong><small>Opening hostile intent weakened</small></div>}
        </div>
        {state.encounter.forecastUnstable && <p className="event-layer__system">WARNING: FORECAST RELIABILITY UNSTABLE</p>}
      </section>}

      {state.funTestMode && (state.gamePhase === 'encounter' || state.gamePhase === 'boss_encounter') && <section className="event-card">
        <div className="event-header">
          <div className="event-kicker">FUN TEST AIM</div>
          <span className="event-chip event-chip--contract">{state.funTestMode.target}</span>
        </div>
        <div className="next-node-list">
          {funTestAimCards.map(([title, detail]) => <div key={`fun-aim-${title}`} className="next-node">
            <span>◎</span>
            <strong>{title}</strong>
            <small>{detail}</small>
          </div>)}
        </div>
        <p>M.O.E.: 「{state.moeLine}」</p>
      </section>}

      {state.funTestMode?.id === 'toll_gate_boss' && state.gamePhase === 'boss_encounter' && <section className="event-card">
        <div className="event-header">
          <div className="event-kicker">BOSS PREVIEW</div>
          <span className="event-chip event-chip--danger">VISIBLE</span>
        </div>
        <div className="next-node-list">
          <div className="next-node"><span>▲</span><strong>Traits</strong><small>armored / bargain / toll demand</small></div>
          <div className="next-node"><span>▲</span><strong>Options</strong><small>Fuel / Signal / Main Gun / Contract</small></div>
          <div className="next-node"><span>▲</span><strong>Weakness</strong><small>{bossIntel.likelyWeaknesses}</small></div>
          <div className="next-node"><span>▲</span><strong>Risk</strong><small>{bossIntel.riskTags}</small></div>
        </div>
      </section>}

      {state.gamePhase === 'reward' && <section className="event-card">
        <div className="event-header">
          <div className="event-kicker">SALVAGE RESULT</div>
          <span className="event-chip event-chip--route">REPORT</span>
        </div>
        {state.lastReport && <div className="negotiation-grid">
          <p><span>Defeated</span><strong>{state.lastReport.defeated}</strong></p>
          <p><span>Contracted</span><strong>{state.lastReport.contracted}</strong></p>
          <p><span>Fled</span><strong>{state.lastReport.fled}</strong></p>
          <p><span>Escaped</span><strong>{state.lastReport.escaped ? 'YES' : 'NO'}</strong></p>
        </div>}
      </section>}

      {state.gamePhase === 'return_gate' && <section className="event-card">
        <div className="event-header">
          <div className="event-kicker">{state.routeState?.lastReturnCheckpointId ? 'RETURN CHECKPOINT' : 'RETURN GATE'}</div>
          <span className="event-chip event-chip--route">{state.routeState?.returnIntent === 'backtracking' ? 'BACKTRACK COMPLETE' : 'LOCK ACQUIRED'}</span>
        </div>
        <p>{state.routeState?.returnIntent === 'backtracking' ? 'Return checkpoint reacquired. Safe extract is available.' : 'RETURN GATE LOCK ACQUIRED'}</p>
        <p>M.O.E.: 「{state.moeLine}」</p>
        <div className="negotiation-grid">
          <p><span>Fuel</span><strong>{state.fuel}</strong></p>
          <p><span>Armor</span><strong>{state.armor}</strong></p>
          <p><span>Signal</span><strong>{state.signal}</strong></p>
          <p><span>Main Ammo</span><strong>{state.mainAmmo}</strong></p>
          <p><span>S-E Ammo</span><strong>{state.seAmmo}</strong></p>
        </div>
      </section>}

      {(state.gamePhase === 'result' || state.gamePhase === 'game_over') && <section className="event-card event-card--result">
        <div className="event-header">
          <div className="event-kicker">{state.gamePhase === 'result' ? 'RUN COMPLETE' : 'SIGNAL LOST'}</div>
          <span className={`event-chip ${state.gamePhase === 'result' ? 'event-chip--route' : 'event-chip--danger'}`}>{state.resultType ?? 'Vehicle Disabled'}</span>
        </div>
        <h2>{state.resultType ?? 'Vehicle Disabled'}</h2>
        <div className="negotiation-grid">
          <p><span>Encounters cleared</span><strong>{state.runSummary.cleared}</strong></p>
          <p><span>Boss challenged</span><strong>{state.bossChallenged ? 'YES' : 'NO'}</strong></p>
          <p><span>Contracts acquired</span><strong>{state.runSummary.contracted}</strong></p>
          <p><span>Salvage gained</span><strong>{state.salvageCredits}</strong></p>
          <p><span>Fuel / Armor</span><strong>{state.fuel} / {state.armor}</strong></p>
          <p><span>Signal / Main / S-E</span><strong>{state.signal} / {state.mainAmmo} / {state.seAmmo}</strong></p>
          <p><span>Driver XP gained</span><strong>{runGrowth.driverXp}</strong></p>
          <p><span>M.O.E. Sync gained</span><strong>{runGrowth.moeSync}</strong></p>
          <p><span>Salvage Credit gained</span><strong>{runGrowth.salvageCreditGain}</strong></p>
        </div>
        {state.funTestMode && <div className="command-window">
          <div className="panel-title panel-title--compact">
            <span>FUN TEST RESULT</span>
            <small>{state.funTestMode.target}</small>
          </div>
          <div className="negotiation-grid">
            <p><span>Test Target</span><strong>{state.funTestMode.target}</strong></p>
            <p><span>Turns Used</span><strong>{state.encounter.turn}</strong></p>
            <p><span>Defeated</span><strong>{state.lastReport?.defeated ?? 0}</strong></p>
            <p><span>Contracted</span><strong>{state.lastReport?.contracted ?? 0}</strong></p>
            <p><span>Left / Passed</span><strong>{state.lastReport?.fled ?? 0} / {funTestPassed ? 'YES' : 'NO'}</strong></p>
            <p><span>Escaped</span><strong>{state.lastReport?.escaped ? 'YES' : 'NO'}</strong></p>
            <p><span>Contract Window</span><strong>{funTestContractWindowOpened ? 'OPENED' : 'NO'}</strong></p>
            <p><span>Weak Hits</span><strong>{funTestWeakHits}</strong></p>
            <p><span>Talk Successes</span><strong>{funTestTalkSuccesses}</strong></p>
            <p><span>Rewards</span><strong>{funTestRewards.length > 0 ? funTestRewards.join(' / ') : 'none'}</strong></p>
            <p><span>Resources</span><strong>{state.fuel} / {state.armor} / {state.signal} / {state.mainAmmo} / {state.seAmmo}</strong></p>
            <p><span>M.O.E.</span><strong>{funTestMoeComment}</strong></p>
          </div>
        </div>}
        {state.funTestMode && <div className="command-window">
          <div className="panel-title panel-title--compact">
            <span>FUN TEST CHECK</span>
            <small>7 POINTS</small>
          </div>
          <div className="next-node-list">
            {funTestChecks.flatMap((group) => group.items.map(([label, value]) => (
              <div key={`${group.group}-${label}`} className="next-node">
                <span>◎</span>
                <strong>{group.group}: {label}</strong>
                <small><span className={`event-chip event-chip--${statusClass(value)}`}>{value}</span></small>
              </div>
            )))}
          </div>
        </div>}
        {state.funTestMode && <div className="command-window">
          <div className="panel-title panel-title--compact">
            <span>GOOD MOVES</span>
            <small>{funTestGoodMoves.length}</small>
          </div>
          <div className="next-node-list">
            {(funTestGoodMoves.length > 0 ? funTestGoodMoves : ['No strong move recorded yet']).map((move) => (
              <div key={`good-${move}`} className="next-node">
                <span>◎</span>
                <strong>{move}</strong>
                <small>{move === 'No strong move recorded yet' ? 'Try the highlighted route once.' : 'Recorded'}</small>
              </div>
            ))}
          </div>
        </div>}
        {state.funTestMode && <div className="command-window">
          <div className="panel-title panel-title--compact">
            <span>MISSED OPPORTUNITIES</span>
            <small>{funTestMissed.length}</small>
          </div>
          <div className="next-node-list">
            {(funTestMissed.length > 0 ? funTestMissed : ['No major miss detected']).map((miss) => (
              <div key={`miss-${miss}`} className="next-node">
                <span>△</span>
                <strong>{miss}</strong>
                <small>{miss === 'No major miss detected' ? 'Clean test route.' : 'Try this next run.'}</small>
              </div>
            ))}
          </div>
        </div>}
        {state.negotiationRewards.length > 0 && <div className="command-window">
          <div className="panel-title panel-title--compact">
            <span>NEGOTIATION REWARD</span>
            <small>{state.negotiationRewards.length}</small>
          </div>
          <div className="next-node-list">
            {state.negotiationRewards.map((reward) => <div key={`negotiation-${reward}`} className="next-node">
              <span>◎</span>
              <strong>{reward.split(':')[0]}</strong>
              <small>{reward.includes(':') ? reward.slice(reward.indexOf(':') + 1).trim() : reward}</small>
            </div>)}
          </div>
        </div>}
        <div className="command-window">
          <p>GARAGE: GROWTH / TUNE / SORTIE</p>
          <p>GAIN: XP +{runGrowth.driverXp} / SYNC +{runGrowth.moeSync} / CR +{runGrowth.salvageCreditGain}</p>
          {abyssLoopCleared && <p>ABYSS LOOP CLEAR BONUS: Driver XP +2 / M.O.E. Sync +2 / Credit +2</p>}
        </div>
        <div className="command-window">
          <div className="panel-title panel-title--compact">
            <span>RUN JUDGMENT</span>
            <small>3 LINE REVIEW</small>
          </div>
          <div className="next-node-list">
            {resultDecisionLines.map((line) => <div key={line} className="next-node">
              <span>◎</span>
              <strong>{line.split(':')[0]}</strong>
              <small>{line.includes(':') ? line.slice(line.indexOf(':') + 1).trim() : line}</small>
            </div>)}
          </div>
        </div>
        {wipeoutCarryback && <div className="command-window command-window--danger">
          <div className="panel-title panel-title--compact">
            <span>WIPEOUT CARRYBACK</span>
            <small>{wipeoutCarrybackPercent}% RECOVERED</small>
          </div>
          <p>CARRYBACK: XP +{runGrowth.driverXp} / SYNC +{runGrowth.moeSync} / CR +{runGrowth.salvageCreditGain}</p>
          <p>EXTRACTなら全量確保。</p>
        </div>}
        <div className="command-window">
          <div className="panel-title panel-title--compact">
            <span>RECOVERED LOG</span>
            <small>{state.story.recentRecoveredLogs.length > 0 ? `${state.story.recentRecoveredLogs.length} NEW` : 'NO NEW'}</small>
          </div>
          {state.story.recentRecoveredLogs.length > 0
            ? <div className="next-node-list">
              {state.story.recentRecoveredLogs.map((id) => <div key={`recent-${id}`} className="next-node">
                <span>◎</span>
                <strong>{id}: {storyLogById[id].title}</strong>
                <small>{storyLogById[id].text}</small>
              </div>)}
            </div>
            : <p>NO NEW LOG</p>}
        </div>
      </section>}
    </>
  );
};
