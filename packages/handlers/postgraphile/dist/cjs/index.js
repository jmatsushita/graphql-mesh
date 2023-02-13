"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const postgraphile_1 = require("postgraphile");
const postgraphile_core_1 = require("postgraphile-core");
const pg_1 = tslib_1.__importDefault(require("pg"));
const cross_helpers_1 = require("@graphql-mesh/cross-helpers");
// eslint-disable-next-line import/no-nodejs-modules
const os_1 = require("os");
const string_interpolation_1 = require("@graphql-mesh/string-interpolation");
const utils_1 = require("@graphql-mesh/utils");
const store_1 = require("@graphql-mesh/store");
const delegate_1 = require("@graphql-tools/delegate");
class PostGraphileHandler {
    constructor({ name, config, baseDir, pubsub, store, logger, importFn, }) {
        this.name = name;
        this.config = config;
        this.baseDir = baseDir;
        this.pubsub = pubsub;
        this.pgCache = store.proxy('pgCache.json', store_1.PredefinedProxyOptions.JsonWithoutValidation);
        this.logger = logger;
        this.importFn = importFn;
    }
    async getMeshSource() {
        var _a;
        var _b, _c;
        let pgPool;
        if (typeof ((_b = this.config) === null || _b === void 0 ? void 0 : _b.pool) === 'string') {
            pgPool = await (0, utils_1.loadFromModuleExportExpression)(this.config.pool, {
                cwd: this.baseDir,
                importFn: this.importFn,
                defaultExportName: 'default',
            });
        }
        if (!pgPool || !('connect' in pgPool)) {
            const pgLogger = this.logger.child('PostgreSQL');
            pgPool = new pg_1.default.Pool({
                connectionString: string_interpolation_1.stringInterpolator.parse(this.config.connectionString, {
                    env: cross_helpers_1.process.env,
                }),
                log: messages => pgLogger.debug(messages),
                ...(_c = this.config) === null || _c === void 0 ? void 0 : _c.pool,
            });
        }
        const id = this.pubsub.subscribe('destroy', () => {
            this.pubsub.unsubscribe(id);
            this.logger.debug('Destroying PostgreSQL pool');
            pgPool.end();
        });
        const cacheKey = this.name + '_introspection.json';
        const dummyCacheFilePath = cross_helpers_1.path.join((0, os_1.tmpdir)(), cacheKey);
        let cachedIntrospection = await this.pgCache.get();
        let writeCache;
        const appendPlugins = await Promise.all((this.config.appendPlugins || []).map(pluginName => (0, utils_1.loadFromModuleExportExpression)(pluginName, {
            cwd: this.baseDir,
            importFn: this.importFn,
            defaultExportName: 'default',
        })));
        const skipPlugins = await Promise.all((this.config.skipPlugins || []).map(pluginName => (0, utils_1.loadFromModuleExportExpression)(pluginName, {
            cwd: this.baseDir,
            importFn: this.importFn,
            defaultExportName: 'default',
        })));
        const options = await (0, utils_1.loadFromModuleExportExpression)(this.config.options, {
            cwd: this.baseDir,
            importFn: this.importFn,
            defaultExportName: 'default',
        });
        const builder = await (0, postgraphile_core_1.getPostGraphileBuilder)(pgPool, this.config.schemaName || 'public', {
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
        const defaultExecutor = (0, delegate_1.createDefaultExecutor)(schema);
        if (!cachedIntrospection) {
            await writeCache();
            cachedIntrospection = await (_a = dummyCacheFilePath, Promise.resolve().then(() => tslib_1.__importStar(require(_a))));
            await this.pgCache.set(cachedIntrospection);
        }
        return {
            schema,
            executor({ document, variables, context: meshContext, rootValue, operationName, extensions, }) {
                return (0, postgraphile_1.withPostGraphileContext)({
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
exports.default = PostGraphileHandler;
