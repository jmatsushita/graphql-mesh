import { GraphQLObjectType, GraphQLTypeResolver } from 'graphql';
export declare function getTypeResolverFromOutputTCs(possibleTypes: readonly GraphQLObjectType[], discriminatorField?: string, statusCodeTypeNameMap?: Record<string, string>): GraphQLTypeResolver<any, any>;
