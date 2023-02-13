import { JSONSchemaOperationConfig } from './types.js';
import { JSONSchemaObject } from 'json-machete';
import { Logger } from '@graphql-mesh/types';
export declare function getDereferencedJSONSchemaFromOperations({ operations, cwd, logger, fetchFn, schemaHeaders, ignoreErrorResponses, endpoint, operationHeaders, queryParams, }: {
    operations: JSONSchemaOperationConfig[];
    cwd: string;
    logger: Logger;
    fetchFn: WindowOrWorkerGlobalScope['fetch'];
    schemaHeaders?: Record<string, string>;
    ignoreErrorResponses?: boolean;
    endpoint: string;
    operationHeaders: Record<string, string>;
    queryParams: Record<string, string | number | boolean>;
}): Promise<JSONSchemaObject>;
