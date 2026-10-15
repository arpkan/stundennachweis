export async function shareAsync(
  url: string,
  options?: { mimeType?: string; dialogTitle?: string; UTI?: string }
): Promise<void> {
  if (navigator.share) {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const fileName = url.split('/').pop() || 'file';
      const file = new File([blob], fileName, { type: options?.mimeType || blob.type });
      await navigator.share({ files: [file], title: options?.dialogTitle });
      return;
    } catch (e) {
      if ((e as Error).name === 'AbortError') return;
    }
  }
  const a = document.createElement('a');
  a.href = url;
  a.download = url.split('/').pop() || 'download';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

/** True only when the browser can share files (not just links), i.e. shareAsync won't fall back to a download. */
export async function isAvailableAsync(): Promise<boolean> {
  if (typeof navigator === 'undefined' || !navigator.share || !navigator.canShare) return false;
  try {
    return navigator.canShare({ files: [new File([], 'bericht.pdf', { type: 'application/pdf' })] });
  } catch {
    return false;
  }
}
