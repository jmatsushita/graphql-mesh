import { getOperationAST, specifiedRules, validate, } from 'graphql';
import { envelop, useEngine, useExtendContext } from '@envelop/core';
import { OneOfInputObjectsRule, useExtendedValidation } from '@envelop/extended-validation';
import { process } from '@graphql-mesh/cross-helpers';
import { applySchemaTransforms, DefaultLogger, getHeadersObj, groupTransforms, parseWithCache, PubSub, } from '@graphql-mesh/utils';
import { Subschema } from '@graphql-tools/delegate';
import { AggregateError, getRootTypeMap, inspect, isAsyncIterable, mapAsyncIterator, memoize1, } from '@graphql-tools/utils';
import { fetch as defaultFetchFn } from '@whatwg-node/fetch';
import { MESH_CONTEXT_SYMBOL } from './constants.js';
import { getInContextSDK } from './in-context-sdk.js';
import { useSubschema } from './useSubschema.js';
const memoizedGetEnvelopedFactory = memoize1(function getEnvelopedFactory(plugins) {
    return envelop({
        plugins,
    });
});
const memoizedGetOperationType = memoize1((document) => {
    const operationAST = getOperationAST(document, undefined);
    if (!operationAST) {
        throw new Error('Must provide document with a valid operation');
    }
    return operationAST.operation;
});
export function wrapFetchWithPlugins(plugins) {
    return async function wrappedFetchFn(url, options, context, info) {
        if (url != null && typeof url !== 'string') {
            throw new TypeError(`First parameter(url) of 'fetch' must be a string, got ${inspect(url)}`);
        }
        if (options != null && typeof options !== 'object') {
            throw new TypeError(`Second parameter(options) of 'fetch' must be an object, got ${inspect(options)}`);
        }
        if (context != null && typeof context !== 'object') {
            throw new TypeError(`Third parameter(context) of 'fetch' must be an object, got ${inspect(context)}`);
        }
        if (info != null && typeof info !== 'object') {
            throw new TypeError(`Fourth parameter(info) of 'fetch' must be an object, got ${inspect(info)}`);
        }
        let fetchFn;
        const doneHooks = [];
        for (const plugin of plugins) {
            if ((plugin === null || plugin === void 0 ? void 0 : plugin.onFetch) != null) {
                const doneHook = await plugin.onFetch({
                    fetchFn,
                    setFetchFn(newFetchFn) {
                        fetchFn = newFetchFn;
                    },
                    url,
                    options,
                    context,
                    info,
                });
                if (doneHook) {
                    doneHooks.push(doneHook);
                }
            }
        }
        let response = await fetchFn(url, options, context, info);
        for (const doneHook of doneHooks) {
            await doneHook({
                response,
                setResponse(newResponse) {
                    response = newResponse;
                },
            });
        }
        return response;
    };
}
// Use in-context-sdk for tracing
function createProxyingResolverFactory(apiName, rootTypeMap) {
    return function createProxyingResolver({ operation }) {
        const rootType = rootTypeMap.get(operation);
        return function proxyingResolver(root, args, context, info) {
            var _a, _b;
            if (!((_b = (_a = context === null || context === void 0 ? void 0 : context[apiName]) === null || _a === void 0 ? void 0 : _a[rootType.name]) === null || _b === void 0 ? void 0 : _b[info.fieldName])) {
                throw new Error(`${info.fieldName} couldn't find in ${rootType.name} of ${apiName} as a ${operation}`);
            }
            return context[apiName][rootType.name][info.fieldName]({ root, args, context, info });
        };
    };
}
export async function getMesh(options) {
    const rawSources = [];
    const { pubsub = new PubSub(), cache, logger = new DefaultLogger('🕸️  Mesh'), additionalEnvelopPlugins = [], sources, merger, additionalResolvers = [], additionalTypeDefs = [], transforms = [], fetchFn = defaultFetchFn, } = options;
    const getMeshLogger = logger.child('GetMesh');
    getMeshLogger.debug(`Getting subschemas from source handlers`);
    let failed = false;
    const initialPluginList = [
        // TODO: Not a good practise to expect users to be a Yoga user
        useExtendContext(({ request, req }) => {
            // Maybe Node-like environment
            if (req === null || req === void 0 ? void 0 : req.headers) {
                return {
                    headers: req.headers,
                };
            }
            // Fetch environment
            if (request === null || request === void 0 ? void 0 : request.headers) {
                return {
                    headers: getHeadersObj(request.headers),
                };
            }
            return {};
        }),
        useExtendContext(() => ({
            pubsub,
            cache,
            logger,
            [MESH_CONTEXT_SYMBOL]: true,
        })),
        {
            onFetch({ setFetchFn }) {
                setFetchFn(fetchFn);
            },
        },
        {
            onParse({ setParseFn }) {
                setParseFn(parseWithCache);
            },
        },
        ...additionalEnvelopPlugins,
    ];
    const wrappedFetchFn = wrapFetchWithPlugins(initialPluginList);
    await Promise.allSettled(sources.map(async (apiSource) => {
        const apiName = apiSource.name;
        const sourceLogger = logger.child(apiName);
        sourceLogger.debug(`Generating the schema`);
        try {
            const source = await apiSource.handler.getMeshSource({
                fetchFn: wrappedFetchFn,
            });
            sourceLogger.debug(`The schema has been generated successfully`);
            let apiSchema = source.schema;
            sourceLogger.debug(`Analyzing transforms`);
            let transforms;
            const { wrapTransforms, noWrapTransforms } = groupTransforms(apiSource.transforms);
            if (!(wrapTransforms === null || wrapTransforms === void 0 ? void 0 : wrapTransforms.length) && (noWrapTransforms === null || noWrapTransforms === void 0 ? void 0 : noWrapTransforms.length)) {
                sourceLogger.debug(`${noWrapTransforms.length} bare transforms found and applying`);
                apiSchema = applySchemaTransforms(apiSchema, source, null, noWrapTransforms);
            }
            else {
                transforms = apiSource.transforms;
            }
            const rootTypeMap = getRootTypeMap(apiSchema);
            rawSources.push({
                name: apiName,
                schema: apiSchema,
                executor: source.executor,
                transforms,
                contextVariables: source.contextVariables || {},
                handler: apiSource.handler,
                batch: 'batch' in source ? source.batch : true,
                merge: source.merge,
                createProxyingResolver: createProxyingResolverFactory(apiName, rootTypeMap),
            });
        }
        catch (e) {
            sourceLogger.error(`Failed to generate the schema`, e);
            failed = true;
        }
    }));
    if (failed) {
        throw new Error(`Schemas couldn't be generated successfully. Check for the logs by running Mesh${process.env.DEBUG == null
            ? ' with DEBUG=1 environmental variable to get more verbose output'
            : ''}.`);
    }
    getMeshLogger.debug(`Schemas have been generated by the source handlers`);
    getMeshLogger.debug(`Merging schemas using the defined merging strategy.`);
    const unifiedSubschema = await merger.getUnifiedSchema({
        rawSources,
        typeDefs: additionalTypeDefs,
        resolvers: additionalResolvers,
    });
    unifiedSubschema.transforms = unifiedSubschema.transforms || [];
    for (const rootLevelTransform of transforms) {
        if (rootLevelTransform.noWrap) {
            if (rootLevelTransform.transformSchema) {
                unifiedSubschema.schema = rootLevelTransform.transformSchema(unifiedSubschema.schema, unifiedSubschema);
            }
        }
        else {
            unifiedSubschema.transforms.push(rootLevelTransform);
        }
    }
    let inContextSDK$;
    const subschema = new Subschema(unifiedSubschema);
    const plugins = [
        useEngine({
            validate,
            specifiedRules,
        }),
        useSubschema(subschema),
        useExtendContext(() => {
            if (!inContextSDK$) {
                const onDelegateHooks = [];
                for (const plugin of initialPluginList) {
                    if ((plugin === null || plugin === void 0 ? void 0 : plugin.onDelegate) != null) {
                        onDelegateHooks.push(plugin.onDelegate);
                    }
                }
                inContextSDK$ = getInContextSDK(subschema.transformedSchema, rawSources, logger, onDelegateHooks);
            }
            return inContextSDK$;
        }),
        useExtendedValidation({
            rules: [OneOfInputObjectsRule],
        }),
        ...initialPluginList,
    ];
    const EMPTY_ROOT_VALUE = {};
    const EMPTY_CONTEXT_VALUE = {};
    const EMPTY_VARIABLES_VALUE = {};
    function createExecutor(globalContext = EMPTY_CONTEXT_VALUE) {
        const getEnveloped = memoizedGetEnvelopedFactory(plugins);
        const { schema, parse, execute, subscribe, contextFactory } = getEnveloped(globalContext);
        return async function meshExecutor(documentOrSDL, variableValues = EMPTY_VARIABLES_VALUE, contextValue = EMPTY_CONTEXT_VALUE, rootValue = EMPTY_ROOT_VALUE, operationName) {
            const document = typeof documentOrSDL === 'string' ? parse(documentOrSDL) : documentOrSDL;
            const executeFn = memoizedGetOperationType(document) === 'subscription' ? subscribe : execute;
            return executeFn({
                schema,
                document,
                contextValue: await contextFactory(contextValue),
                rootValue,
                variableValues: variableValues,
                operationName,
            });
        };
    }
    function sdkRequesterFactory(globalContext) {
        const executor = createExecutor(globalContext);
        return async function sdkRequester(...args) {
            const result = await executor(...args);
            if (isAsyncIterable(result)) {
                return mapAsyncIterator(result, extractDataOrThrowErrors);
            }
            return extractDataOrThrowErrors(result);
        };
    }
    function meshDestroy() {
        return pubsub.publish('destroy', undefined);
    }
    return {
        get schema() {
            return subschema.transformedSchema;
        },
        rawSources,
        cache,
        pubsub,
        destroy: meshDestroy,
        logger,
        plugins,
        get getEnveloped() {
            return memoizedGetEnvelopedFactory(plugins);
        },
        createExecutor,
        get execute() {
            return createExecutor();
        },
        get subscribe() {
            return createExecutor();
        },
        sdkRequesterFactory,
    };
}
function extractDataOrThrowErrors(result) {
    if (result.errors) {
        if (result.errors.length === 1) {
            throw result.errors[0];
        }
        throw new AggregateError(result.errors);
    }
    return result.data;
}
