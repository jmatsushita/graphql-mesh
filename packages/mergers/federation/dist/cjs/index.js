"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const graphql_1 = require("graphql");
const wrap_1 = require("@graphql-tools/wrap");
const gateway_1 = require("@apollo/gateway");
const schema_1 = require("@graphql-tools/schema");
const utils_1 = require("@graphql-mesh/utils");
const utils_2 = require("@graphql-tools/utils");
const store_1 = require("@graphql-mesh/store");
const cross_helpers_1 = require("@graphql-mesh/cross-helpers");
class FederationMerger {
    constructor(options) {
        this.name = 'federation';
        this.logger = options.logger;
        this.cache = options.cache;
        this.pubsub = options.pubsub;
        this.store = options.store;
    }
    async getUnifiedSchema({ rawSources, typeDefs, resolvers }) {
        this.logger.debug(`Creating localServiceList for gateway`);
        const rawSourceMap = new Map();
        const localServiceList = [];
        const sourceMap = new Map();
        await Promise.all(rawSources.map(async (rawSource) => {
            const transformedSchema = (0, wrap_1.wrapSchema)(rawSource);
            rawSourceMap.set(rawSource.name, rawSource);
            sourceMap.set(rawSource, transformedSchema);
            const sdl = await this.store
                .proxy(`${rawSource.name}_sdl`, store_1.PredefinedProxyOptions.StringWithoutValidation)
                .getWithSet(async () => {
                var _a;
                this.logger.debug(`Fetching Apollo Federated Service SDL for ${rawSource.name}`);
                const sdlQueryResult = await (0, graphql_1.execute)({
                    schema: transformedSchema,
                    document: (0, graphql_1.parse)(gateway_1.SERVICE_DEFINITION_QUERY),
                });
                if ((_a = sdlQueryResult.errors) === null || _a === void 0 ? void 0 : _a.length) {
                    throw new utils_2.AggregateError(sdlQueryResult.errors, `Failed on fetching Federated SDL for ${rawSource.name}`);
                }
                return sdlQueryResult.data._service.sdl;
            });
            localServiceList.push({
                name: rawSource.name,
                typeDefs: (0, graphql_1.parse)(sdl),
            });
        }));
        this.logger.debug(`Creating ApolloGateway`);
        const gateway = new gateway_1.ApolloGateway({
            localServiceList,
            buildService: ({ name }) => {
                this.logger.debug(`Building federation service: ${name}`);
                const rawSource = rawSourceMap.get(name);
                const transformedSchema = sourceMap.get(rawSource);
                return new gateway_1.LocalGraphQLDataSource(transformedSchema);
            },
            logger: this.logger,
            debug: !!cross_helpers_1.process.env.DEBUG,
            serviceHealthCheck: true,
        });
        this.logger.debug(`Loading gateway`);
        const { schema, executor: gatewayExecutor } = await gateway.load();
        const schemaHash = (0, utils_2.printSchemaWithDirectives)(schema);
        let remoteSchema = schema;
        this.logger.debug(`Wrapping gateway executor in a unified schema`);
        const executor = ({ document, info, variables, context, operationName, }) => {
            const documentStr = (0, utils_1.printWithCache)(document);
            const { operation } = info;
            // const operationName = operation.name?.value;
            return gatewayExecutor({
                document,
                request: {
                    query: documentStr,
                    operationName,
                    variables,
                },
                operationName,
                cache: this.cache,
                context,
                queryHash: documentStr,
                logger: this.logger,
                metrics: {},
                source: documentStr,
                operation,
                schema,
                schemaHash,
                overallCachePolicy: undefined,
            });
        };
        const id = this.pubsub.subscribe('destroy', async () => {
            this.pubsub.unsubscribe(id);
            await gateway.stop();
        });
        this.logger.debug(`Applying additionalTypeDefs`);
        typeDefs === null || typeDefs === void 0 ? void 0 : typeDefs.forEach(typeDef => {
            remoteSchema = (0, graphql_1.extendSchema)(remoteSchema, typeDef);
        });
        if (resolvers) {
            this.logger.debug(`Applying additionalResolvers`);
            for (const resolversObj of (0, utils_2.asArray)(resolvers)) {
                remoteSchema = (0, schema_1.addResolversToSchema)({
                    schema: remoteSchema,
                    resolvers: resolversObj,
                    updateResolversInPlace: true,
                });
            }
        }
        this.logger.debug(`Attaching sourceMap to the unified schema`);
        remoteSchema.extensions = remoteSchema.extensions || {};
        Object.defineProperty(remoteSchema.extensions, 'sourceMap', {
            get: () => sourceMap,
        });
        return {
            schema: remoteSchema,
            executor,
        };
    }
}
exports.default = FederationMerger;
