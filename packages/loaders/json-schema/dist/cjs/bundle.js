"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getGraphQLSchemaFromBundle = exports.createBundleFromDereferencedSchema = void 0;
const json_machete_1 = require("json-machete");
const utils_1 = require("@graphql-mesh/utils");
const fetch_1 = require("@whatwg-node/fetch");
const getGraphQLSchemaFromDereferencedJSONSchema_js_1 = require("./getGraphQLSchemaFromDereferencedJSONSchema.js");
async function createBundleFromDereferencedSchema(name, { dereferencedSchema, endpoint, operations, operationHeaders, logger = new utils_1.DefaultLogger(name), }) {
    logger.debug(`Creating references from dereferenced schema`);
    const referencedSchema = await (0, json_machete_1.referenceJSONSchema)(dereferencedSchema);
    logger.debug(`Bundle generation finished`);
    return {
        name,
        endpoint,
        operations,
        operationHeaders: typeof operationHeaders === 'object' ? operationHeaders : {},
        referencedSchema,
    };
}
exports.createBundleFromDereferencedSchema = createBundleFromDereferencedSchema;
/**
 * Generates a local GraphQLSchema instance from
 * previously generated JSON Schema bundle
 */
async function getGraphQLSchemaFromBundle({ name, endpoint: bundledBaseUrl, operations, operationHeaders: bundledOperationHeaders = {}, referencedSchema, }, { cwd = process.cwd(), logger = new utils_1.DefaultLogger(name), fetch = fetch_1.fetch, endpoint: overwrittenBaseUrl, operationHeaders: additionalOperationHeaders = {}, queryParams, queryStringOptions, } = {}) {
    logger.info(`Dereferencing the bundle`);
    const fullyDeferencedSchema = await (0, json_machete_1.dereferenceObject)(referencedSchema, {
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
    return (0, getGraphQLSchemaFromDereferencedJSONSchema_js_1.getGraphQLSchemaFromDereferencedJSONSchema)(name, {
        fullyDeferencedSchema,
        logger,
        endpoint,
        operations,
        operationHeaders,
        queryParams,
        queryStringOptions,
    });
}
exports.getGraphQLSchemaFromBundle = getGraphQLSchemaFromBundle;
