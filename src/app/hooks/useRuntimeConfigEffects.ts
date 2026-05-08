import { useEffect } from 'react';
import { type AssetManifest, loadAssetManifest } from '../../assetManifest';
import { defaultBalanceConfig, type BalanceConfig, loadBalanceConfig } from '../../balanceConfig';
import { loadConversationConfig } from '../../conversationConfig';
import { loadDevilConfig } from '../../devilConfig';
import { getDialogueConfig, loadDialogueConfig } from '../../dialogueConfig';
import { loadProgressionConfig } from '../../progressionConfig';
import { loadScenarioPack } from '../../scenario/scenarioLoader';

type UseRuntimeConfigEffectsParams = {
  setAssetManifest: (value: AssetManifest) => void;
  setAssetManifestLoaded: (value: boolean) => void;
  setBalanceConfig: (value: BalanceConfig) => void;
  setAutoplayRuns: (value: number | ((prev: number) => number)) => void;
  setDevilConfigVersion: (value: string) => void;
  setDialogueConfigVersion: (value: string) => void;
  cssVars?: Record<string, string>;
};

export const useRuntimeConfigEffects = ({
  setAssetManifest,
  setAssetManifestLoaded,
  setBalanceConfig,
  setAutoplayRuns,
  setDevilConfigVersion,
  setDialogueConfigVersion,
  cssVars,
}: UseRuntimeConfigEffectsParams) => {
  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      const loaded = await loadAssetManifest();
      if (!cancelled) {
        setAssetManifest(loaded);
        setAssetManifestLoaded(true);
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [setAssetManifest, setAssetManifestLoaded]);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      const loaded = await loadBalanceConfig();
      if (!cancelled) {
        setBalanceConfig(loaded);
        setAutoplayRuns((prev) => (prev === defaultBalanceConfig.autoplay.defaultRuns ? loaded.autoplay.defaultRuns : prev));
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [setAutoplayRuns, setBalanceConfig]);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      const loaded = await loadDevilConfig();
      if (!cancelled) setDevilConfigVersion(loaded.version);
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [setDevilConfigVersion]);

  useEffect(() => {
    void loadScenarioPack();
  }, []);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      const loaded = await loadDialogueConfig();
      if (!cancelled) setDialogueConfigVersion(loaded.version);
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [setDialogueConfigVersion]);

  useEffect(() => {
    void loadConversationConfig();
  }, []);

  useEffect(() => {
    void loadProgressionConfig();
  }, []);

  useEffect(() => {
    const runtimeCssVars = cssVars ?? {};
    const root = document.documentElement;
    const touched: string[] = [];
    for (const [rawKey, value] of Object.entries(runtimeCssVars)) {
      const key = rawKey.startsWith('--') ? rawKey : `--${rawKey}`;
      root.style.setProperty(key, value);
      touched.push(key);
    }
    return () => {
      for (const key of touched) root.style.removeProperty(key);
    };
  }, [cssVars]);

  useEffect(() => {
    setDialogueConfigVersion(getDialogueConfig().version);
  }, [setDialogueConfigVersion]);
};
