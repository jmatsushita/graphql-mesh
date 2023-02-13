import { OpenAPILoaderOptions } from './types.js';
/**
 * Creates a local GraphQLSchema instance from a OpenAPI Document.
 * Everytime this function is called, the OpenAPI file and its dependencies will be resolved on runtime.
 * If you want to avoid this, use `createBundle` function to create a bundle once and save it to a storage
 * then load it with `loadGraphQLSchemaFromBundle`.
 */
export declare function loadGraphQLSchemaFromOpenAPI(name: string, options: OpenAPILoaderOptions): Promise<import("graphql").GraphQLSchema>;
export declare function loadNonExecutableGraphQLSchemaFromOpenAPI(name: string, options: OpenAPILoaderOptions): Promise<import("graphql").GraphQLSchema>;
export { processDirectives } from '@omnigraph/json-schema';
