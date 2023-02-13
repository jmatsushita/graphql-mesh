import { MeshHandlerOptions, MeshHandler, MeshSource, YamlConfig, GetMeshSourcePayload } from '@graphql-mesh/types';
import { GraphQLSchema } from 'graphql';
export default class RAMLHandler implements MeshHandler {
    private name;
    private config;
    private schemaWithAnnotationsProxy;
    private bundleProxy;
    private baseDir;
    private logger;
    private fetchFn;
    private pubsub;
    private importFn;
    constructor({ name, config, baseDir, store, pubsub, logger, importFn, }: MeshHandlerOptions<YamlConfig.RAMLHandler>);
    getNonExecutableSchema(): Promise<GraphQLSchema>;
    getMeshSource({ fetchFn }: GetMeshSourcePayload): Promise<MeshSource>;
}
