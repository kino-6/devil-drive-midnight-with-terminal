import { useEffect, type MutableRefObject } from 'react';
import { resolveAssetUrl, type AssetManifest } from '../../assetManifest';
import type { GamePhase } from '../../game/types';

type UseAudioEffectsParams = {
  assetManifest: AssetManifest;
  audioUnlocked: boolean;
  setAudioUnlocked: (value: boolean) => void;
  logs: string[];
  gamePhase: GamePhase;
  pickSfxCueFromLog: (log: string, gamePhase: GamePhase) => string | undefined;
  bgmRef: MutableRefObject<HTMLAudioElement | null>;
  lastSfxAtRef: MutableRefObject<number>;
};

export const useAudioEffects = ({
  assetManifest,
  audioUnlocked,
  setAudioUnlocked,
  logs,
  gamePhase,
  pickSfxCueFromLog,
  bgmRef,
  lastSfxAtRef,
}: UseAudioEffectsParams) => {
  useEffect(() => {
    const unlock = () => setAudioUnlocked(true);
    window.addEventListener('pointerdown', unlock, { once: true });
    window.addEventListener('keydown', unlock, { once: true });
    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
  }, [setAudioUnlocked]);

  useEffect(() => {
    const bgmUrl = resolveAssetUrl(assetManifest.media.bgm);
    if (bgmRef.current) {
      bgmRef.current.pause();
      bgmRef.current = null;
    }
    if (!bgmUrl) return;
    const audio = new Audio(bgmUrl);
    audio.loop = true;
    audio.preload = 'auto';
    audio.volume = 0.35;
    bgmRef.current = audio;
    if (audioUnlocked) void audio.play().catch(() => undefined);
    return () => {
      audio.pause();
    };
  }, [assetManifest.media.bgm, audioUnlocked, bgmRef]);

  useEffect(() => {
    if (!audioUnlocked) return;
    const log = logs[logs.length - 1] ?? '';
    const cue = pickSfxCueFromLog(log, gamePhase);
    if (!cue) return;
    const sfxMap = assetManifest.media.sfx ?? {};
    const src = resolveAssetUrl(sfxMap[cue]);
    if (!src) return;
    const now = Date.now();
    if (now - lastSfxAtRef.current < 80) return;
    lastSfxAtRef.current = now;
    const audio = new Audio(src);
    audio.volume = 0.45;
    void audio.play().catch(() => undefined);
  }, [logs, gamePhase, assetManifest.media.sfx, audioUnlocked, pickSfxCueFromLog, lastSfxAtRef]);
};
