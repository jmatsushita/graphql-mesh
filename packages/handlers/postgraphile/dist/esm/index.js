import { withPostGraphileContext } from 'postgraphile';
import { getPostGraphileBuilder } from 'postgraphile-core';
import pg from 'pg';
import { path, process } from '@graphql-mesh/cross-helpers';
// eslint-disable-next-line import/no-nodejs-modules
import { tmpdir } from 'os';
import { stringInterpolator } from '@graphql-mesh/string-interpolation';
import { loadFromModuleExportExpression } from '@graphql-mesh/utils';
import { PredefinedProxyOptions } from '@graphql-mesh/store';
import { createDefaultExecutor } from '@graphql-tools/delegate';
export default class PostGraphileHandler {
    constructor({ name, config, baseDir, pubsub, store, logger, importFn, }) {
        this.name = name;
        this.config = config;
        this.baseDir = baseDir;
        this.pubsub = pubsub;
        this.pgCache = store.proxy('pgCache.json', PredefinedProxyOptions.JsonWithoutValidation);
        this.logger = logger;
        this.importFn = importFn;
    }
    async getMeshSource() {
        var _a, _b;
        let pgPool;
        if (typeof ((_a = this.config) === null || _a === void 0 ? void 0 : _a.pool) === 'string') {
            pgPool = await loadFromModuleExportExpression(this.config.pool, {
                cwd: this.baseDir,
                importFn: this.importFn,
                defaultExportName: 'default',
            });
        }
        if (!pgPool || !('connect' in pgPool)) {
            const pgLogger = this.logger.child('PostgreSQL');
            pgPool = new pg.Pool({
                connectionString: stringInterpolator.parse(this.config.connectionString, {
                    env: process.env,
                }),
                log: messages => pgLogger.debug(messages),
                ...(_b = this.config) === null || _b === void 0 ? void 0 : _b.pool,
            });
        }
        const id = this.pubsub.subscribe('destroy', () => {
            this.pubsub.unsubscribe(id);
            this.logger.debug('Destroying PostgreSQL pool');
            pgPool.end();
        });
        const cacheKey = this.name + '_introspection.json';
        const dummyCacheFilePath = path.join(tmpdir(), cacheKey);
        let cachedIntrospection = await this.pgCache.get();
        let writeCache;
        const appendPlugins = await Promise.all((this.config.appendPlugins || []).map(pluginName => loadFromModuleExportExpression(pluginName, {
            cwd: this.baseDir,
            importFn: this.importFn,
            defaultExportName: 'default',
        })));
        const skipPlugins = await Promise.all((this.config.skipPlugins || []).map(pluginName => loadFromModuleExportExpression(pluginName, {
            cwd: this.baseDir,
            importFn: this.importFn,
            defaultExportName: 'default',
        })));
        const options = await loadFromModuleExportExpression(this.config.options, {
            cwd: this.baseDir,
            importFn: this.importFn,
            defaultExportName: 'default',
        });
        const builder = await getPostGraphileBuilder(pgPool, this.config.schemaName || 'public', {
            dynamicJson: true,
            subscriptions: 'subscriptions' in this.config ? this.config.subscriptions : true,
            live: 'live' in this.config ? this.config.live : true,
            readCache: cachedIntrospection,
            writeCache: !cachedIntrospection && dummyCacheFilePath,
            setWriteCacheCallback: fn => {
                writeCache = fn;
            },
            appendPlugins,
            skipPlugins,
            simpleCollections: 'both',
            ...options,
        });
        const schema = builder.buildSchema();
        const defaultExecutor = createDefaultExecutor(schema);
        if (!cachedIntrospection) {
            await writeCache();
            cachedIntrospection = await import(dummyCacheFilePath);
            await this.pgCache.set(cachedIntrospection);
        }
        return {
            schema,
            executor({ document, variables, context: meshContext, rootValue, operationName, extensions, }) {
                return withPostGraphileContext({
                    pgPool,
                    queryDocumentAst: document,
                    operationName,
                    variables,
                }, function withPgContextCallback(pgContext) {
                    return defaultExecutor({
                        document,
                        variables,
                        context: {
                            ...meshContext,
                            ...pgContext,
                        },
                        rootValue,
                        operationName,
                        extensions,
                    });
                });
            },
        };
    }
}