"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const graphql_1 = require("graphql");
const lodash_get_1 = tslib_1.__importDefault(require("lodash.get"));
const cross_helpers_1 = require("@graphql-mesh/cross-helpers");
const store_1 = require("@graphql-mesh/store");
const string_interpolation_1 = require("@graphql-mesh/string-interpolation");
const utils_1 = require("@graphql-mesh/utils");
const url_loader_1 = require("@graphql-tools/url-loader");
const utils_2 = require("@graphql-tools/utils");
const wrap_1 = require("@graphql-tools/wrap");
const getResolverData = (0, utils_2.memoize1)(function getResolverData(params) {
    return {
        root: params.rootValue,
        args: params.variables,
        context: params.context,
        env: cross_helpers_1.process.env,
    };
});
class GraphQLHandler {
    constructor({ name, config, baseDir, store, importFn, logger, }) {
        this.urlLoader = new url_loader_1.UrlLoader();
        this.interpolationStringSet = new Set();
        this.name = name;
        this.config = config;
        this.baseDir = baseDir;
        this.nonExecutableSchema = store.proxy('introspectionSchema', store_1.PredefinedProxyOptions.GraphQLSchemaWithDiffing);
        this.importFn = importFn;
        this.logger = logger;
    }
    getArgsAndContextVariables() {
        return (0, string_interpolation_1.parseInterpolationStrings)(this.interpolationStringSet);
    }
    wrapExecutorToPassSourceNameAndDebug(executor) {
        const sourceName = this.name;
        const logger = this.logger;
        return function executorWithSourceName(executionRequest) {
            logger.debug(() => `Sending GraphQL Request: `, (0, graphql_1.print)(executionRequest.document));
            executionRequest.info = executionRequest.info || {};
            executionRequest.info.sourceName = sourceName;
            return executor(executionRequest);
        };
    }
    async getExecutorForHTTPSourceConfig(httpSourceConfig) {
        const { endpoint, operationHeaders = {} } = httpSourceConfig;
        this.interpolationStringSet.add(endpoint);
        Object.keys(operationHeaders).forEach(headerName => {
            this.interpolationStringSet.add(headerName.toString());
        });
        const endpointFactory = (0, string_interpolation_1.getInterpolatedStringFactory)(endpoint);
        const operationHeadersFactory = (0, string_interpolation_1.getInterpolatedHeadersFactory)(operationHeaders);
        const executor = this.urlLoader.getExecutorAsync(endpoint, {
            ...httpSourceConfig,
            subscriptionsProtocol: httpSourceConfig.subscriptionsProtocol,
            customFetch: this.fetchFn,
        });
        return function meshExecutor(params) {
            const resolverData = getResolverData(params);
            return executor({
                ...params,
                extensions: {
                    ...params.extensions,
                    headers: operationHeadersFactory(resolverData),
                    endpoint: endpointFactory(resolverData),
                },
            });
        };
    }
    getSchemaFromContent(sdlOrIntrospection) {
        if (typeof sdlOrIntrospection === 'string') {
            return (0, graphql_1.buildSchema)(sdlOrIntrospection, {
                assumeValid: true,
                assumeValidSDL: true,
            });
        }
        else if ((0, utils_2.isDocumentNode)(sdlOrIntrospection)) {
            return (0, graphql_1.buildASTSchema)(sdlOrIntrospection, {
                assumeValid: true,
                assumeValidSDL: true,
            });
        }
        else if (sdlOrIntrospection.__schema) {
            return (0, graphql_1.buildClientSchema)(sdlOrIntrospection, {
                assumeValid: true,
            });
        }
        throw new Error(`Invalid introspection data: ${cross_helpers_1.util.inspect(sdlOrIntrospection)}`);
    }
    async getNonExecutableSchemaForHTTPSource(httpSourceConfig) {
        this.interpolationStringSet.add(httpSourceConfig.endpoint);
        Object.keys(httpSourceConfig.schemaHeaders || {}).forEach(headerName => {
            this.interpolationStringSet.add(headerName.toString());
        });
        const schemaHeadersFactory = (0, string_interpolation_1.getInterpolatedHeadersFactory)(httpSourceConfig.schemaHeaders || {});
        if (httpSourceConfig.source) {
            const opts = {
                cwd: this.baseDir,
                allowUnknownExtensions: true,
                importFn: this.importFn,
                fetch: this.fetchFn,
                logger: this.logger,
            };
            if (!(0, utils_1.isUrl)(httpSourceConfig.source)) {
                return this.nonExecutableSchema.getWithSet(async () => {
                    const sdlOrIntrospection = await (0, utils_1.readFile)(httpSourceConfig.source, opts);
                    return this.getSchemaFromContent(sdlOrIntrospection);
                });
            }
            const headers = schemaHeadersFactory({
                env: cross_helpers_1.process.env,
            });
            const sdlOrIntrospection = await (0, utils_1.readUrl)(httpSourceConfig.source, {
                ...opts,
                headers,
            });
            return this.getSchemaFromContent(sdlOrIntrospection);
        }
        return this.nonExecutableSchema.getWithSet(() => {
            const endpointFactory = (0, string_interpolation_1.getInterpolatedStringFactory)(httpSourceConfig.endpoint);
            const executor = this.urlLoader.getExecutorAsync(httpSourceConfig.endpoint, {
                ...httpSourceConfig,
                customFetch: this.fetchFn,
                subscriptionsProtocol: httpSourceConfig.subscriptionsProtocol,
            });
            return (0, wrap_1.schemaFromExecutor)(function meshIntrospectionExecutor(params) {
                const resolverData = getResolverData(params);
                return executor({
                    ...params,
                    extensions: {
                        ...params.extensions,
                        headers: schemaHeadersFactory(resolverData),
                        endpoint: endpointFactory(resolverData),
                    },
                });
            });
        });
    }
    async getCodeFirstSource({ source: schemaConfig, }) {
        if (schemaConfig.endsWith('.graphql')) {
            const rawSDL = await (0, utils_1.readFileOrUrl)(schemaConfig, {
                cwd: this.baseDir,
                allowUnknownExtensions: true,
                importFn: this.importFn,
                fetch: this.fetchFn,
                logger: this.logger,
            });
            const schema = (0, graphql_1.buildSchema)(rawSDL, {
                assumeValid: true,
                assumeValidSDL: true,
            });
            const { contextVariables } = this.getArgsAndContextVariables();
            return {
                schema,
                contextVariables,
            };
        }
        else {
            // Loaders logic should be here somehow
            const schemaOrStringOrDocumentNode = await (0, utils_1.loadFromModuleExportExpression)(schemaConfig, { cwd: this.baseDir, defaultExportName: 'schema', importFn: this.importFn });
            let schema;
            if (schemaOrStringOrDocumentNode instanceof graphql_1.GraphQLSchema) {
                schema = schemaOrStringOrDocumentNode;
            }
            else if (typeof schemaOrStringOrDocumentNode === 'string') {
                schema = (0, graphql_1.buildSchema)(schemaOrStringOrDocumentNode, {
                    assumeValid: true,
                    assumeValidSDL: true,
                });
            }
            else if (typeof schemaOrStringOrDocumentNode === 'object' &&
                (schemaOrStringOrDocumentNode === null || schemaOrStringOrDocumentNode === void 0 ? void 0 : schemaOrStringOrDocumentNode.kind) === graphql_1.Kind.DOCUMENT) {
                schema = (0, graphql_1.buildASTSchema)(schemaOrStringOrDocumentNode, {
                    assumeValid: true,
                    assumeValidSDL: true,
                });
            }
            else {
                throw new Error(`Provided file '${schemaConfig} exports an unknown type: ${cross_helpers_1.util.inspect(schemaOrStringOrDocumentNode)}': expected GraphQLSchema, SDL or DocumentNode.`);
            }
            const { contextVariables } = this.getArgsAndContextVariables();
            return {
                schema,
                contextVariables,
            };
        }
    }
    getRaceExecutor(executors) {
        return function raceExecutor(params) {
            return Promise.race(executors.map(executor => executor(params)));
        };
    }
    getFallbackExecutor(executors) {
        return async function fallbackExecutor(params) {
            var _a;
            let error;
            let response;
            for (const executor of executors) {
                try {
                    const executorResponse = await executor(params);
                    if ('errors' in executorResponse && ((_a = executorResponse.errors) === null || _a === void 0 ? void 0 : _a.length)) {
                        response = executorResponse;
                        continue;
                    }
                    else {
                        return executorResponse;
                    }
                }
                catch (e) {
                    error = e;
                }
            }
            if (response != null) {
                return response;
            }
            throw error;
        };
    }
    async getMeshSource({ fetchFn }) {
        this.fetchFn = fetchFn;
        if ('sources' in this.config) {
            if (this.config.strategy === 'race') {
                const schemaPromises = [];
                const executorPromises = [];
                let batch = true;
                for (const httpSourceConfig of this.config.sources) {
                    if (httpSourceConfig.batch === false) {
                        batch = false;
                    }
                    schemaPromises.push(this.getNonExecutableSchemaForHTTPSource(httpSourceConfig));
                    executorPromises.push(this.getExecutorForHTTPSourceConfig(httpSourceConfig));
                }
                const [schema, ...executors] = await Promise.all([
                    Promise.race(schemaPromises),
                    ...executorPromises,
                ]);
                const executor = this.getRaceExecutor(executors);
                const { contextVariables } = this.getArgsAndContextVariables();
                return {
                    schema,
                    executor,
                    batch,
                    contextVariables,
                };
            }
            else if (this.config.strategy === 'highestValue') {
                if (this.config.strategyConfig == null) {
                    throw new Error(`You must configure 'highestValue' strategy`);
                }
                let schema;
                const executorPromises = [];
                let error;
                for (const httpSourceConfig of this.config.sources) {
                    executorPromises.push(this.getExecutorForHTTPSourceConfig(httpSourceConfig));
                    if (schema == null) {
                        try {
                            schema = await this.getNonExecutableSchemaForHTTPSource(httpSourceConfig);
                        }
                        catch (e) {
                            error = e;
                        }
                    }
                }
                if (schema == null) {
                    throw error;
                }
                const executors = await Promise.all(executorPromises);
                const parsedSelectionSet = (0, utils_2.parseSelectionSet)(this.config.strategyConfig.selectionSet);
                const valuePath = this.config.strategyConfig.value;
                const highestValueExecutor = async function highestValueExecutor(executionRequest) {
                    const operationAST = (0, utils_2.getOperationASTFromRequest)(executionRequest);
                    operationAST.selectionSet.selections.push(...parsedSelectionSet.selections);
                    const results = await Promise.all(executors.map(executor => executor(executionRequest)));
                    let highestValue = -Infinity;
                    let resultWithHighestResult = results[0];
                    for (const result of results) {
                        if ((0, utils_2.isAsyncIterable)(result)) {
                            console.warn('Incremental delivery is not supported currently');
                            return result;
                        }
                        else if (result.data != null) {
                            const currentValue = (0, lodash_get_1.default)(result.data, valuePath);
                            if (currentValue > highestValue) {
                                resultWithHighestResult = result;
                                highestValue = currentValue;
                            }
                        }
                    }
                    return resultWithHighestResult;
                };
                const { contextVariables } = this.getArgsAndContextVariables();
                return {
                    schema,
                    executor: this.wrapExecutorToPassSourceNameAndDebug(highestValueExecutor),
                    // Batching doesn't make sense with fallback strategy
                    batch: false,
                    contextVariables,
                };
            }
            else {
                let schema;
                const executorPromises = [];
                let error;
                for (const httpSourceConfig of this.config.sources) {
                    executorPromises.push(this.getExecutorForHTTPSourceConfig(httpSourceConfig));
                    if (schema == null) {
                        try {
                            schema = await this.getNonExecutableSchemaForHTTPSource(httpSourceConfig);
                        }
                        catch (e) {
                            error = e;
                        }
                    }
                }
                if (schema == null) {
                    throw error;
                }
                const executors = await Promise.all(executorPromises);
                const executor = this.getFallbackExecutor(executors);
                const { contextVariables } = this.getArgsAndContextVariables();
                return {
                    schema,
                    executor,
                    // Batching doesn't make sense with fallback strategy
                    batch: false,
                    contextVariables,
                };
            }
        }
        else if ('endpoint' in this.config) {
            const [schemaResult, executorResult] = await Promise.allSettled([
                this.getNonExecutableSchemaForHTTPSource(this.config),
                this.getExecutorForHTTPSourceConfig(this.config),
            ]);
            if (schemaResult.status === 'rejected') {
                throw new Error(`Failed to fetch introspection from ${this.config.endpoint}: ${cross_helpers_1.util.inspect(schemaResult.reason)}`);
            }
            if (executorResult.status === 'rejected') {
                throw new Error(`Failed to create executor for ${this.config.endpoint}: ${cross_helpers_1.util.inspect(executorResult.reason)}`);
            }
            const { contextVariables } = this.getArgsAndContextVariables();
            return {
                schema: schemaResult.value,
                executor: this.wrapExecutorToPassSourceNameAndDebug(executorResult.value),
                batch: this.config.batch != null ? this.config.batch : true,
                contextVariables,
            };
        }
        else if ('source' in this.config) {
            return this.getCodeFirstSource(this.config);
        }
        throw new Error(`Unexpected config: ${cross_helpers_1.util.inspect(this.config)}`);
    }
}
exports.default = GraphQLHandler;
