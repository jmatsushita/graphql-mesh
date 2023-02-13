"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadGraphQLSchemaFromJSONSchemas = exports.loadNonExecutableGraphQLSchemaFromJSONSchemas = void 0;
const utils_1 = require("@graphql-mesh/utils");
const bundle_js_1 = require("./bundle.js");
const directives_js_1 = require("./directives.js");
const getDereferencedJSONSchemaFromOperations_js_1 = require("./getDereferencedJSONSchemaFromOperations.js");
const getGraphQLSchemaFromDereferencedJSONSchema_js_1 = require("./getGraphQLSchemaFromDereferencedJSONSchema.js");
async function loadNonExecutableGraphQLSchemaFromJSONSchemas(name, options) {
    options.logger = options.logger || new utils_1.DefaultLogger(name);
    options.cwd = options.cwd || process.cwd();
    const fullyDeferencedSchema = await (0, getDereferencedJSONSchemaFromOperations_js_1.getDereferencedJSONSchemaFromOperations)({
        operations: options.operations,
        operationHeaders: typeof options.operationHeaders === 'object' ? options.operationHeaders : {},
        queryParams: options.queryParams,
        endpoint: options.endpoint,
        cwd: options.cwd,
        logger: options.logger,
        fetchFn: options.fetch,
        schemaHeaders: options.schemaHeaders,
        ignoreErrorResponses: options.ignoreErrorResponses,
    });
    const schema = await (0, getGraphQLSchemaFromDereferencedJSONSchema_js_1.getGraphQLSchemaFromDereferencedJSONSchema)(name, {
        fullyDeferencedSchema,
        logger: options.logger,
        operations: options.operations,
        operationHeaders: options.operationHeaders,
        endpoint: options.endpoint,
        queryParams: options.queryParams,
        queryStringOptions: options.queryStringOptions,
    });
    if (options.bundle) {
        schema.extensions = schema.extensions || {};
        Object.defineProperty(schema.extensions, 'bundle', {
            value: await (0, bundle_js_1.createBundleFromDereferencedSchema)(name, {
                dereferencedSchema: fullyDeferencedSchema,
                endpoint: options.endpoint,
                operations: options.operations,
                operationHeaders: typeof options.operationHeaders === 'object' ? options.operationHeaders : {},
                logger: options.logger,
            }),
        });
    }
    return schema;
}
exports.loadNonExecutableGraphQLSchemaFromJSONSchemas = loadNonExecutableGraphQLSchemaFromJSONSchemas;
async function loadGraphQLSchemaFromJSONSchemas(name, options) {
    const graphqlSchema = await loadNonExecutableGraphQLSchemaFromJSONSchemas(name, options);
    return (0, directives_js_1.processDirectives)({
        ...options,
        operationHeaders: typeof options.operationHeaders === 'object' ? options.operationHeaders : {},
        schema: graphqlSchema,
        globalFetch: options.fetch,
        pubsub: options.pubsub,
        logger: options.logger,
    });
}
exports.loadGraphQLSchemaFromJSONSchemas = loadGraphQLSchemaFromJSONSchemas;
