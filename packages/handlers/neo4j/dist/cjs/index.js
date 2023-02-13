"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const introspector_1 = require("@neo4j/introspector");
const graphql_1 = require("@neo4j/graphql");
const graphql_scalars_1 = require("graphql-scalars");
const neo4j_driver_1 = tslib_1.__importDefault(require("neo4j-driver"));
const store_1 = require("@graphql-mesh/store");
const utils_1 = require("@graphql-mesh/utils");
const cross_helpers_1 = require("@graphql-mesh/cross-helpers");
function getEventEmitterFromPubSub(pubsub) {
    return {
        on(event, listener) {
            pubsub.subscribe(event.toString(), listener);
            return this;
        },
        once(event, listener) {
            const id = pubsub.subscribe(event.toString(), data => {
                listener(data);
                pubsub.unsubscribe(id);
            });
            return this;
        },
        emit(event, ...args) {
            pubsub.publish(event.toString(), args[0]);
            return true;
        },
        addListener(event, listener) {
            return this.on(event, listener);
        },
        setMaxListeners() {
            return this;
        },
    };
}
class Neo4JHandler {
    constructor({ config, baseDir, pubsub, store, logger, importFn, }) {
        this.config = config;
        this.baseDir = baseDir;
        this.pubsub = pubsub;
        this.typeDefs = store.proxy('typeDefs.graphql', store_1.PredefinedProxyOptions.StringWithoutValidation);
        this.logger = logger;
        this.importFn = importFn;
    }
    getCachedTypeDefs(driver) {
        return this.typeDefs.getWithSet(async () => {
            if (this.config.source) {
                return (0, utils_1.readFileOrUrl)(this.config.source, {
                    cwd: this.baseDir,
                    allowUnknownExtensions: true,
                    importFn: this.importFn,
                    fetch: this.fetchFn,
                    logger: this.logger,
                });
            }
            else {
                this.logger.info('Inferring the schema from the database: ', `"${this.config.database || 'neo4j'}"`);
                return (0, introspector_1.toGraphQLTypeDefs)(() => driver.session({ database: this.config.database, defaultAccessMode: neo4j_driver_1.default.session.READ }));
            }
        });
    }
    async getMeshSource({ fetchFn }) {
        this.fetchFn = fetchFn;
        const driver = neo4j_driver_1.default.driver(this.config.endpoint, neo4j_driver_1.default.auth.basic(this.config.username, this.config.password), {
            useBigInt: true,
            logging: {
                logger: (level, message) => this.logger[level](message),
            },
        });
        const id = this.pubsub.subscribe('destroy', async () => {
            this.pubsub.unsubscribe(id);
            this.logger.debug('Closing Neo4j');
            await driver.close();
            this.logger.debug('Neo4j closed');
        });
        const typeDefs = await this.getCachedTypeDefs(driver);
        const events = getEventEmitterFromPubSub(this.pubsub);
        const neo4jGraphQL = new graphql_1.Neo4jGraphQL({
            typeDefs,
            config: {
                driverConfig: {
                    database: this.config.database,
                },
                enableDebug: !!cross_helpers_1.process.env.DEBUG,
                skipValidateTypeDefs: true,
            },
            resolvers: {
                BigInt: graphql_scalars_1.GraphQLBigInt,
            },
            plugins: {
                subscriptions: {
                    events,
                    publish: eventMeta => this.pubsub.publish(eventMeta.event, eventMeta),
                },
            },
            driver,
        });
        return {
            schema: await neo4jGraphQL.getSchema(),
        };
    }
}
exports.default = Neo4JHandler;
