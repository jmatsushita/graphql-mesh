import { YamlConfig, MeshHandler, MeshHandlerOptions, MeshSource, GetMeshSourcePayload } from '@graphql-mesh/types';
export default class ODataHandler implements MeshHandler {
    private name;
    private config;
    private fetchFn;
    private logger;
    private importFn;
    private baseDir;
    private eventEmitterSet;
    private metadataJson;
    private xmlParser;
    constructor({ name, config, baseDir, importFn, logger, store, }: MeshHandlerOptions<YamlConfig.ODataHandler>);
    getCachedMetadataJson(): Promise<any>;
    getMeshSource({ fetchFn }: GetMeshSourcePayload): Promise<MeshSource>;
    private prepareSearchParams;
}
