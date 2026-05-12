import {
  getConversationLine,
  getConversationLineFromPool,
  getConversationLineWithVars,
  getConversationLineWithVarsFromPool,
} from '../conversationConfig';
import { getConversationProfile } from './conversationCatalog';
import { UNKNOWN_SIGN_LABEL } from './enemyReveal';
import type {
  ActiveConversation,
  ConversationChoice,
  Devil,
  State,
  Temperament,
} from './types';
import type {
  ResourceCost,
  TalkAttitude,
  TalkMood,
  TalkPersona,
} from './talkTypes';

type TalkBuildInput = {
  target: Devil;
  state: Pick<State, 'fuel' | 'armor' | 'signal' | 'mainAmmo' | 'seAmmo' | 'salvageCredits'>;
  analyzed: boolean;
};

const PERSONAS: TalkPersona[] = ['cautious', 'greedy', 'playful', 'solemn', 'volatile', 'needy'];
const ALL_ATTITUDES: TalkAttitude[] = ['offer', 'listen', 'logic', 'flatter', 'challenge', 'threaten', 'joke'];

const hashSeed = (seed: string): number => {
  let hash = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    hash ^= seed.charCodeAt(i);
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }
  return Math.abs(hash >>> 0);
};

const asTitle = (attitude: TalkAttitude, seed: string) =>
  getConversationLineFromPool(`talk.choice.${attitude}.label`, getConversationLine(`talk.choice.${attitude}`, attitude.toUpperCase()), seed);

const getResourceValue = (
  state: Pick<State, 'fuel' | 'armor' | 'signal' | 'mainAmmo' | 'seAmmo' | 'salvageCredits'>,
  resource: keyof ResourceCost,
) => {
  if (resource === 'fuel') return state.fuel;
  if (resource === 'armor') return state.armor;
  if (resource === 'signal') return state.signal;
  if (resource === 'mainAmmo') return state.mainAmmo;
  if (resource === 'seAmmo') return state.seAmmo;
  return state.salvageCredits;
};

const attitudeAffinity: Partial<Record<TalkAttitude, ConversationChoice['affinityType']>> = {
  offer: 'talk',
  listen: 'talk',
  logic: 'signal',
  flatter: 'talk',
  challenge: 'impact',
  threaten: 'ballistic',
  joke: 'talk',
  pay: 'talk',
  bargain: 'signal',
  refuse: 'talk',
};

const attitudeHints: Partial<Record<TalkAttitude, string>> = {
  offer: 'talk.hint.offer',
  listen: 'talk.hint.listen',
  logic: 'talk.hint.logic',
  flatter: 'talk.hint.flatter',
  challenge: 'talk.hint.challenge',
  threaten: 'talk.hint.threaten',
  joke: 'talk.hint.joke',
  pay: 'talk.hint.pay',
  bargain: 'talk.hint.bargain',
  refuse: 'talk.hint.refuse',
};

const personaBias: Record<TalkPersona, Partial<Record<TalkAttitude, number>>> = {
  cautious: { listen: 0.1, logic: 0.1, threaten: -0.1, joke: -0.06 },
  greedy: { offer: 0.08, pay: 0.12, bargain: 0.1, refuse: -0.06 },
  playful: { joke: 0.12, challenge: 0.06, logic: -0.04 },
  solemn: { logic: 0.1, flatter: 0.06, joke: -0.12 },
  volatile: { challenge: 0.1, threaten: 0.1, refuse: 0.04 },
  needy: { listen: 0.14, flatter: 0.08, refuse: -0.08 },
};

const moodBias: Record<TalkMood, Partial<Record<TalkAttitude, number>>> = {
  calm: { listen: 0.08, logic: 0.06 },
  curious: { joke: 0.1, logic: 0.08, offer: 0.04 },
  annoyed: { challenge: 0.06, threaten: 0.05, flatter: -0.05 },
  desperate: { pay: 0.12, offer: 0.08, refuse: -0.1 },
  aggressive: { threaten: 0.12, challenge: 0.1, listen: -0.08 },
};

const temperamentBias: Record<Temperament, Partial<Record<TalkAttitude, number>>> = {
  hungry: { offer: 0.14, listen: 0.06, challenge: -0.06, pay: 0.16, bargain: 0.08, refuse: -0.1, threaten: -0.03 },
  machine: { logic: 0.17, listen: 0.02, joke: -0.12, pay: 0.14, bargain: 0.09, refuse: -0.08 },
  lonely: { listen: 0.18, flatter: 0.08, offer: 0.05, threaten: -0.2, refuse: -0.12 },
  proud: { flatter: 0.15, challenge: 0.11, logic: 0.03, threaten: 0.04, refuse: -0.09 },
  curious: { joke: 0.14, logic: 0.1, offer: 0.05, bargain: 0.1, refuse: -0.06 },
  hostile: { threaten: 0.12, challenge: 0.09, logic: -0.05, refuse: -0.08, pay: -0.05 },
};

const demandCandidatesByTemperament: Record<Temperament, Array<keyof ResourceCost>> = {
  hungry: ['fuel', 'salvageCredits', 'signal'],
  machine: ['signal', 'seAmmo', 'mainAmmo'],
  lonely: ['signal', 'fuel', 'salvageCredits'],
  proud: ['mainAmmo', 'signal', 'fuel'],
  curious: ['signal', 'mainAmmo', 'seAmmo'],
  hostile: ['armor', 'fuel', 'mainAmmo'],
};

const prefersDemand = (temperament: Temperament) =>
  temperament === 'hungry'
  || temperament === 'machine'
  || temperament === 'proud'
  || temperament === 'hostile';

const maxByRecord = <T extends string>(
  keys: T[],
  scoreFor: (key: T) => number,
): T => {
  let best = keys[0];
  let bestScore = Number.NEGATIVE_INFINITY;
  for (const key of keys) {
    const score = scoreFor(key);
    if (score > bestScore) {
      best = key;
      bestScore = score;
    }
  }
  return best;
};

const buildChoiceSeed = (baseSeed: string, attitude: TalkAttitude) => `${baseSeed}:choice:${attitude}`;

const buildMoodHint = (targetName: string, mood: TalkMood): string =>
  getConversationLineWithVarsFromPool(
    `talk.hint.mood.${mood}`,
    { target: targetName },
    getConversationLineWithVars('talk.hint.mood.default', { target: targetName, mood }, `Mood: ${mood}`),
    `${targetName}:${mood}`,
  );

export const assignTalkPersona = (
  profile: Devil['profile'],
  enemyId: string,
  stage = 1,
): TalkPersona => {
  const index = hashSeed(`${profile}:${enemyId}:${stage}`) % PERSONAS.length;
  return PERSONAS[index] ?? 'cautious';
};

export const deriveTalkMood = (
  target: Devil,
  analyzed: boolean,
): TalkMood => {
  const hpRatio = target.maxHp > 0 ? target.hp / target.maxHp : 1;
  if (target.pressure >= 3) return 'aggressive';
  if (hpRatio <= 0.35) return 'desperate';
  if (target.pressure >= 2 || (target.maxHp - target.hp) >= 2) return 'annoyed';
  if (target.contractWindow || target.trust + target.interest >= 3) return 'curious';
  if (analyzed && target.temperament === 'machine') return 'calm';
  return 'calm';
};

const getAttitudeScore = (
  target: Devil,
  persona: TalkPersona,
  mood: TalkMood,
  analyzed: boolean,
  attitude: TalkAttitude,
) => {
  const base = temperamentBias[target.temperament]?.[attitude] ?? 0;
  const p = personaBias[persona]?.[attitude] ?? 0;
  const m = moodBias[mood]?.[attitude] ?? 0;
  const analyzedBonus = analyzed ? 0.04 : 0;
  return base + p + m + analyzedBonus;
};

const chooseDemandResource = (target: Devil, state: TalkBuildInput['state']): keyof ResourceCost => {
  const candidates = demandCandidatesByTemperament[target.temperament];
  const affordable = candidates.find((resource) => getResourceValue(state, resource) >= 1);
  return affordable ?? candidates[0] ?? 'signal';
};

const costToLabel = (cost: ResourceCost | undefined): string | undefined => {
  if (!cost) return undefined;
  const pairs: Array<[keyof ResourceCost, number | undefined]> = [
    ['fuel', cost.fuel],
    ['armor', cost.armor],
    ['signal', cost.signal],
    ['mainAmmo', cost.mainAmmo],
    ['seAmmo', cost.seAmmo],
    ['salvageCredits', cost.salvageCredits],
  ];
  const chunks = pairs
    .filter(([, amount]) => !!amount && amount > 0)
    .map(([resource, amount]) => {
      const label = getConversationLine(`talk.resource.${resource}`, resource.toUpperCase());
      return `${label} -${amount}`;
    });
  return chunks.length > 0 ? chunks.join(' / ') : undefined;
};

const makeChoice = (
  target: Devil,
  targetName: string,
  attitude: TalkAttitude,
  analyzed: boolean,
  persona: TalkPersona,
  mood: TalkMood,
  baseSeed: string,
  cost?: ResourceCost,
): ConversationChoice => {
  const choiceSeed = buildChoiceSeed(baseSeed, attitude);
  const attitudeLabel = asTitle(attitude, choiceSeed);
  const costLabel = costToLabel(cost);
  const hintKey = analyzed ? attitudeHints[attitude] : undefined;
  const score = getAttitudeScore(target, persona, mood, analyzed, attitude);

  const playerLine = getConversationLineWithVarsFromPool(
    `talk.player_line.${attitude}`,
    { target: targetName, attitude: attitudeLabel },
    getConversationLineWithVars('talk.player_line.default', { target: targetName, attitude: attitudeLabel }, attitudeLabel),
    choiceSeed,
  );
  const successBase = getConversationLineWithVarsFromPool(
    `talk.result.good.${target.temperament}.${mood}`,
    { target: targetName, attitude: attitudeLabel },
    getConversationLineWithVarsFromPool(
      `talk.result.good.${target.temperament}`,
      { target: targetName, attitude: attitudeLabel },
      getConversationLineWithVarsFromPool(
        'talk.result.good',
        { target: targetName, attitude: attitudeLabel },
        `${targetName}が反応した。`,
        choiceSeed,
      ),
      choiceSeed,
    ),
    choiceSeed,
  );
  const failBase = getConversationLineWithVarsFromPool(
    `talk.result.bad.${target.temperament}.${mood}`,
    { target: targetName, attitude: attitudeLabel },
    getConversationLineWithVarsFromPool(
      `talk.result.bad.${target.temperament}`,
      { target: targetName, attitude: attitudeLabel },
      getConversationLineWithVarsFromPool(
        'talk.result.bad',
        { target: targetName, attitude: attitudeLabel },
        `${targetName}の反応は悪い。`,
        choiceSeed,
      ),
      choiceSeed,
    ),
    choiceSeed,
  );

  const successText = costLabel
    ? `${successBase} ${getConversationLineWithVarsFromPool('talk.result.paid', { resource: costLabel }, '代価は受理された。', choiceSeed)}`
    : successBase;
  const failText = attitude === 'threaten'
    ? getConversationLineFromPool('talk.result.threaten_fail', failBase, choiceSeed)
    : attitude === 'bargain'
      ? getConversationLineFromPool('talk.result.bargain_fail', failBase, choiceSeed)
      : attitude === 'refuse'
        ? getConversationLineFromPool('talk.result.refused', failBase, choiceSeed)
        : failBase;

  const effectsOnSuccess: ConversationChoice['effectsOnSuccess'] = [];
  const effectsOnFail: ConversationChoice['effectsOnFail'] = [];

  if (attitude === 'offer' || attitude === 'listen' || attitude === 'logic' || attitude === 'flatter' || attitude === 'joke') {
    effectsOnSuccess.push({ type: 'trust', amount: 1 }, { type: 'interest', amount: 1 });
    effectsOnFail.push({ type: 'pressure', amount: 1 });
  }
  if (attitude === 'challenge') {
    effectsOnSuccess.push({ type: 'interest', amount: 2 }, { type: 'pressure', amount: 1 });
    effectsOnFail.push({ type: 'pressure', amount: 2 });
  }
  if (attitude === 'threaten') {
    effectsOnSuccess.push({ type: 'pressure', amount: 1 }, { type: 'openContractWindow' });
    effectsOnFail.push({ type: 'pressure', amount: 2 }, { type: 'cancelNextIntent' });
  }
  if (attitude === 'pay') {
    effectsOnSuccess.push({ type: 'trust', amount: 1 }, { type: 'interest', amount: 2 }, { type: 'openContractWindow' });
    effectsOnFail.push({ type: 'pressure', amount: 1 });
  }
  if (attitude === 'bargain') {
    effectsOnSuccess.push({ type: 'trust', amount: 1 }, { type: 'interest', amount: 1 });
    effectsOnFail.push({ type: 'pressure', amount: 1 });
  }
  if (attitude === 'refuse') {
    effectsOnSuccess.push({ type: 'pressure', amount: 1 });
    effectsOnFail.push({ type: 'pressure', amount: 2 }, { type: 'cancelNextIntent' });
  }

  return {
    id: `talk_${attitude}`,
    attitude,
    label: attitudeLabel,
    playerLine,
    successText,
    failText,
    preferredTemperaments: score > 0.12 ? [target.temperament] : undefined,
    affinityType: attitudeAffinity[attitude],
    hintKey,
    successBias: score,
    cost,
    effectsOnSuccess,
    effectsOnFail,
  };
};

const buildAttitudeChoices = (
  target: Devil,
  targetName: string,
  persona: TalkPersona,
  mood: TalkMood,
  analyzed: boolean,
  baseSeed: string,
): ConversationChoice[] => {
  const scoreFor = (attitude: TalkAttitude) => getAttitudeScore(target, persona, mood, analyzed, attitude);
  const preferred = maxByRecord(ALL_ATTITUDES, scoreFor);
  const neutralPool: TalkAttitude[] = ['listen', 'logic', 'offer', 'flatter'];
  const riskyPool: TalkAttitude[] = ['challenge', 'threaten', 'joke', 'refuse'];
  const neutral = maxByRecord(
    neutralPool.filter((attitude) => attitude !== preferred),
    scoreFor,
  );
  const risky = maxByRecord(
    riskyPool.filter((attitude) => attitude !== preferred && attitude !== neutral),
    scoreFor,
  );

  const ordered = [preferred, neutral, risky];
  return ordered.map((attitude, idx) =>
    makeChoice(target, targetName, attitude, analyzed, persona, mood, `${baseSeed}:attitude:${idx}`));
};

const buildDemandChoices = (
  target: Devil,
  targetName: string,
  persona: TalkPersona,
  mood: TalkMood,
  analyzed: boolean,
  baseSeed: string,
  resource: keyof ResourceCost,
): ConversationChoice[] => {
  const amount = 1;
  const pay = makeChoice(target, targetName, 'pay', analyzed, persona, mood, `${baseSeed}:pay`, { [resource]: amount });
  pay.demand = { resource, amount };
  const bargain = makeChoice(target, targetName, 'bargain', analyzed, persona, mood, `${baseSeed}:bargain`);
  bargain.demand = { resource, amount };
  const thirdAttitude: TalkAttitude = (target.temperament === 'hostile' || target.temperament === 'proud' || mood === 'aggressive')
    ? 'threaten'
    : 'refuse';
  const third = makeChoice(target, targetName, thirdAttitude, analyzed, persona, mood, `${baseSeed}:${thirdAttitude}`);
  third.demand = { resource, amount };
  return [pay, bargain, third];
};

export const canPayConversationChoiceCost = (
  choice: Pick<ConversationChoice, 'cost'>,
  state: Pick<State, 'fuel' | 'armor' | 'signal' | 'mainAmmo' | 'seAmmo' | 'salvageCredits'>,
): boolean => {
  const cost = choice.cost;
  if (!cost) return true;
  if ((cost.fuel ?? 0) > state.fuel) return false;
  if ((cost.armor ?? 0) > state.armor) return false;
  if ((cost.signal ?? 0) > state.signal) return false;
  if ((cost.mainAmmo ?? 0) > state.mainAmmo) return false;
  if ((cost.seAmmo ?? 0) > state.seAmmo) return false;
  if ((cost.salvageCredits ?? 0) > state.salvageCredits) return false;
  return true;
};

export const buildTalkConversation = ({ target, state, analyzed }: TalkBuildInput): ActiveConversation => {
  const persona = target.talkPersona ?? assignTalkPersona(target.profile, target.id);
  const mood = deriveTalkMood(target, analyzed);
  const targetName = analyzed ? target.name : UNKNOWN_SIGN_LABEL;
  if (target.profile === 'pixie_shibuya_glow' || target.profile === 'road_reaper' || target.profile === 'toll_gate_saint') {
    const profile = getConversationProfile(target.profile);
    return {
      enemyId: target.id,
      enemyProfile: target.profile,
      introLine: profile.introLine,
      choices: profile.choices.slice(0, 3),
      mood,
      persona,
      seed: `${target.id}:${persona}:${mood}:pixie-scripted`,
    };
  }
  const seed = `${target.id}:${persona}:${mood}:${target.trust}:${target.interest}:${target.pressure}:${target.hp}`;
  const demandNoise = (hashSeed(`${seed}:demand`) % 100) / 100;
  const demandLike = prefersDemand(target.temperament) && (mood === 'aggressive' || mood === 'desperate' || demandNoise < 0.48);

  const introLine = demandLike
    ? (() => {
      const resource = chooseDemandResource(target, state);
      const amount = 1;
      const resourceName = getConversationLine(`talk.resource.${resource}`, resource.toUpperCase());
      return getConversationLineWithVarsFromPool(
        `talk.demand.prompt.${target.temperament}.${persona}.${mood}`,
        { target: targetName, resource: resourceName, amount },
        getConversationLineWithVarsFromPool(
          `talk.demand.prompt.${target.temperament}.${mood}`,
          { target: targetName, resource: resourceName, amount },
          getConversationLineWithVarsFromPool(
            `talk.demand.prompt.${target.temperament}`,
            { target: targetName, resource: resourceName, amount },
            getConversationLineWithVarsFromPool(
              'talk.demand.prompt.default',
              { target: targetName, resource: resourceName, amount },
              '代価を求める反応。',
              seed,
            ),
            seed,
          ),
          seed,
        ),
        seed,
      );
    })()
    : getConversationLineWithVarsFromPool(
      `talk.prompt.${target.temperament}.${persona}.${mood}`,
      { target: targetName },
      getConversationLineWithVarsFromPool(
        `talk.prompt.${target.temperament}.${mood}`,
        { target: targetName },
        getConversationLineWithVarsFromPool(
          `talk.prompt.${target.temperament}`,
          { target: targetName },
          getConversationLineWithVarsFromPool('talk.prompt.default', { target: targetName }, '反応を読む。短く返す。', seed),
          seed,
        ),
        seed,
      ),
      seed,
    );

  const choices = demandLike
    ? buildDemandChoices(target, targetName, persona, mood, analyzed, seed, chooseDemandResource(target, state))
    : buildAttitudeChoices(target, targetName, persona, mood, analyzed, seed);

  const moodHint = analyzed ? buildMoodHint(targetName, mood) : undefined;
  const finalIntro = moodHint ? `${introLine} ${moodHint}` : introLine;

  return {
    enemyId: target.id,
    enemyProfile: target.profile,
    introLine: finalIntro,
    choices: choices.slice(0, 3),
    mood,
    persona,
    seed,
    demand: choices.find((choice) => choice.demand)?.demand,
  };
};
