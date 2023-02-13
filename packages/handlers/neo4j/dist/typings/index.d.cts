import { Driver } from 'neo4j-driver';
import { YamlConfig, MeshHandler, MeshHandlerOptions, ImportFn, MeshFetch, GetMeshSourcePayload, MeshSource } from '@graphql-mesh/types';
export default class Neo4JHandler implements MeshHandler {
    private config;
    private baseDir;
    private pubsub;
    private typeDefs;
    private logger;
    fetchFn: MeshFetch;
    importFn: ImportFn;
    constructor({ config, baseDir, pubsub, store, logger, importFn, }: MeshHandlerOptions<YamlConfig.Neo4JHandler>);
    getCachedTypeDefs(driver: Driver): Promise<string>;
    getMeshSource({ fetchFn }: GetMeshSourcePayload): Promise<MeshSource>;
}
