/// <reference types="@cloudflare/workers-types" />
import { OpenAPIV3, OpenAPIV2 } from 'openapi-types';
import { JSONSchemaOperationConfig, OperationHeadersConfiguration } from '@omnigraph/json-schema';
import { OpenAPILoaderSelectQueryOrMutationFieldConfig } from './types.cjs';
import { Logger } from '@graphql-mesh/types';
interface GetJSONSchemaOptionsFromOpenAPIOptionsParams {
    source: OpenAPIV3.Document | OpenAPIV2.Document | string;
    fallbackFormat?: 'json' | 'yaml' | 'js' | 'ts';
    cwd?: string;
    fetch?: WindowOrWorkerGlobalScope['fetch'];
    endpoint?: string;
    schemaHeaders?: Record<string, string>;
    operationHeaders?: OperationHeadersConfiguration;
    queryParams?: Record<string, any>;
    selectQueryOrMutationField?: OpenAPILoaderSelectQueryOrMutationFieldConfig[];
    logger?: Logger;
}
export declare function getJSONSchemaOptionsFromOpenAPIOptions(name: string, { source, fallbackFormat, cwd, fetch: fetchFn, endpoint, schemaHeaders, operationHeaders, queryParams, selectQueryOrMutationField, logger, }: GetJSONSchemaOptionsFromOpenAPIOptionsParams): Promise<{
    operations: JSONSchemaOperationConfig[];
    endpoint: string;
    cwd: string;
    fetch: (input: RequestInfo | URL, init?: RequestInit<IncomingRequestCfProperties<unknown> | RequestInitCfProperties>) => Promise<Response>;
    schemaHeaders: Record<string, string>;
    operationHeaders: OperationHeadersConfiguration;
}>;
export {};
