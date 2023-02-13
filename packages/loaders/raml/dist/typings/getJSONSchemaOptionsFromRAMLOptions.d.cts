import { JSONSchemaOperationConfig } from '@omnigraph/json-schema';
import { RAMLLoaderOptions } from './types.cjs';
/**
 * Generates the options for JSON Schema Loader
 * from RAML Loader options by extracting the JSON Schema references
 * from RAML API Document
 */
export declare function getJSONSchemaOptionsFromRAMLOptions({ source, cwd: ramlFileCwd, operations: extraOperations, endpoint: forcedBaseUrl, fetch, schemaHeaders, selectQueryOrMutationField, }: RAMLLoaderOptions): Promise<{
    operations: JSONSchemaOperationConfig[];
    cwd: string;
    endpoint: string;
    fetch?: WindowOrWorkerGlobalScope['fetch'];
}>;
