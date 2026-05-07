export type SignalChoice = {
  id: string;
  label: string;
  text?: string;
  choiceId: 'analyze_trace' | 'hold_lane' | 'open_radio';
  disabled: boolean;
};
