import { MeshHandlerOptions, MeshHandler, MeshSource, YamlConfig } from '@graphql-mesh/types';
export default class TuqlHandler implements MeshHandler {
    private config;
    private baseDir;
    constructor({ config, baseDir }: MeshHandlerOptions<YamlConfig.TuqlHandler>);
    getMeshSource(): Promise<MeshSource>;
}
