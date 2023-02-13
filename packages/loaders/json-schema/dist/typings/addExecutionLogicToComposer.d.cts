import { SchemaComposer } from 'graphql-compose';
import { Logger } from '@graphql-mesh/types';
import { JSONSchemaOperationConfig, OperationHeadersConfiguration } from './types.cjs';
import { IStringifyOptions } from 'qs';
export interface AddExecutionLogicToComposerOptions {
    schemaComposer: SchemaComposer;
    endpoint: string;
    operations: JSONSchemaOperationConfig[];
    operationHeaders?: OperationHeadersConfiguration;
    logger: Logger;
    queryParams?: Record<string, string | number | boolean>;
    queryStringOptions?: IStringifyOptions;
}
export declare function addExecutionDirectivesToComposer(name: string, { schemaComposer, logger, operations, operationHeaders, endpoint, queryParams, queryStringOptions, }: AddExecutionLogicToComposerOptions): Promise<SchemaComposer<any>>;
