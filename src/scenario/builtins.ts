import type { ScenarioPack } from './scenarioTypes';

export const builtInScenarioPack: ScenarioPack = {
  version: 1,
  id: 'night-loop-builtins',
  title: 'Night Loop Built-in Scenario',
  encounters: [
    {
      id: 'pixie_shibuya_glow',
      name: 'Pixie // Shibuya Glow',
      intro: [
        'Shibuya crossing light glitches. A tiny silhouette dances between lane markers.',
      ],
      contract: {
        success: [
          'PIXIE LINK ESTABLISHED: lane lights now blink in your favor.',
        ],
      },
    },
    {
      id: 'roadside_phone',
      name: 'Roadside Phone',
      intro: [
        'A roadside payphone rings where no shoulder should exist.',
      ],
      contract: {
        success: [
          'AM 666.0 CHANNEL LOCKED: the child voice now counts your exits.',
        ],
      },
    },
  ],
  routeEvents: [
    {
      id: 'signal_tunnel_01',
      title: 'Signal Tunnel',
      body: 'A low-frequency tunnel amplifies NAVI echoes and weak signatures.',
      choices: [
        { id: 'analyze_trace', label: 'Analyze Trace', text: 'Trace the source and parse the memory fragment.' },
        { id: 'hold_lane', label: 'Keep Driving', text: 'Maintain speed and prioritize encounter tempo.' },
        { id: 'open_radio', label: 'Open Radio Channel', text: 'Open AM band and attempt handshake.' },
      ],
    },
  ],
  moeLines: {
    'prologue.open': [
      '午前0時。夜環、開いたよ。浅層でログを拾って帰ろう。',
    ],
    'approach.success': [
      '先に見つけた。どう入る？',
    ],
    'encounter.contact': [
      '接触。コマンド選択へ。',
    ],
  },
};
