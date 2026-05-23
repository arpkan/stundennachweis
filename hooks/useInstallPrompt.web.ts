import { useState, useEffect } from 'react';
import { Platform } from 'react-native';

type InstallState = {
  canInstall: boolean;      // banner: event fired + not dismissed
  canPrompt: boolean;       // can call promptInstall() right now
  isIos: boolean;
  isStandalone: boolean;    // already running as installed PWA
  promptInstall: () => Promise<boolean>;
  dismiss: () => void;
};

const DISMISSED_KEY = 'install-banner-dismissed';

export function useInstallPrompt(): InstallState {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [dismissed, setDismissed] = useState(() => {
    if (Platform.OS !== 'web') return true;
    try { return localStorage.getItem(DISMISSED_KEY) === 'true'; } catch { return false; }
  });
  const [isStandalone, setIsStandalone] = useState(false);

  const isIos = Platform.OS === 'web' && typeof navigator !== 'undefined' &&
    /iPad|iPhone|iPod/.test(navigator.userAgent) && !((window as any).MSStream);

  useEffect(() => {
    if (Platform.OS !== 'web') return;

    setIsStandalone(
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true,
    );

    // Pick up event captured by the early inline script before React mounted
    const early = (window as any).__pwaInstallPrompt;
    if (early) {
      setDeferredPrompt(early);
      delete (window as any).__pwaInstallPrompt;
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler);

    const installed = () => { setDeferredPrompt(null); setIsStandalone(true); };
    window.addEventListener('appinstalled', installed);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
      window.removeEventListener('appinstalled', installed);
    };
  }, []);

  const canPrompt = !!deferredPrompt;
  const canInstall = !dismissed && !isStandalone;

  const promptInstall = async (): Promise<boolean> => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const result = await deferredPrompt.userChoice;
      setDeferredPrompt(null);
      return result.outcome === 'accepted';
    }
    return false;
  };

  const dismiss = () => {
    setDismissed(true);
    try { localStorage.setItem(DISMISSED_KEY, 'true'); } catch {}
  };

  return { canInstall, canPrompt, isIos, isStandalone, promptInstall, dismiss };
}

export type { InstallState };
