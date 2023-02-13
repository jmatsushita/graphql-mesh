import { RAMLLoaderOptions } from './types.cjs';
/**
 * Creates a local GraphQLSchema instance from a RAML API Document.
 * Everytime this function is called, the RAML file and its dependencies will be resolved on runtime.
 * If you want to avoid this, use `createBundle` function to create a bundle once and save it to a storage
 * then load it with `loadGraphQLSchemaFromBundle`.
 */
export declare function loadGraphQLSchemaFromRAML(name: string, options: RAMLLoaderOptions): Promise<import("graphql").GraphQLSchema>;
export declare function loadNonExecutableGraphQLSchemaFromRAML(name: string, options: RAMLLoaderOptions): Promise<import("graphql").GraphQLSchema>;
export { processDirectives } from '@omnigraph/json-schema';
