import { PredefinedProxyOptions } from '@graphql-mesh/store';
import { readFileOrUrl } from '@graphql-mesh/utils';
import { loadNonExecutableGraphQLSchemaFromRAML, processDirectives } from '@omnigraph/raml';
import { buildSchema, execute, OperationTypeNode, subscribe, } from 'graphql';
import { getOperationASTFromRequest } from '@graphql-tools/utils';
export default class RAMLHandler {
    constructor({ name, config, baseDir, store, pubsub, logger, importFn, }) {
        this.name = name;
        this.config = config;
        this.baseDir = baseDir;
        this.schemaWithAnnotationsProxy = store.proxy('schemaWithAnnotations.graphql', PredefinedProxyOptions.GraphQLSchemaWithDiffing);
        this.bundleProxy = store.proxy('jsonSchemaBundle', PredefinedProxyOptions.JsonWithoutValidation);
        this.pubsub = pubsub;
        this.importFn = importFn;
        this.logger = logger;
    }
    async getNonExecutableSchema() {
        if (this.config.source.endsWith('.graphql')) {
            this.logger.info(`Fetching GraphQL Schema with annotations`);
            const sdl = await readFileOrUrl(this.config.source, {
                allowUnknownExtensions: true,
                cwd: this.baseDir,
                fetch: this.fetchFn,
                importFn: this.importFn,
                logger: this.logger,
                headers: this.config.schemaHeaders,
            });
            return buildSchema(sdl, {
                assumeValidSDL: true,
                assumeValid: true,
            });
        }
        return this.schemaWithAnnotationsProxy.getWithSet(async () => {
            var _a;
            this.logger.info(`Generating GraphQL schema from RAML schema`);
            const schema = await loadNonExecutableGraphQLSchemaFromRAML(this.name, {
                ...this.config,
                cwd: this.baseDir,
                fetch: this.fetchFn,
                logger: this.logger,
                ignoreErrorResponses: this.config.ignoreErrorResponses,
                selectQueryOrMutationField: (_a = this.config.selectQueryOrMutationField) === null || _a === void 0 ? void 0 : _a.map(({ type, fieldName }) => ({
                    type: type.toLowerCase(),
                    fieldName,
                })),
                pubsub: this.pubsub,
                bundle: this.config.bundle,
            });
            if (this.config.bundle) {
                await this.bundleProxy.set(schema.extensions.bundle);
            }
            return schema;
        });
    }
    async getMeshSource({ fetchFn }) {
        this.fetchFn = fetchFn;
        this.logger.debug('Getting the schema with annotations');
        const nonExecutableSchema = await this.getNonExecutableSchema();
        const schemaWithDirectives$ = Promise.resolve().then(() => {
            this.logger.info(`Processing annotations for the execution layer`);
            return processDirectives({
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
                const operationAST = getOperationASTFromRequest(executionRequest);
                if (operationAST.operation === OperationTypeNode.SUBSCRIPTION) {
                    return subscribe(args);
                }
                return execute(args);
            },
        };
    }
}
