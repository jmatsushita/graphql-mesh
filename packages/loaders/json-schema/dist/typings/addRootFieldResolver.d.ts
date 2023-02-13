import { Logger, MeshFetch } from '@graphql-mesh/types';
import { GraphQLField, GraphQLSchema } from 'graphql';
import { HTTPMethod } from './types.js';
import { IStringifyOptions } from 'qs';
export interface HTTPRootFieldResolverOpts {
    sourceName: string;
    endpoint: string;
    path: string;
    httpMethod: HTTPMethod;
    operationSpecificHeaders: Record<string, string>;
    isBinary: boolean;
    requestBaseBody: any;
    queryParamArgMap: Record<string, string>;
    queryStringOptionsByParam: Record<string, IStringifyOptions & {
        destructObject?: boolean;
    }>;
}
export interface GlobalOptions {
    sourceName: string;
    endpoint: string;
    operationHeaders: Record<string, string>;
    queryStringOptions: IStringifyOptions;
    queryParams: Record<string, string | number | boolean>;
}
export declare function addHTTPRootFieldResolver(schema: GraphQLSchema, field: GraphQLField<any, any>, logger: Logger, globalFetch: MeshFetch, { path, operationSpecificHeaders, httpMethod, isBinary, requestBaseBody, queryParamArgMap, queryStringOptionsByParam, }: HTTPRootFieldResolverOpts, { sourceName, endpoint, operationHeaders: globalOperationHeaders, queryStringOptions: globalQueryStringOptions, queryParams: globalQueryParams, }: GlobalOptions): void;
