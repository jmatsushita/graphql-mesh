import { GraphQLSchema } from 'graphql';
import { YamlConfig, MeshTransformOptions, MeshTransform } from '@graphql-mesh/types';
export default class ResolversCompositionTransform implements MeshTransform {
    noWrap: boolean;
    private compositions;
    private baseDir;
    private importFn;
    constructor({ baseDir, config, importFn, }: MeshTransformOptions<YamlConfig.Transform['resolversComposition']>);
    transformSchema(schema: GraphQLSchema): GraphQLSchema;
}
export { ResolversComposition } from '@graphql-tools/resolvers-composition';
