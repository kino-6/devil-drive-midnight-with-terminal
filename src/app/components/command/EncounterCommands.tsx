import { commandDescriptions, commandOptions } from '../../../game/catalogs';
import { getConversationLine } from '../../../conversationConfig';
import { getCommandActionHint } from '../../../game/actionPresentation';
import { getEnemyRevealState } from '../../../game/runtimeHelpers';
import { canPayConversationChoiceCost } from '../../../game/talkRules';
import type { CommandId, State } from '../../../game/types';

type Group = 'WEAPON' | 'TERMINAL' | 'DRIVE';

type EncounterCommandsProps = {
  state: State;
  groupOrder: Group[];
  commandEnabledMap: Record<CommandId, boolean>;
  commandAffinityTagMap: Partial<Record<CommandId, string>>;
  contractEnabled: boolean;
  selectedMainGunName: string;
  selectedSubGunName: string;
  selectedSubGunDescription: string;
  selectedSEName: string;
  selectedSEDescription: string;
  getPredictedDamageLabel: (commandId: 'main_gun' | 'sub_gun' | 'se_harpoon' | 'ram') => string;
  getMoeCommandGuide: (commandId: CommandId) => string;
  getDialogueLine: (key: string, fallback: string) => string;
  setHoveredHint: (hint: string) => void;
  clearHoveredHint: () => void;
  onExecuteCommand: (command: CommandId) => void;
  onSelectCommand: (command: CommandId) => void;
  onTalkChoose: (choiceId: string) => void;
  onTalkCancel: () => void;
};

export const EncounterCommands = ({
  state,
  groupOrder,
  commandEnabledMap,
  commandAffinityTagMap,
  contractEnabled,
  selectedMainGunName,
  selectedSubGunName,
  selectedSubGunDescription,
  selectedSEName,
  selectedSEDescription,
  getPredictedDamageLabel,
  getMoeCommandGuide,
  getDialogueLine,
  setHoveredHint,
  clearHoveredHint,
  onExecuteCommand,
  onSelectCommand,
  onTalkChoose,
  onTalkCancel,
}: EncounterCommandsProps) => {
  const selectedEnemy = state.encounter.enemies.find((enemy) => enemy.id === state.encounter.selectedEnemyId);
  const selectedEnemyReveal = selectedEnemy
    ? getEnemyRevealState(selectedEnemy, state.encounter.analyzedEnemyIds)
    : undefined;
  const buildCommandActionHint = (commandId: CommandId) => getCommandActionHint({
    commandId,
    intent: selectedEnemy?.intent,
    actionReadable: !!selectedEnemyReveal?.showIntent,
    targetKnown: !!selectedEnemyReveal?.showName,
    signal: state.signal,
    contractEnabled,
  });
  const buildFallbackCommandHint = (commandId: CommandId) => {
    if (commandId === 'main_gun') {
      return `主砲 ${selectedMainGunName}。与ダメ目安 ${getPredictedDamageLabel('main_gun')}、残弾 ${state.mainAmmo}。`;
    }
    if (commandId === 'sub_gun') {
      return `副砲 ${selectedSubGunName}。与ダメ目安 ${getPredictedDamageLabel('sub_gun')} / ${selectedSubGunDescription}`;
    }
    if (commandId === 'se_harpoon') {
      return `S-E ${selectedSEName}。与ダメ目安 ${getPredictedDamageLabel('se_harpoon')} / ${selectedSEDescription}（残弾 ${state.seAmmo}）`;
    }
    if (commandId === 'ram') return `Ram: hit range ${getPredictedDamageLabel('ram')} / ARMOR -1`;
    if (commandId === 'contract') {
      return contractEnabled
        ? getDialogueLine('hint.contract.window_open', '契約窓が開いてる。今なら接続できる。')
        : getDialogueLine('hint.contract.window_closed', '契約窓がまだ開いていない。TalkかS-Eを先に。');
    }
    return getMoeCommandGuide(commandId);
  };
  const buildCommandHint = (commandId: CommandId) => {
    const actionHint = buildCommandActionHint(commandId);
    const signalPreview = getSignalLossPreview(commandId);
    return [actionHint || buildFallbackCommandHint(commandId), signalPreview].filter(Boolean).join(' / ');
  };
  const buildCommandDesc = (commandId: CommandId) => {
    const actionHint = buildCommandActionHint(commandId);
    const signalPreview = getSignalLossPreview(commandId);
    if (actionHint) return [actionHint, signalPreview].filter(Boolean).join(' / ');
    if (commandId === 'talk' && !commandEnabledMap[commandId]) {
      return '未解析対象にはTalk不可。Analyzeで署名を掴んでから交信する。';
    }
    if (commandId === 'contract') return contractEnabled ? 'Window Open' : 'No contract window';
    return commandDescriptions[commandId].description;
  };
  const buildCommandPrediction = (commandId: CommandId) => {
    const risk = buildCommandActionHint(commandId);
    if (commandId === 'main_gun') return `GAIN DMG ${getPredictedDamageLabel('main_gun')} / COST MAIN -1 / RISK ${risk}`;
    if (commandId === 'sub_gun') return `GAIN SPREAD ${getPredictedDamageLabel('sub_gun')} / COST FREE / RISK ${risk}`;
    if (commandId === 'se_harpoon') return `GAIN S-E ${getPredictedDamageLabel('se_harpoon')} / COST S-E / RISK ${risk}`;
    if (commandId === 'analyze') return `GAIN ACTION READ / COST SIGNAL -1 / RISK ${getSignalLossPreview(commandId) ?? risk}`;
    if (commandId === 'talk') return `GAIN ACTION SHIFT / ROUTE READ / COST VARIES / RISK ${getSignalLossPreview(commandId) ?? risk}`;
    if (commandId === 'contract') return `GAIN CONTRACT / COST WINDOW / RISK ${risk}`;
    if (commandId === 'ram') return `GAIN DMG ${getPredictedDamageLabel('ram')} / COST ARMOR -1 / RISK ${risk}`;
    if (commandId === 'guard') return `GAIN DAMAGE CUT / COST TURN / RISK ${risk}`;
    return `GAIN EXIT CHANCE / COST FUEL -1 / RISK ${risk}`;
  };
  function getSignalLossPreview(commandId: CommandId): string | undefined {
    if (commandId === 'analyze') {
      if (state.signal <= 0) return 'NO SIGNAL: Action/Weak stay locked';
      if (state.signal === 1) return 'LAST SIGNAL: spend to read';
    }
    if (commandId === 'talk') {
      if (!selectedEnemyReveal?.showName) return undefined;
      if (state.signal <= 0) return 'NO SIGNAL: paid replies locked';
      if (state.signal === 1) return 'LOW SIGNAL: paid replies narrow';
    }
    return undefined;
  }
  const getTalkChoicePreview = (choiceId: string): string => {
    const profile = state.activeConversation?.enemyProfile;
    if (profile === 'pixie_shibuya_glow') {
      if (choiceId === 'listen') return 'SAFE / TRUST +2 / WINDOW';
      if (choiceId === 'offer_signal') return 'SIGNAL -1 / SIGNAL +1 / WINDOW';
      if (choiceId === 'threaten') return 'FORCE LEAVE / NO CONTRACT';
      if (choiceId === 'pixie_listen_dawn') return 'BEST / TRUST + WINDOW';
      if (choiceId === 'pixie_listen_engine') return 'SAFE / INTENT + WINDOW';
      if (choiceId === 'pixie_listen_joke') return 'FUN / INTEREST + WINDOW';
      if (choiceId === 'pixie_signal_blue') return 'BEST / SIGNAL CLEAN + WINDOW';
      if (choiceId === 'pixie_signal_share') return 'ROUTE READ + WINDOW';
      if (choiceId === 'pixie_signal_take_back') return 'RECOVER / NO WINDOW';
      if (choiceId === 'pixie_threat_apologize') return 'RECOVER TRUST / RISK';
      if (choiceId === 'pixie_threat_double') return 'LEAVE / HIGH RISK';
      if (choiceId === 'pixie_threat_leave') return 'END TALK / SAFE';
    }
    if (profile === 'road_reaper') {
      if (choiceId === 'ask_detour') return 'ROUTE READ / RISK ARMOR';
      if (choiceId === 'flash_headlights') return 'INTENT CUT / SIGNAL LINE';
      if (choiceId === 'force_through') return 'PASS CHANCE / HIGH RISK';
    }
    if (profile === 'toll_gate_saint') {
      if (choiceId === 'pay_fuel') return 'PAY FUEL / SAFE PASS';
      if (choiceId === 'present_signal') return 'SIGNAL -1 / CONTRACT ROUTE';
      if (choiceId === 'refuse_toll') return 'FORCE / CANCEL INTENT';
    }
    return 'GAIN ACTION SHIFT / ROUTE READ / WINDOW';
  };

  return <>
    {state.encounter.phase === 'conversation' && state.activeConversation && (
      <div className="command-window command-list">
        <div className="event-kicker">TALK CHANNEL</div>
        {state.activeConversation.history && state.activeConversation.history.length > 1 && (
          <div className="talk-rally">
            {state.activeConversation.history.slice(-4).map((entry, index) => (
              <p key={`${entry.speaker}-${index}`}>
                <span>{entry.speaker}</span>
                {entry.line}
              </p>
            ))}
          </div>
        )}
        <strong>{state.activeConversation.introLine}</strong>
        {state.activeConversation.choices.map((choice) => {
          const disabled = !canPayConversationChoiceCost(choice, state);
          const costParts: string[] = [];
          if (choice.cost?.fuel) costParts.push(`Fuel -${choice.cost.fuel}`);
          if (choice.cost?.armor) costParts.push(`Armor -${choice.cost.armor}`);
          if (choice.cost?.signal) costParts.push(`Signal -${choice.cost.signal}`);
          if (choice.cost?.mainAmmo) costParts.push(`Main Ammo -${choice.cost.mainAmmo}`);
          if (choice.cost?.seAmmo) costParts.push(`S-E Ammo -${choice.cost.seAmmo}`);
          if (choice.cost?.salvageCredits) costParts.push(`Credits -${choice.cost.salvageCredits}`);
          const costText = costParts.length > 0 ? `Cost: ${costParts.join(', ')}` : '';
          const labelJa = choice.attitude ? getConversationLine(`talk.choice.${choice.attitude}.label_ja`, '') : '';
          const helpText = choice.attitude ? getConversationLine(`talk.choice.${choice.attitude}.help`, '') : '';
          const hintText = choice.hintKey ? getConversationLine(choice.hintKey, '') : '';
          const moodText = state.activeConversation?.mood ? `Mood: ${state.activeConversation.mood}` : '';
          const personaText = state.activeConversation?.persona ? `Persona: ${state.activeConversation.persona}` : '';
          const descText = [labelJa, helpText, choice.playerLine, hintText, moodText, personaText, costText].filter(Boolean).join(' / ');

          return (
            <button
              key={choice.id}
              className="command-button command-button--contract"
              onMouseEnter={() => {
                setHoveredHint(descText);
              }}
              onMouseLeave={clearHoveredHint}
              data-desc={descText}
              onClick={() => onTalkChoose(choice.id)}
              type="button"
              disabled={disabled}
            >
              <span className="command-button__label-stack">
                <span className="command-button__label">{choice.label}</span>
                {labelJa && <small>{labelJa}</small>}
                <small className="command-button__prediction">{getTalkChoicePreview(choice.id)}</small>
              </span>
              <span className="command-button__meta-stack">
                {costText && <small>{costText.replace('Cost: ', '')}</small>}
                {helpText && <small>{helpText}</small>}
                {disabled && <span className="command-button__affinity command-button__affinity--resist">NO COST</span>}
              </span>
            </button>
          );
        })}
        <button className="command-button command-button--system" onClick={onTalkCancel} type="button">
          Cancel Talk
        </button>
      </div>
    )}

    {state.encounter.phase === 'conversation' && !state.activeConversation && (
      <div className="command-window command-list">
        <div className="event-kicker">TALK CHANNEL</div>
        <strong>{getDialogueLine('hint.talk.channel_desync', 'Channel sync lost.')}</strong>
        <button className="command-button command-button--system" onClick={onTalkCancel} type="button">
          {getDialogueLine('hint.talk.return_to_command', 'Return to Command')}
        </button>
      </div>
    )}

    {state.encounter.phase !== 'conversation' && <>
      <div className="command-groups">
        {groupOrder.map((group) => <div key={group} className="command-group">
          <div className="command-group__title">{group}</div>
          <div className="command-window command-list command-window--grid">
            {commandOptions.filter((option) => option.group === group).map((command) => <button
              key={command.id}
              className={`command-button command-button--${command.tone} ${state.encounter.selectedCommand === command.id ? 'is-selected' : ''}`}
              onClick={() => {
                if (commandEnabledMap[command.id]) {
                  onExecuteCommand(command.id);
                  return;
                }
                onSelectCommand(command.id);
              }}
              disabled={!commandEnabledMap[command.id]}
              type="button"
              onMouseEnter={() => {
                setHoveredHint(buildCommandHint(command.id));
              }}
              onMouseLeave={clearHoveredHint}
              onFocus={() => setHoveredHint(buildCommandHint(command.id))}
              onBlur={clearHoveredHint}
              data-desc={buildCommandDesc(command.id)}
            >
              <span className="command-button__label-stack">
                <span className="command-button__label">{command.label}</span>
                {getSignalLossPreview(command.id) && (
                  <small className="command-button__warning">{getSignalLossPreview(command.id)}</small>
                )}
                <small className={`command-button__prediction ${state.encounter.selectedCommand === command.id ? '' : 'is-empty'}`}>
                  {state.encounter.selectedCommand === command.id ? buildCommandPrediction(command.id) : 'GAIN / COST / RISK'}
                </small>
              </span>
              {command.id === 'talk' && !commandEnabledMap[command.id] && (
                <span className="command-button__affinity command-button__affinity--resist">ANALYZE FIRST</span>
              )}
              {commandAffinityTagMap[command.id] && (
                <span className="command-button__badges">
                  <span className={`command-button__affinity command-button__affinity--${commandAffinityTagMap[command.id]?.toLowerCase()}`}>{commandAffinityTagMap[command.id]}</span>
                </span>
              )}
            </button>)}
          </div>
        </div>)}
      </div>
      <div className="command-window">
        <div className="command-instant">Tap command to execute instantly</div>
      </div>
    </>}
  </>;
};
