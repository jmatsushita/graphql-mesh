import { ImportFn } from '@graphql-mesh/types';
type LoadFromModuleExportExpressionOptions = {
    defaultExportName: string;
    cwd: string;
    importFn: ImportFn;
};
export declare function loadFromModuleExportExpression<T>(expression: T | string, options: LoadFromModuleExportExpressionOptions): Promise<T>;
export {};
