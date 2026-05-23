export async function requestWebNotificationPermission(): Promise<boolean> {
  if (!('Notification' in window)) return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;
  const result = await Notification.requestPermission();
  return result === 'granted';
}

// Only updates localStorage — does NOT call requestPermission().
// Call requestWebNotificationPermission() first (from a user-gesture handler).
export async function updateReminders(enabled: boolean, timeStr: string): Promise<void> {
  try {
    if (!enabled) {
      localStorage.setItem('reminder_enabled', 'false');
      return;
    }
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    localStorage.setItem('reminder_enabled', 'true');
    localStorage.setItem('reminder_time', timeStr);
  } catch {}
}
