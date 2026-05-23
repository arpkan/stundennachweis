export const EncodingType = { UTF8: 'utf8', Base64: 'base64' } as const;
export const FileSystem = {
  documentDirectory: '',
  async writeAsStringAsync(_path: string, content: string, options?: any): Promise<string> {
    if (options?.encoding === 'base64') {
      const binary = atob(content);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      return URL.createObjectURL(new Blob([bytes]));
    }
    return URL.createObjectURL(new Blob([content]));
  },
  async readAsStringAsync(uri: string): Promise<string> {
    const res = await fetch(uri);
    return res.text();
  },
};
