import { getNamedType, isLeafType, Kind, } from 'graphql';
import { parseWithCache } from '@graphql-mesh/utils';
import { batchDelegateToSchema } from '@graphql-tools/batch-delegate';
import { delegateToSchema, } from '@graphql-tools/delegate';
import { isDocumentNode, memoize1 } from '@graphql-tools/utils';
import { WrapQuery } from '@graphql-tools/wrap';
import { MESH_API_CONTEXT_SYMBOL } from './constants.js';
export async function getInContextSDK(unifiedSchema, rawSources, logger, onDelegateHooks) {
    const inContextSDK = {};
    const sourceMap = unifiedSchema.extensions.sourceMap;
    for (const rawSource of rawSources) {
        const rawSourceLogger = logger.child(`${rawSource.name}`);
        const rawSourceContext = {
            rawSource,
            [MESH_API_CONTEXT_SYMBOL]: true,
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
                    const namedReturnType = getNamedType(rootTypeField.type);
                    const shouldHaveSelectionSet = !isLeafType(namedReturnType);
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
                            kind: Kind.OPERATION_DEFINITION,
                            operation: operationType,
                            selectionSet: {
                                kind: Kind.SELECTION_SET,
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
                                                kind: Kind.SELECTION_SET,
                                                selections: [
                                                    {
                                                        kind: Kind.FIELD,
                                                        name: {
                                                            kind: Kind.NAME,
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
                                const wrapQueryTransform = new WrapQuery(path, selectionSetFactory, identical);
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
                            let result = await batchDelegateToSchema(batchDelegationOptions);
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
                                const wrapQueryTransform = new WrapQuery(path, selectionSetFactory, valuesFromResults || identical);
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
                            let result = await delegateToSchema(regularDelegateOptions);
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
function getSelectionSetFromDocumentNode(documentNode) {
    const operationDefinition = documentNode.definitions.find(definition => definition.kind === Kind.OPERATION_DEFINITION);
    if (!operationDefinition) {
        throw new Error('DocumentNode must contain an OperationDefinitionNode');
    }
    return operationDefinition.selectionSet;
}
function normalizeSelectionSetParam(selectionSetParam) {
    if (typeof selectionSetParam === 'string') {
        const documentNode = parseWithCache(selectionSetParam);
        return getSelectionSetFromDocumentNode(documentNode);
    }
    if (isDocumentNode(selectionSetParam)) {
        return getSelectionSetFromDocumentNode(selectionSetParam);
    }
    return selectionSetParam;
}
const normalizeSelectionSetParamFactory = memoize1(function normalizeSelectionSetParamFactory(selectionSetParamFactory) {
    const memoizedSelectionSetFactory = memoize1(selectionSetParamFactory);
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
