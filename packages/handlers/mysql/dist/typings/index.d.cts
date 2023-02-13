import { MeshHandlerOptions, MeshHandler, MeshSource, YamlConfig } from '@graphql-mesh/types';
export default class MySQLHandler implements MeshHandler {
    private config;
    private baseDir;
    private pubsub;
    private store;
    private importFn;
    constructor({ name, config, baseDir, pubsub, store, importFn, logger, }: MeshHandlerOptions<YamlConfig.MySQLHandler>);
    private getCachedIntrospectionConnection;
    getMeshSource(): Promise<MeshSource>;
}
