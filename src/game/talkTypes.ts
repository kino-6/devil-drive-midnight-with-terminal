export type TalkAttitude =
  | 'offer'
  | 'listen'
  | 'logic'
  | 'flatter'
  | 'challenge'
  | 'threaten'
  | 'joke'
  | 'pay'
  | 'bargain'
  | 'refuse'
  | 'counteroffer';

export type TalkPersona =
  | 'cautious'
  | 'greedy'
  | 'playful'
  | 'solemn'
  | 'volatile'
  | 'needy';

export type TalkMood =
  | 'calm'
  | 'curious'
  | 'annoyed'
  | 'desperate'
  | 'aggressive';

export type ResourceCost = {
  fuel?: number;
  armor?: number;
  signal?: number;
  mainAmmo?: number;
  seAmmo?: number;
  salvageCredits?: number;
};

export type ConversationDemand = {
  resource: keyof ResourceCost;
  amount: number;
  reasonKey?: string;
};
