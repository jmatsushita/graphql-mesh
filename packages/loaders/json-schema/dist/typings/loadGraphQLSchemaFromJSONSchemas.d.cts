import { JSONSchemaLoaderOptions } from './types.cjs';
export declare function loadNonExecutableGraphQLSchemaFromJSONSchemas(name: string, options: JSONSchemaLoaderOptions): Promise<import("graphql").GraphQLSchema>;
export declare function loadGraphQLSchemaFromJSONSchemas(name: string, options: JSONSchemaLoaderOptions): Promise<import("graphql").GraphQLSchema>;
