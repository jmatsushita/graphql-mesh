import { GraphQLList, GraphQLNonNull, GraphQLOutputType, GraphQLScalarType, GraphQLObjectType, GraphQLInterfaceType, GraphQLUnionType, GraphQLEnumType, GraphQLSchema } from 'graphql';
import { MeshTransform, YamlConfig, MeshTransformOptions } from '@graphql-mesh/types';
export declare type GraphQLTypePointer = GraphQLList<GraphQLOutputType> | GraphQLNonNull<GraphQLScalarType | GraphQLObjectType | GraphQLInterfaceType | GraphQLUnionType | GraphQLEnumType | GraphQLList<GraphQLOutputType>>;
export default class NamingConventionTransform implements MeshTransform {
    noWrap: boolean;
    config: Omit<YamlConfig.NamingConventionTransformConfig, 'mode'>;
    constructor(options: MeshTransformOptions<YamlConfig.NamingConventionTransformConfig>);
    transformSchema(schema: GraphQLSchema): GraphQLSchema;
}
