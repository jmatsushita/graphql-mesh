import { findAndParseConfig } from './config.cjs';
import { generateTsArtifacts } from './commands/ts-artifacts.cjs';
import { serveMesh } from './commands/serve/serve.cjs';
import { handleFatalError } from './handleFatalError.cjs';
export { generateTsArtifacts, serveMesh, findAndParseConfig, handleFatalError };
export interface GraphQLMeshCLIParams {
    commandName: string;
    initialLoggerPrefix: string;
    configName: string;
    artifactsDir: string;
    serveMessage: string;
    playgroundTitle: string;
    builtMeshFactoryName: string;
    builtMeshSDKFactoryName: string;
    devServerCommand: string;
    prodServerCommand: string;
    buildArtifactsCommand: string;
    sourceServerCommand: string;
    validateCommand: string;
    additionalPackagePrefixes: string[];
}
export declare const DEFAULT_CLI_PARAMS: GraphQLMeshCLIParams;
export declare function graphqlMesh(cliParams?: GraphQLMeshCLIParams, args?: string[], cwdPath?: string): Promise<{
    [x: string]: unknown;
    r: Promise<any[]>;
    dir: void;
    _: (string | number)[];
    $0: string;
} | {
    [x: string]: unknown;
    r: Promise<any[]>;
    dir: void;
    _: (string | number)[];
    $0: string;
}>;
