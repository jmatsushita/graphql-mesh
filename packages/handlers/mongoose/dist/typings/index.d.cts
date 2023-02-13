import { MeshHandlerOptions, MeshHandler, MeshSource, YamlConfig } from '@graphql-mesh/types';
export default class MongooseHandler implements MeshHandler {
    private config;
    private baseDir;
    private pubsub;
    private importFn;
    constructor({ config, baseDir, pubsub, importFn, }: MeshHandlerOptions<YamlConfig.MongooseHandler>);
    getMeshSource(): Promise<MeshSource>;
}
