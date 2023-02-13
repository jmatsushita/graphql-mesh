import { Logger } from '@graphql-mesh/types';
import { JSONSchemaObject } from 'json-machete';
import { JSONSchemaOperationConfig } from './types.js';
export declare function getReferencedJSONSchemaFromOperations({ operations, cwd, schemaHeaders, ignoreErrorResponses, logger, fetchFn, endpoint, operationHeaders, queryParams, }: {
    operations: JSONSchemaOperationConfig[];
    cwd: string;
    schemaHeaders?: {
        [key: string]: string;
    };
    ignoreErrorResponses?: boolean;
    logger?: Logger;
    fetchFn: WindowOrWorkerGlobalScope['fetch'];
    endpoint: string;
    operationHeaders: Record<string, string>;
    queryParams: Record<string, string | number | boolean>;
}): Promise<JSONSchemaObject>;
