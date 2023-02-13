import { MeshTransform, MeshTransformOptions, YamlConfig } from '@graphql-mesh/types';
import { GraphQLSchema } from 'graphql';
export default class CacheTransform implements MeshTransform {
    private options;
    noWrap: boolean;
    private readonly shouldWaitLocal;
    constructor(options: MeshTransformOptions<YamlConfig.CacheTransformConfig[]>);
    transformSchema(schema: GraphQLSchema): GraphQLSchema;
    private shouldWait;
    private setShouldWait;
    private cleanupShouldWait;
    private waitAndReturn;
}
