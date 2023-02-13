import { JSONSchemaLoaderOptions } from '@omnigraph/json-schema';
export interface OpenAPILoaderOptions extends Partial<JSONSchemaLoaderOptions> {
    source: string;
    selectQueryOrMutationField?: OpenAPILoaderSelectQueryOrMutationFieldConfig[];
    fallbackFormat?: 'json' | 'yaml' | 'js' | 'ts';
}
export interface OpenAPILoaderSelectQueryOrMutationFieldConfig {
    type: 'query' | 'mutation' | 'Query' | 'Mutation';
    fieldName: string;
}
