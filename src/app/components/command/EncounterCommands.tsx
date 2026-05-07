import { commandDescriptions, commandOptions } from '../../../game/catalogs';
import { getConversationLine } from '../../../conversationConfig';
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
}: EncounterCommandsProps) => (
  <>
    {state.encounter.phase === 'conversation' && state.activeConversation && (
      <div className="command-window command-list">
        <div className="event-kicker">TALK CHANNEL</div>
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
          const hintText = choice.hintKey ? getConversationLine(choice.hintKey, '') : '';
          const moodText = state.activeConversation?.mood ? `Mood: ${state.activeConversation.mood}` : '';
          const personaText = state.activeConversation?.persona ? `Persona: ${state.activeConversation.persona}` : '';
          const descText = [choice.playerLine, hintText, moodText, personaText, costText].filter(Boolean).join(' / ');

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
              {choice.label}
              {disabled && <span className="command-button__affinity command-button__affinity--resist">NO COST</span>}
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
                const hint = command.id === 'main_gun'
                  ? `主砲 ${selectedMainGunName}。予測DMG ${getPredictedDamageLabel('main_gun')}、残弾 ${state.mainAmmo}。`
                  : command.id === 'sub_gun'
                    ? `副砲 ${selectedSubGunName}。予測DMG ${getPredictedDamageLabel('sub_gun')} / ${selectedSubGunDescription}`
                    : command.id === 'se_harpoon'
                      ? `S-E ${selectedSEName}。予測DMG ${getPredictedDamageLabel('se_harpoon')} / ${selectedSEDescription}（残弾 ${state.seAmmo}）`
                      : command.id === 'contract'
                        ? (
                            contractEnabled
                              ? getDialogueLine('hint.contract.window_open', '契約窓が開いてる。今なら接続できる。')
                              : getDialogueLine('hint.contract.window_closed', '契約窓がまだ開いていない。TalkかS-Eを先に。')
                          )
                        : getMoeCommandGuide(command.id);
                setHoveredHint(hint);
              }}
              onMouseLeave={clearHoveredHint}
              onFocus={() => setHoveredHint(getMoeCommandGuide(command.id))}
              onBlur={clearHoveredHint}
              data-desc={
                command.id === 'main_gun'
                  ? `${selectedMainGunName}: PRED DMG ${getPredictedDamageLabel('main_gun')} / AMMO ${state.mainAmmo}`
                  : command.id === 'sub_gun'
                    ? `${selectedSubGunName}: PRED DMG ${getPredictedDamageLabel('sub_gun')} / ${selectedSubGunDescription}`
                    : command.id === 'se_harpoon'
                      ? `${selectedSEName}: PRED DMG ${getPredictedDamageLabel('se_harpoon')} / ${selectedSEDescription} / S-E AMMO ${state.seAmmo}`
                      : command.id === 'ram'
                        ? `Ram: PRED DMG ${getPredictedDamageLabel('ram')} / ARMOR -1`
                        : command.id === 'contract'
                          ? (contractEnabled ? 'Window Open' : 'No contract window')
                          : commandDescriptions[command.id].description
              }
            >
              <span className="command-button__label">{command.label}</span>
              {commandAffinityTagMap[command.id] && <span className={`command-button__affinity command-button__affinity--${commandAffinityTagMap[command.id]?.toLowerCase()}`}>{commandAffinityTagMap[command.id]}</span>}
            </button>)}
          </div>
        </div>)}
      </div>
      <div className="command-window">
        <div className="command-instant">Tap command to execute instantly</div>
      </div>
    </>}
  </>
);
