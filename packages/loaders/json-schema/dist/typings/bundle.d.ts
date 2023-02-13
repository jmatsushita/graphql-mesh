import { JSONSchemaObject } from 'json-machete';
import { Logger, MeshFetch } from '@graphql-mesh/types';
import { JSONSchemaOperationConfig, OperationHeadersConfiguration } from './types.js';
import { GraphQLSchema } from 'graphql';
import type { IStringifyOptions } from 'qs';
export interface JSONSchemaLoaderBundle {
    name?: string;
    endpoint?: string;
    operations: JSONSchemaOperationConfig[];
    operationHeaders?: Record<string, string>;
    referencedSchema: JSONSchemaObject;
}
export interface JSONSchemaLoaderBundleOptions {
    dereferencedSchema: JSONSchemaObject;
    endpoint?: string;
    operations: JSONSchemaOperationConfig[];
    operationHeaders?: Record<string, string>;
    logger?: Logger;
}
export declare function createBundleFromDereferencedSchema(name: string, { dereferencedSchema, endpoint, operations, operationHeaders, logger, }: JSONSchemaLoaderBundleOptions): Promise<JSONSchemaLoaderBundle>;
export interface JSONSchemaLoaderBundleToGraphQLSchemaOptions {
    cwd?: string;
    logger?: Logger;
    fetch?: MeshFetch;
    endpoint?: string;
    operationHeaders?: OperationHeadersConfiguration;
    queryParams?: Record<string, string>;
    queryStringOptions?: IStringifyOptions;
}
/**
 * Generates a local GraphQLSchema instance from
 * previously generated JSON Schema bundle
 */
export declare function getGraphQLSchemaFromBundle({ name, endpoint: bundledBaseUrl, operations, operationHeaders: bundledOperationHeaders, referencedSchema, }: JSONSchemaLoaderBundle, { cwd, logger, fetch, endpoint: overwrittenBaseUrl, operationHeaders: additionalOperationHeaders, queryParams, queryStringOptions, }?: JSONSchemaLoaderBundleToGraphQLSchemaOptions): Promise<GraphQLSchema>;
