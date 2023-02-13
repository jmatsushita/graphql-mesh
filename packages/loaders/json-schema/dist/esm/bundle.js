import { referenceJSONSchema, dereferenceObject } from 'json-machete';
import { DefaultLogger } from '@graphql-mesh/utils';
import { fetch as crossUndiciFetch } from '@whatwg-node/fetch';
import { getGraphQLSchemaFromDereferencedJSONSchema } from './getGraphQLSchemaFromDereferencedJSONSchema.js';
export async function createBundleFromDereferencedSchema(name, { dereferencedSchema, endpoint, operations, operationHeaders, logger = new DefaultLogger(name), }) {
    logger.debug(`Creating references from dereferenced schema`);
    const referencedSchema = await referenceJSONSchema(dereferencedSchema);
    logger.debug(`Bundle generation finished`);
    return {
        name,
        endpoint,
        operations,
        operationHeaders: typeof operationHeaders === 'object' ? operationHeaders : {},
        referencedSchema,
    };
}
/**
 * Generates a local GraphQLSchema instance from
 * previously generated JSON Schema bundle
 */
export async function getGraphQLSchemaFromBundle({ name, endpoint: bundledBaseUrl, operations, operationHeaders: bundledOperationHeaders = {}, referencedSchema, }, { cwd = process.cwd(), logger = new DefaultLogger(name), fetch = crossUndiciFetch, endpoint: overwrittenBaseUrl, operationHeaders: additionalOperationHeaders = {}, queryParams, queryStringOptions, } = {}) {
    logger.info(`Dereferencing the bundle`);
    const fullyDeferencedSchema = await dereferenceObject(referencedSchema, {
        cwd,
        fetchFn: fetch,
        logger,
    });
    const endpoint = overwrittenBaseUrl || bundledBaseUrl;
    let operationHeaders = {};
    if (typeof additionalOperationHeaders === 'function') {
        operationHeaders = async (resolverData, operationConfig) => {
            const result = await additionalOperationHeaders(resolverData, {
                endpoint,
                field: operationConfig.field,
                method: 'method' in operationConfig ? operationConfig.method : 'POST',
                path: 'path' in operationConfig ? operationConfig.path : operationConfig.pubsubTopic,
            });
            return {
                ...bundledOperationHeaders,
                ...result,
            };
        };
    }
    else {
        operationHeaders = {
            ...bundledOperationHeaders,
            ...additionalOperationHeaders,
        };
    }
    logger.info(`Creating the GraphQL Schema from dereferenced schema`);
    return getGraphQLSchemaFromDereferencedJSONSchema(name, {
        fullyDeferencedSchema,
        logger,
        endpoint,
        operations,
        operationHeaders,
        queryParams,
        queryStringOptions,
    });
}
