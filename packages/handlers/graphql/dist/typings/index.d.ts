import { GraphQLSchema } from 'graphql';
import { GetMeshSourcePayload, MeshHandler, MeshHandlerOptions, MeshSource, YamlConfig } from '@graphql-mesh/types';
export default class GraphQLHandler implements MeshHandler {
    private name;
    private config;
    private baseDir;
    private nonExecutableSchema;
    private importFn;
    private fetchFn;
    private logger;
    private urlLoader;
    constructor({ name, config, baseDir, store, importFn, logger, }: MeshHandlerOptions<YamlConfig.Handler['graphql']>);
    private interpolationStringSet;
    private getArgsAndContextVariables;
    private wrapExecutorToPassSourceNameAndDebug;
    getExecutorForHTTPSourceConfig(httpSourceConfig: YamlConfig.GraphQLHandlerHTTPConfiguration): Promise<MeshSource['executor']>;
    private getSchemaFromContent;
    getNonExecutableSchemaForHTTPSource(httpSourceConfig: YamlConfig.GraphQLHandlerHTTPConfiguration): Promise<GraphQLSchema>;
    getCodeFirstSource({ source: schemaConfig, }: YamlConfig.GraphQLHandlerCodeFirstConfiguration): Promise<MeshSource>;
    getRaceExecutor(executors: MeshSource['executor'][]): MeshSource['executor'];
    getFallbackExecutor(executors: MeshSource['executor'][]): MeshSource['executor'];
    getMeshSource({ fetchFn }: GetMeshSourcePayload): Promise<MeshSource>;
}
