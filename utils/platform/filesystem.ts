import * as NativeFS from 'expo-file-system/legacy';
export { EncodingType } from 'expo-file-system/legacy';
export const FileSystem = {
  documentDirectory: NativeFS.documentDirectory,
  async writeAsStringAsync(path: string, content: string, options?: any): Promise<string> {
    await NativeFS.writeAsStringAsync(path, content, options);
    return path;
  },
  readAsStringAsync: NativeFS.readAsStringAsync,
};
