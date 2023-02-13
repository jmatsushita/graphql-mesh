import { GraphQLSchema } from 'graphql';
import { MeshTransform, MeshTransformOptions, YamlConfig } from '@graphql-mesh/types';
export default class ReplaceFieldTransform implements MeshTransform {
    noWrap: boolean;
    private baseDir;
    private typeDefs;
    private replacementsMap;
    private importFn;
    constructor(options: MeshTransformOptions<YamlConfig.ReplaceFieldTransformConfig>);
    transformSchema(schema: GraphQLSchema): GraphQLSchema;
}
