export function useInstallPrompt() {
  return { canInstall: false, canPrompt: false, isIos: false, isStandalone: false, promptInstall: async () => false, dismiss: () => {} };
}
