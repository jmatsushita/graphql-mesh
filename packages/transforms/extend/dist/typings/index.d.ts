import { MeshTransform, MeshTransformOptions, YamlConfig } from '@graphql-mesh/types';
import { GraphQLSchema } from 'graphql';
export default class ExtendTransform implements MeshTransform {
    noWrap: boolean;
    private config;
    private baseDir;
    constructor({ baseDir, config }: MeshTransformOptions<YamlConfig.ExtendTransform>);
    transformSchema(schema: GraphQLSchema): GraphQLSchema;
}
