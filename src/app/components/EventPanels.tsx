import { bossIntel, routeIntelCatalog, routeScenarioIdMap, storyLogById } from '../../game/catalogs';
import { getMoeLine } from '../../game/moeDialogue';
import { hasAiNaviContract } from '../state/stateReducer';
import { isAlive } from '../../game/runtimeHelpers';
import { getRouteEventScenario } from '../../scenario/scenarioLoader';
import { getEventById } from '../../eventConfig';
import { getCurrentNaviRouteBriefing, getNaviRouteCandidates, getNaviRouteIntelStatus } from '../state/routeGraph';
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
  const naviRouteCandidates = state.gamePhase === 'route_choice' ? getNaviRouteCandidates(state) : [];
  const naviRouteIntelStatus = state.gamePhase === 'route_choice' ? getNaviRouteIntelStatus(state) : undefined;
  const salvageEvent = state.gamePhase === 'salvage' ? getEventById(state.routeState?.currentEventId) : undefined;

  return (
    <>
      {state.gamePhase === 'route_choice' && <section className="event-card">
        <div className="event-header">
          <div className="event-kicker">NIGHT LOOP ROUTE</div>
          <span className="event-chip event-chip--route">CHOOSE NEXT LANE</span>
        </div>
        {naviRouteBriefing && <div className="command-window">
          <strong>{naviRouteBriefing.title}</strong>
          <p>{naviRouteBriefing.body ?? 'NAVI signal is noisy. Details partially masked.'}</p>
          {naviRouteBriefing.effects && <p>{naviRouteBriefing.effects}</p>}
        </div>}
        {naviRouteIntelStatus?.isLimited && <div className={`command-alert command-alert--${naviRouteIntelStatus.level}`}>
          <strong>{naviRouteIntelStatus.label}</strong>
          <span>{naviRouteIntelStatus.detail}</span>
        </div>}
        {naviRouteCandidates.length > 0
          ? <div className="next-node-list">
            {naviRouteCandidates.map((candidate) => <div key={`${candidate.nodeId}-${candidate.choiceId}`} className="next-node">
              <span>◎</span>
              <strong>{candidate.title}</strong>
              <small>tags: {candidate.tags}</small>
              <small>route: {candidate.forecast.join(' > ')} / boss: {candidate.bossSteps ?? '--'} steps</small>
              <small>risk: {candidate.risk} / reward: {candidate.reward}</small>
              {candidate.body && <small>{candidate.body}</small>}
              {candidate.effects && <small>effects: {candidate.effects}</small>}
            </div>)}
          </div>
          : <div className="next-node-list">
            {(['salvage', 'signal', 'push_forward', 'return_gate'] as const).map((lane) => {
              const scenario = routeScenarioIdMap[lane] ? getRouteEventScenario(routeScenarioIdMap[lane] ?? '') : undefined;
              return <div key={lane} className="next-node">
                <span>◎</span>
                <strong>{routeIntelCatalog[lane].label}</strong>
                <small>likely: {routeIntelCatalog[lane].likelyEnemyTags}</small>
                <small>suggested: {routeIntelCatalog[lane].likelyWeaknesses}</small>
                <small>risk: {routeIntelCatalog[lane].riskTags} / reward: {routeIntelCatalog[lane].rewardTags}</small>
                {scenario?.body && <small>{scenario.body}</small>}
              </div>;
            })}
          </div>}
      </section>}

      {state.gamePhase === 'salvage' && <section className="event-card">
        <div className="event-header">
          <div className="event-kicker">{state.rewardTarget === 'boss' ? 'EMERGENCY SALVAGE' : 'SALVAGE LANE'}</div>
          <span className="event-chip event-chip--route">ONE SAFE PULL</span>
        </div>
        <h2>{salvageEvent?.title ?? 'Salvage Window'}</h2>
        <p>{salvageEvent?.body ?? 'The loop opens a short supply window. Only one safe extraction fits before the lane collapses.'}</p>
        <div className="next-node-list">
          <div className="next-node">
            <span>◎</span>
            <strong>Why one?</strong>
            <small>{salvageEvent?.effects ?? 'One safe extraction before the Night Loop notices the vehicle.'}</small>
          </div>
          <div className="next-node">
            <span>▲</span>
            <strong>Current need</strong>
            <small>Fuel {state.fuel} / Armor {state.armor} / Signal {state.signal} / Main {state.mainAmmo} / S-E {state.seAmmo}</small>
          </div>
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
        <p>M.O.E.: 「{getMoeLine('moe.run.boss_preview', '料金所型の強い反応。無理なら引き返そ。', undefined, 'serious')}」</p>
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
        <div className="command-window">
          <p>次Run前に Garage で成長・改装できます。</p>
          <p>見込み獲得: Driver XP +{runGrowth.driverXp} / M.O.E. Sync +{runGrowth.moeSync} / Credit +{runGrowth.salvageCreditGain}</p>
        </div>
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
            : <p>No new story logs recovered this run.</p>}
        </div>
      </section>}
    </>
  );
};
