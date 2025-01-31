import type { GetMeshOptions } from '@graphql-mesh/runtime';
import { MeshStore } from '@graphql-mesh/store';
import { ImportFn, YamlConfig } from '@graphql-mesh/types';
import { Source } from '@graphql-tools/utils';
export type ConfigProcessOptions = {
    dir?: string;
    importFn?: ImportFn;
    store?: MeshStore;
    ignoreAdditionalResolvers?: boolean;
    configName?: string;
    artifactsDir?: string;
    additionalPackagePrefixes?: string[];
    generateCode?: boolean;
    initialLoggerPrefix?: string;
    throwOnInvalidConfig?: boolean;
};
export type ProcessedConfig = GetMeshOptions & {
    config: YamlConfig.Config;
    documents: Source[];
    store: MeshStore;
    importCodes: Set<string>;
    codes: Set<string>;
};
export declare function processConfig(config: YamlConfig.Config, options?: ConfigProcessOptions): Promise<ProcessedConfig>;
