"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getInContextSDK = void 0;
const graphql_1 = require("graphql");
const utils_1 = require("@graphql-mesh/utils");
const batch_delegate_1 = require("@graphql-tools/batch-delegate");
const delegate_1 = require("@graphql-tools/delegate");
const utils_2 = require("@graphql-tools/utils");
const wrap_1 = require("@graphql-tools/wrap");
const constants_js_1 = require("./constants.js");
async function getInContextSDK(unifiedSchema, rawSources, logger, onDelegateHooks) {
    const inContextSDK = {};
    const sourceMap = unifiedSchema.extensions.sourceMap;
    for (const rawSource of rawSources) {
        const rawSourceLogger = logger.child(`${rawSource.name}`);
        const rawSourceContext = {
            rawSource,
            [constants_js_1.MESH_API_CONTEXT_SYMBOL]: true,
        };
        // TODO: Somehow rawSource reference got lost in somewhere
        let rawSourceSubSchemaConfig;
        const stitchingInfo = unifiedSchema.extensions.stitchingInfo;
        if (stitchingInfo) {
            for (const [subschemaConfig, subschema] of stitchingInfo.subschemaMap) {
                if (subschemaConfig.name === rawSource.name) {
                    rawSourceSubSchemaConfig = subschema;
                    break;
                }
            }
        }
        else {
            rawSourceSubSchemaConfig = rawSource;
        }
        // If there is a single source, there is no unifiedSchema
        const transformedSchema = sourceMap.get(rawSource);
        const rootTypes = {
            query: transformedSchema.getQueryType(),
            mutation: transformedSchema.getMutationType(),
            subscription: transformedSchema.getSubscriptionType(),
        };
        rawSourceLogger.debug(`Generating In Context SDK`);
        for (const operationType in rootTypes) {
            const rootType = rootTypes[operationType];
            if (rootType) {
                rawSourceContext[rootType.name] = {};
                const rootTypeFieldMap = rootType.getFields();
                for (const fieldName in rootTypeFieldMap) {
                    const rootTypeField = rootTypeFieldMap[fieldName];
                    const inContextSdkLogger = rawSourceLogger.child(`InContextSDK.${rootType.name}.${fieldName}`);
                    const namedReturnType = (0, graphql_1.getNamedType)(rootTypeField.type);
                    const shouldHaveSelectionSet = !(0, graphql_1.isLeafType)(namedReturnType);
                    rawSourceContext[rootType.name][fieldName] = async ({ root, args, context, info = {
                        fieldName,
                        fieldNodes: [],
                        returnType: namedReturnType,
                        parentType: rootType,
                        path: {
                            typename: rootType.name,
                            key: fieldName,
                            prev: undefined,
                        },
                        schema: transformedSchema,
                        fragments: {},
                        rootValue: root,
                        operation: {
                            kind: graphql_1.Kind.OPERATION_DEFINITION,
                            operation: operationType,
                            selectionSet: {
                                kind: graphql_1.Kind.SELECTION_SET,
                                selections: [],
                            },
                        },
                        variableValues: {},
                    }, selectionSet, key, argsFromKeys, valuesFromResults, }) => {
                        inContextSdkLogger.debug(`Called with`, {
                            args,
                            key,
                        });
                        const commonDelegateOptions = {
                            schema: rawSourceSubSchemaConfig,
                            rootValue: root,
                            operation: operationType,
                            fieldName,
                            context,
                            transformedSchema,
                            info,
                            transforms: [],
                        };
                        // If there isn't an extraction of a value
                        if (typeof selectionSet !== 'function') {
                            commonDelegateOptions.returnType = rootTypeField.type;
                        }
                        if (shouldHaveSelectionSet) {
                            let selectionCount = 0;
                            for (const fieldNode of info.fieldNodes) {
                                if (fieldNode.selectionSet != null) {
                                    selectionCount += fieldNode.selectionSet.selections.length;
                                }
                            }
                            if (selectionCount === 0) {
                                if (!selectionSet) {
                                    throw new Error(`You have to provide 'selectionSet' for context.${rawSource.name}.${rootType.name}.${fieldName}`);
                                }
                                commonDelegateOptions.info = {
                                    ...info,
                                    fieldNodes: [
                                        {
                                            ...info.fieldNodes[0],
                                            selectionSet: {
                                                kind: graphql_1.Kind.SELECTION_SET,
                                                selections: [
                                                    {
                                                        kind: graphql_1.Kind.FIELD,
                                                        name: {
                                                            kind: graphql_1.Kind.NAME,
                                                            value: '__typename',
                                                        },
                                                    },
                                                ],
                                            },
                                        },
                                        ...info.fieldNodes.slice(1),
                                    ],
                                };
                            }
                        }
                        if (key && argsFromKeys) {
                            const batchDelegationOptions = {
                                ...commonDelegateOptions,
                                key,
                                argsFromKeys,
                                valuesFromResults,
                            };
                            if (selectionSet) {
                                const selectionSetFactory = normalizeSelectionSetParamOrFactory(selectionSet);
                                const path = [fieldName];
                                const wrapQueryTransform = new wrap_1.WrapQuery(path, selectionSetFactory, identical);
                                batchDelegationOptions.transforms = [wrapQueryTransform];
                            }
                            const onDelegateHookDones = [];
                            for (const onDelegateHook of onDelegateHooks) {
                                const onDelegateDone = await onDelegateHook({
                                    ...batchDelegationOptions,
                                    sourceName: rawSource.name,
                                    typeName: rootType.name,
                                    fieldName,
                                });
                                if (onDelegateDone) {
                                    onDelegateHookDones.push(onDelegateDone);
                                }
                            }
                            let result = await (0, batch_delegate_1.batchDelegateToSchema)(batchDelegationOptions);
                            for (const onDelegateHookDone of onDelegateHookDones) {
                                await onDelegateHookDone({
                                    result,
                                    setResult(newResult) {
                                        result = newResult;
                                    },
                                });
                            }
                            return result;
                        }
                        else {
                            const regularDelegateOptions = {
                                ...commonDelegateOptions,
                                args,
                            };
                            if (selectionSet) {
                                const selectionSetFactory = normalizeSelectionSetParamOrFactory(selectionSet);
                                const path = [fieldName];
                                const wrapQueryTransform = new wrap_1.WrapQuery(path, selectionSetFactory, valuesFromResults || identical);
                                regularDelegateOptions.transforms = [wrapQueryTransform];
                            }
                            const onDelegateHookDones = [];
                            for (const onDelegateHook of onDelegateHooks) {
                                const onDelegateDone = await onDelegateHook({
                                    ...regularDelegateOptions,
                                    sourceName: rawSource.name,
                                    typeName: rootType.name,
                                    fieldName,
                                });
                                if (onDelegateDone) {
                                    onDelegateHookDones.push(onDelegateDone);
                                }
                            }
                            let result = await (0, delegate_1.delegateToSchema)(regularDelegateOptions);
                            for (const onDelegateHookDone of onDelegateHookDones) {
                                await onDelegateHookDone({
                                    result,
                                    setResult(newResult) {
                                        result = newResult;
                                    },
                                });
                            }
                            return result;
                        }
                    };
                }
            }
        }
        inContextSDK[rawSource.name] = rawSourceContext;
    }
    return inContextSDK;
}
exports.getInContextSDK = getInContextSDK;
function getSelectionSetFromDocumentNode(documentNode) {
    const operationDefinition = documentNode.definitions.find(definition => definition.kind === graphql_1.Kind.OPERATION_DEFINITION);
    if (!operationDefinition) {
        throw new Error('DocumentNode must contain an OperationDefinitionNode');
    }
    return operationDefinition.selectionSet;
}
function normalizeSelectionSetParam(selectionSetParam) {
    if (typeof selectionSetParam === 'string') {
        const documentNode = (0, utils_1.parseWithCache)(selectionSetParam);
        return getSelectionSetFromDocumentNode(documentNode);
    }
    if ((0, utils_2.isDocumentNode)(selectionSetParam)) {
        return getSelectionSetFromDocumentNode(selectionSetParam);
    }
    return selectionSetParam;
}
const normalizeSelectionSetParamFactory = (0, utils_2.memoize1)(function normalizeSelectionSetParamFactory(selectionSetParamFactory) {
    const memoizedSelectionSetFactory = (0, utils_2.memoize1)(selectionSetParamFactory);
    return function selectionSetFactory(subtree) {
        const selectionSetParam = memoizedSelectionSetFactory(subtree);
        return normalizeSelectionSetParam(selectionSetParam);
    };
});
function normalizeSelectionSetParamOrFactory(selectionSetParamOrFactory) {
    if (typeof selectionSetParamOrFactory === 'function') {
        return normalizeSelectionSetParamFactory(selectionSetParamOrFactory);
    }
    return () => normalizeSelectionSetParam(selectionSetParamOrFactory);
}
function identical(val) {
    return val;
}
