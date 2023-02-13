import { MeshHandlerOptions, MeshHandler, MeshSource, YamlConfig } from '@graphql-mesh/types';
export default class PostGraphileHandler implements MeshHandler {
    private name;
    private config;
    private baseDir;
    private pubsub;
    private pgCache;
    private logger;
    private importFn;
    constructor({ name, config, baseDir, pubsub, store, logger, importFn, }: MeshHandlerOptions<YamlConfig.PostGraphileHandler>);
    getMeshSource(): Promise<MeshSource>;
}
