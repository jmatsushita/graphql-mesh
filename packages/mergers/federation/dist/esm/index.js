import { extendSchema, parse, execute, } from 'graphql';
import { wrapSchema } from '@graphql-tools/wrap';
import { ApolloGateway, LocalGraphQLDataSource, SERVICE_DEFINITION_QUERY } from '@apollo/gateway';
import { addResolversToSchema } from '@graphql-tools/schema';
import { printWithCache } from '@graphql-mesh/utils';
import { AggregateError, asArray, printSchemaWithDirectives, } from '@graphql-tools/utils';
import { PredefinedProxyOptions } from '@graphql-mesh/store';
import { process } from '@graphql-mesh/cross-helpers';
export default class FederationMerger {
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
            const transformedSchema = wrapSchema(rawSource);
            rawSourceMap.set(rawSource.name, rawSource);
            sourceMap.set(rawSource, transformedSchema);
            const sdl = await this.store
                .proxy(`${rawSource.name}_sdl`, PredefinedProxyOptions.StringWithoutValidation)
                .getWithSet(async () => {
                var _a;
                this.logger.debug(`Fetching Apollo Federated Service SDL for ${rawSource.name}`);
                const sdlQueryResult = await execute({
                    schema: transformedSchema,
                    document: parse(SERVICE_DEFINITION_QUERY),
                });
                if ((_a = sdlQueryResult.errors) === null || _a === void 0 ? void 0 : _a.length) {
                    throw new AggregateError(sdlQueryResult.errors, `Failed on fetching Federated SDL for ${rawSource.name}`);
                }
                return sdlQueryResult.data._service.sdl;
            });
            localServiceList.push({
                name: rawSource.name,
                typeDefs: parse(sdl),
            });
        }));
        this.logger.debug(`Creating ApolloGateway`);
        const gateway = new ApolloGateway({
            localServiceList,
            buildService: ({ name }) => {
                this.logger.debug(`Building federation service: ${name}`);
                const rawSource = rawSourceMap.get(name);
                const transformedSchema = sourceMap.get(rawSource);
                return new LocalGraphQLDataSource(transformedSchema);
            },
            logger: this.logger,
            debug: !!process.env.DEBUG,
            serviceHealthCheck: true,
        });
        this.logger.debug(`Loading gateway`);
        const { schema, executor: gatewayExecutor } = await gateway.load();
        const schemaHash = printSchemaWithDirectives(schema);
        let remoteSchema = schema;
        this.logger.debug(`Wrapping gateway executor in a unified schema`);
        const executor = ({ document, info, variables, context, operationName, }) => {
            const documentStr = printWithCache(document);
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
            remoteSchema = extendSchema(remoteSchema, typeDef);
        });
        if (resolvers) {
            this.logger.debug(`Applying additionalResolvers`);
            for (const resolversObj of asArray(resolvers)) {
                remoteSchema = addResolversToSchema({
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
