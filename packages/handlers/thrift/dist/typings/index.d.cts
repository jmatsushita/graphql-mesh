import { MeshHandlerOptions, MeshHandler, YamlConfig, GetMeshSourcePayload, MeshSource } from '@graphql-mesh/types';
export default class ThriftHandler implements MeshHandler {
    private config;
    private baseDir;
    private idl;
    private fetchFn;
    private importFn;
    private logger;
    constructor({ config, baseDir, store, importFn, logger, }: MeshHandlerOptions<YamlConfig.ThriftHandler>);
    getMeshSource({ fetchFn }: GetMeshSourcePayload): Promise<MeshSource>;
}
