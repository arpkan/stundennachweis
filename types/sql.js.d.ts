declare module 'sql.js' {
  type SqlJsStatic = {
    Database: new (data?: ArrayLike<number>) => Database;
  };

  type Database = {
    run(sql: string, params?: (string | number | null | Uint8Array)[]): Database;
    exec(sql: string): { columns: string[]; values: unknown[][] }[];
    prepare(sql: string): Statement;
    getRowsModified(): number;
    export(): Uint8Array;
    close(): void;
  };

  type Statement = {
    bind(params: (string | number | null | Uint8Array)[]): boolean;
    step(): boolean;
    getAsObject(): Record<string, unknown>;
    free(): void;
  };

  export type { Database, Statement, SqlJsStatic };
  export default function initSqlJs(config?: {
    locateFile?: (file: string) => string;
  }): Promise<SqlJsStatic>;
}

declare module 'sql.js/dist/sql-wasm-browser' {
  export type { Database, Statement, SqlJsStatic } from 'sql.js';
  export { default } from 'sql.js';
}
