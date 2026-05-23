export async function getDocumentAsync(options?: {
  type?: string | string[];
  copyToCacheDirectory?: boolean;
}): Promise<{
  canceled: boolean;
  assets?: Array<{ uri: string; name: string }>;
}> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = Array.isArray(options?.type) ? options.type.join(',') : (options?.type || '*/*');
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) {
        resolve({ canceled: true });
        return;
      }
      const uri = URL.createObjectURL(file);
      resolve({
        canceled: false,
        assets: [{ uri, name: file.name }],
      });
    };
    input.oncancel = () => resolve({ canceled: true });
    input.click();
  });
}
