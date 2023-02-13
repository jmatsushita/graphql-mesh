import { MeshHandlerOptions, MeshHandler, YamlConfig, GetMeshSourcePayload, MeshSource } from '@graphql-mesh/types';
import { GraphQLSchema } from 'graphql';
export default class JsonSchemaHandler implements MeshHandler {
    private name;
    private config;
    private schemaWithAnnotationsProxy;
    private baseDir;
    private logger;
    private fetchFn;
    private pubsub;
    private importFn;
    constructor({ name, config, baseDir, store, pubsub, logger, importFn, }: MeshHandlerOptions<YamlConfig.Handler['jsonSchema']>);
    getNonExecutableSchema(): Promise<GraphQLSchema>;
    getMeshSource({ fetchFn }: GetMeshSourcePayload): Promise<MeshSource>;
}
