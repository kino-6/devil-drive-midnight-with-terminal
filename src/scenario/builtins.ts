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
      title: '信号トンネル // AM 666.0',
      body: '低周波のトンネルでAM帯が揺らぎ、NAVIに記憶残響が混入する。',
      choices: [
        { id: 'analyze_trace', label: '残響を解析する', text: '干渉源を解析して記憶断片の輪郭を拾う。' },
        { id: 'hold_lane', label: '車線維持で抜ける', text: '速度を保って次接敵を優先する。' },
        { id: 'open_radio', label: 'ラジオ回線を開く', text: 'AM帯を開いて断片音声との交信を試す。' },
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
