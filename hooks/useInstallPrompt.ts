export function useInstallPrompt() {
  return { canInstall: false, isIos: false, promptInstall: async () => false, dismiss: () => {} };
}
