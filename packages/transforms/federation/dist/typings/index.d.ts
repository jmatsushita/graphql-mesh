import { GraphQLSchema } from 'graphql';
import { MeshTransform, MeshTransformOptions, YamlConfig } from '@graphql-mesh/types';
import { SubschemaConfig } from '@graphql-tools/delegate';
export default class FederationTransform implements MeshTransform {
    private apiName;
    private config;
    private baseDir;
    private importFn;
    noWrap: boolean;
    constructor({ apiName, baseDir, config, importFn, }: MeshTransformOptions<YamlConfig.Transform['federation']>);
    transformSchema(schema: GraphQLSchema, rawSource: SubschemaConfig): GraphQLSchema;
}
