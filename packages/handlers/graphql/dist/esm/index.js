import { buildASTSchema, buildClientSchema, buildSchema, GraphQLSchema, Kind, print, } from 'graphql';
import lodashGet from 'lodash.get';
import { process, util } from '@graphql-mesh/cross-helpers';
import { PredefinedProxyOptions } from '@graphql-mesh/store';
import { getInterpolatedHeadersFactory, getInterpolatedStringFactory, parseInterpolationStrings, } from '@graphql-mesh/string-interpolation';
import { isUrl, loadFromModuleExportExpression, readFile, readFileOrUrl, readUrl, } from '@graphql-mesh/utils';
import { UrlLoader } from '@graphql-tools/url-loader';
import { getOperationASTFromRequest, isAsyncIterable, isDocumentNode, memoize1, parseSelectionSet, } from '@graphql-tools/utils';
import { schemaFromExecutor } from '@graphql-tools/wrap';
const getResolverData = memoize1(function getResolverData(params) {
    return {
        root: params.rootValue,
        args: params.variables,
        context: params.context,
        env: process.env,
    };
});
export default class GraphQLHandler {
    constructor({ name, config, baseDir, store, importFn, logger, }) {
        this.urlLoader = new UrlLoader();
        this.interpolationStringSet = new Set();
        this.name = name;
        this.config = config;
        this.baseDir = baseDir;
        this.nonExecutableSchema = store.proxy('introspectionSchema', PredefinedProxyOptions.GraphQLSchemaWithDiffing);
        this.importFn = importFn;
        this.logger = logger;
    }
    getArgsAndContextVariables() {
        return parseInterpolationStrings(this.interpolationStringSet);
    }
    wrapExecutorToPassSourceNameAndDebug(executor) {
        const sourceName = this.name;
        const logger = this.logger;
        return function executorWithSourceName(executionRequest) {
            logger.debug(() => `Sending GraphQL Request: `, print(executionRequest.document));
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
        const endpointFactory = getInterpolatedStringFactory(endpoint);
        const operationHeadersFactory = getInterpolatedHeadersFactory(operationHeaders);
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
            return buildSchema(sdlOrIntrospection, {
                assumeValid: true,
                assumeValidSDL: true,
            });
        }
        else if (isDocumentNode(sdlOrIntrospection)) {
            return buildASTSchema(sdlOrIntrospection, {
                assumeValid: true,
                assumeValidSDL: true,
            });
        }
        else if (sdlOrIntrospection.__schema) {
            return buildClientSchema(sdlOrIntrospection, {
                assumeValid: true,
            });
        }
        throw new Error(`Invalid introspection data: ${util.inspect(sdlOrIntrospection)}`);
    }
    async getNonExecutableSchemaForHTTPSource(httpSourceConfig) {
        this.interpolationStringSet.add(httpSourceConfig.endpoint);
        Object.keys(httpSourceConfig.schemaHeaders || {}).forEach(headerName => {
            this.interpolationStringSet.add(headerName.toString());
        });
        const schemaHeadersFactory = getInterpolatedHeadersFactory(httpSourceConfig.schemaHeaders || {});
        if (httpSourceConfig.source) {
            const opts = {
                cwd: this.baseDir,
                allowUnknownExtensions: true,
                importFn: this.importFn,
                fetch: this.fetchFn,
                logger: this.logger,
            };
            if (!isUrl(httpSourceConfig.source)) {
                return this.nonExecutableSchema.getWithSet(async () => {
                    const sdlOrIntrospection = await readFile(httpSourceConfig.source, opts);
                    return this.getSchemaFromContent(sdlOrIntrospection);
                });
            }
            const headers = schemaHeadersFactory({
                env: process.env,
            });
            const sdlOrIntrospection = await readUrl(httpSourceConfig.source, {
                ...opts,
                headers,
            });
            return this.getSchemaFromContent(sdlOrIntrospection);
        }
        return this.nonExecutableSchema.getWithSet(() => {
            const endpointFactory = getInterpolatedStringFactory(httpSourceConfig.endpoint);
            const executor = this.urlLoader.getExecutorAsync(httpSourceConfig.endpoint, {
                ...httpSourceConfig,
                customFetch: this.fetchFn,
                subscriptionsProtocol: httpSourceConfig.subscriptionsProtocol,
            });
            return schemaFromExecutor(function meshIntrospectionExecutor(params) {
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
            const rawSDL = await readFileOrUrl(schemaConfig, {
                cwd: this.baseDir,
                allowUnknownExtensions: true,
                importFn: this.importFn,
                fetch: this.fetchFn,
                logger: this.logger,
            });
            const schema = buildSchema(rawSDL, {
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
            const schemaOrStringOrDocumentNode = await loadFromModuleExportExpression(schemaConfig, { cwd: this.baseDir, defaultExportName: 'schema', importFn: this.importFn });
            let schema;
            if (schemaOrStringOrDocumentNode instanceof GraphQLSchema) {
                schema = schemaOrStringOrDocumentNode;
            }
            else if (typeof schemaOrStringOrDocumentNode === 'string') {
                schema = buildSchema(schemaOrStringOrDocumentNode, {
                    assumeValid: true,
                    assumeValidSDL: true,
                });
            }
            else if (typeof schemaOrStringOrDocumentNode === 'object' &&
                (schemaOrStringOrDocumentNode === null || schemaOrStringOrDocumentNode === void 0 ? void 0 : schemaOrStringOrDocumentNode.kind) === Kind.DOCUMENT) {
                schema = buildASTSchema(schemaOrStringOrDocumentNode, {
                    assumeValid: true,
                    assumeValidSDL: true,
                });
            }
            else {
                throw new Error(`Provided file '${schemaConfig} exports an unknown type: ${util.inspect(schemaOrStringOrDocumentNode)}': expected GraphQLSchema, SDL or DocumentNode.`);
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
                const parsedSelectionSet = parseSelectionSet(this.config.strategyConfig.selectionSet);
                const valuePath = this.config.strategyConfig.value;
                const highestValueExecutor = async function highestValueExecutor(executionRequest) {
                    const operationAST = getOperationASTFromRequest(executionRequest);
                    operationAST.selectionSet.selections.push(...parsedSelectionSet.selections);
                    const results = await Promise.all(executors.map(executor => executor(executionRequest)));
                    let highestValue = -Infinity;
                    let resultWithHighestResult = results[0];
                    for (const result of results) {
                        if (isAsyncIterable(result)) {
                            console.warn('Incremental delivery is not supported currently');
                            return result;
                        }
                        else if (result.data != null) {
                            const currentValue = lodashGet(result.data, valuePath);
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
                throw new Error(`Failed to fetch introspection from ${this.config.endpoint}: ${util.inspect(schemaResult.reason)}`);
            }
            if (executorResult.status === 'rejected') {
                throw new Error(`Failed to create executor for ${this.config.endpoint}: ${util.inspect(executorResult.reason)}`);
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
        throw new Error(`Unexpected config: ${util.inspect(this.config)}`);
    }
}
