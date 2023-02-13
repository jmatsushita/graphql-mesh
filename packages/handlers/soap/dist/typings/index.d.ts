import { MeshHandlerOptions, MeshHandler, YamlConfig, GetMeshSourcePayload, MeshSource } from '@graphql-mesh/types';
export default class SoapHandler implements MeshHandler {
    private config;
    private soapSDLProxy;
    private baseDir;
    private importFn;
    private logger;
    constructor({ config, store, baseDir, importFn, logger, }: MeshHandlerOptions<YamlConfig.SoapHandler>);
    getMeshSource({ fetchFn }: GetMeshSourcePayload): Promise<MeshSource>;
}
