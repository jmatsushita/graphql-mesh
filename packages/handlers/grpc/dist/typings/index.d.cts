import './patchLongJs.cjs';
import { MeshHandlerOptions, Logger, MeshHandler, YamlConfig } from '@graphql-mesh/types';
import { ChannelCredentials, loadPackageDefinition } from '@grpc/grpc-js';
import { AnyNestedObject } from 'protobufjs';
import protobufjs from 'protobufjs';
type RootJsonEntry = {
    name: string;
    rootJson: protobufjs.INamespace;
};
export default class GrpcHandler implements MeshHandler {
    private config;
    private baseDir;
    private rootJsonEntries;
    private logger;
    constructor({ config, baseDir, store, logger }: MeshHandlerOptions<YamlConfig.GrpcHandler>);
    processReflection(creds: ChannelCredentials): Promise<Promise<protobufjs.Root>[]>;
    processDescriptorFile(): Promise<protobufjs.Root>;
    processProtoFile(): Promise<protobufjs.Root>;
    getCachedDescriptorSets(creds: ChannelCredentials): Promise<RootJsonEntry[]>;
    getCredentials(): Promise<ChannelCredentials>;
    walkToFindTypePath(rootJson: protobufjs.INamespace, pathWithName: string[], baseTypePath: string[]): string[];
    visit({ nested, name, currentPath, rootJson, creds, grpcObject, rootLogger: logger, }: {
        nested: AnyNestedObject;
        name: string;
        currentPath: string[];
        rootJson: protobufjs.INamespace;
        creds: ChannelCredentials;
        grpcObject: ReturnType<typeof loadPackageDefinition>;
        rootLogger: Logger;
    }): void;
    private schemaComposer;
    getMeshSource(): Promise<{
        schema: import("graphql").GraphQLSchema;
    }>;
}
export {};
