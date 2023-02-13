"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const store_1 = require("@graphql-mesh/store");
const utils_1 = require("@graphql-mesh/utils");
const utils_2 = require("@graphql-tools/utils");
const json_schema_1 = require("@omnigraph/json-schema");
const graphql_1 = require("graphql");
class JsonSchemaHandler {
    constructor({ name, config, baseDir, store, pubsub, logger, importFn, }) {
        this.name = name;
        this.config = config;
        this.baseDir = baseDir;
        this.schemaWithAnnotationsProxy = store.proxy('schemaWithAnnotations.graphql', store_1.PredefinedProxyOptions.GraphQLSchemaWithDiffing);
        this.pubsub = pubsub;
        this.logger = logger;
        this.importFn = importFn;
    }
    async getNonExecutableSchema() {
        if (this.config.source) {
            this.logger.info(`Fetching GraphQL Schema with annotations`);
            const sdl = await (0, utils_1.readFileOrUrl)(this.config.source, {
                allowUnknownExtensions: true,
                cwd: this.baseDir,
                fetch: this.fetchFn,
                importFn: this.importFn,
                logger: this.logger,
                headers: this.config.schemaHeaders,
            });
            return (0, graphql_1.buildSchema)(sdl, {
                assumeValidSDL: true,
                assumeValid: true,
            });
        }
        return this.schemaWithAnnotationsProxy.getWithSet(async () => {
            if (this.config.bundlePath) {
                this.logger.info(`Fetching JSON Schema bundle`);
                const bundle = await (0, utils_1.readFileOrUrl)(this.config.bundlePath, {
                    allowUnknownExtensions: true,
                    cwd: this.baseDir,
                    fetch: this.fetchFn,
                    importFn: this.importFn,
                    logger: this.logger,
                    headers: this.config.bundleHeaders,
                });
                return (0, json_schema_1.getGraphQLSchemaFromBundle)(bundle, {
                    cwd: this.baseDir,
                    logger: this.logger,
                    fetch: this.fetchFn,
                    endpoint: this.config.endpoint,
                    operationHeaders: this.config.operationHeaders,
                    queryParams: this.config.queryParams,
                    queryStringOptions: this.config.queryStringOptions,
                });
            }
            this.logger.info(`Generating GraphQL schema from JSON Schemas`);
            return (0, json_schema_1.loadNonExecutableGraphQLSchemaFromJSONSchemas)(this.name, {
                ...this.config,
                operations: this.config.operations,
                cwd: this.baseDir,
                fetch: this.fetchFn,
                logger: this.logger,
                pubsub: this.pubsub,
            });
        });
    }
    async getMeshSource({ fetchFn }) {
        this.fetchFn = fetchFn;
        this.logger.debug('Getting the schema with annotations');
        const nonExecutableSchema = await this.getNonExecutableSchema();
        const schemaWithDirectives$ = Promise.resolve().then(() => {
            this.logger.info(`Processing annotations for the execution layer`);
            return (0, json_schema_1.processDirectives)({
                ...this.config,
                schema: nonExecutableSchema,
                pubsub: this.pubsub,
                logger: this.logger,
                globalFetch: fetchFn,
            });
        });
        return {
            schema: nonExecutableSchema,
            executor: async (executionRequest) => {
                const args = {
                    schema: await schemaWithDirectives$,
                    document: executionRequest.document,
                    variableValues: executionRequest.variables,
                    operationName: executionRequest.operationName,
                    contextValue: executionRequest.context,
                    rootValue: executionRequest.rootValue,
                };
                const operationAST = (0, utils_2.getOperationASTFromRequest)(executionRequest);
                if (operationAST.operation === graphql_1.OperationTypeNode.SUBSCRIPTION) {
                    return (0, graphql_1.subscribe)(args);
                }
                return (0, graphql_1.execute)(args);
            },
        };
    }
}
exports.default = JsonSchemaHandler;
