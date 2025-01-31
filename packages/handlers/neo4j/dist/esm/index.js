import { toGraphQLTypeDefs } from '@neo4j/introspector';
import { Neo4jGraphQL } from '@neo4j/graphql';
import { GraphQLBigInt } from 'graphql-scalars';
import neo4j from 'neo4j-driver';
import { PredefinedProxyOptions } from '@graphql-mesh/store';
import { readFileOrUrl } from '@graphql-mesh/utils';
import { process } from '@graphql-mesh/cross-helpers';
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
export default class Neo4JHandler {
    constructor({ config, baseDir, pubsub, store, logger, importFn, }) {
        this.config = config;
        this.baseDir = baseDir;
        this.pubsub = pubsub;
        this.typeDefs = store.proxy('typeDefs.graphql', PredefinedProxyOptions.StringWithoutValidation);
        this.logger = logger;
        this.importFn = importFn;
    }
    getCachedTypeDefs(driver) {
        return this.typeDefs.getWithSet(async () => {
            if (this.config.source) {
                return readFileOrUrl(this.config.source, {
                    cwd: this.baseDir,
                    allowUnknownExtensions: true,
                    importFn: this.importFn,
                    fetch: this.fetchFn,
                    logger: this.logger,
                });
            }
            else {
                this.logger.info('Inferring the schema from the database: ', `"${this.config.database || 'neo4j'}"`);
                return toGraphQLTypeDefs(() => driver.session({ database: this.config.database, defaultAccessMode: neo4j.session.READ }));
            }
        });
    }
    async getMeshSource({ fetchFn }) {
        this.fetchFn = fetchFn;
        const driver = neo4j.driver(this.config.endpoint, neo4j.auth.basic(this.config.username, this.config.password), {
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
        const neo4jGraphQL = new Neo4jGraphQL({
            typeDefs,
            config: {
                driverConfig: {
                    database: this.config.database,
                },
                enableDebug: !!process.env.DEBUG,
                skipValidateTypeDefs: true,
            },
            resolvers: {
                BigInt: GraphQLBigInt,
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
