import { applyRequestTransforms, applyResultTransforms } from '@graphql-mesh/utils';
import { createDefaultExecutor, applySchemaTransforms, } from '@graphql-tools/delegate';
import { getDefinedRootType, getOperationASTFromRequest, isAsyncIterable, } from '@graphql-tools/utils';
import { mapAsyncIterator } from '@envelop/core';
import { BREAK, execute, visit } from 'graphql';
import { createBatchingExecutor } from '@graphql-tools/batch-execute';
function isIntrospectionOperation(operationAST) {
    let isIntrospectionOperation = false;
    visit(operationAST, {
        Field: node => {
            if (node.name.value === '__schema' || node.name.value === '__type') {
                isIntrospectionOperation = true;
                return BREAK;
            }
        },
    });
    return isIntrospectionOperation;
}
function getExecuteFn(subschema) {
    return async function subschemaExecute(args) {
        var _a;
        const originalRequest = {
            document: args.document,
            variables: args.variableValues,
            operationName: (_a = args.operationName) !== null && _a !== void 0 ? _a : undefined,
            rootValue: args.rootValue,
            context: args.contextValue,
        };
        const operationAST = getOperationASTFromRequest(originalRequest);
        // TODO: We need more elegant solution
        if (isIntrospectionOperation(operationAST)) {
            return execute(args);
        }
        const delegationContext = {
            subschema,
            subschemaConfig: subschema,
            targetSchema: args.schema,
            operation: operationAST.operation,
            fieldName: '',
            context: args.contextValue,
            rootValue: args.rootValue,
            transforms: subschema.transforms,
            transformedSchema: subschema.transformedSchema,
            skipTypeMerging: true,
            returnType: getDefinedRootType(args.schema, operationAST.operation),
        };
        let executor = subschema.executor;
        if (executor == null) {
            executor = createDefaultExecutor(subschema.schema);
        }
        if (subschema.batch) {
            executor = createBatchingExecutor(executor);
        }
        const transformationContext = {};
        const transformedRequest = applyRequestTransforms(originalRequest, delegationContext, transformationContext, subschema.transforms);
        const originalResult = await executor(transformedRequest);
        if (isAsyncIterable(originalResult)) {
            return mapAsyncIterator(originalResult, singleResult => applyResultTransforms(singleResult, delegationContext, transformationContext, subschema.transforms));
        }
        const transformedResult = applyResultTransforms(originalResult, delegationContext, transformationContext, subschema.transforms);
        return transformedResult;
    };
}
// Creates an envelop plugin to execute a subschema inside Envelop
export function useSubschema(subschema) {
    const executeFn = getExecuteFn(subschema);
    const plugin = {
        onPluginInit({ setSchema }) {
            // To prevent unwanted warnings from stitching
            if (!('_transformedSchema' in subschema)) {
                subschema.transformedSchema = applySchemaTransforms(subschema.schema, subschema);
            }
            subschema.transformedSchema.extensions =
                subschema.transformedSchema.extensions || subschema.schema.extensions || {};
            Object.assign(subschema.transformedSchema.extensions, subschema.schema.extensions);
            setSchema(subschema.transformedSchema);
        },
        onExecute({ setExecuteFn }) {
            setExecuteFn(executeFn);
        },
        onSubscribe({ setSubscribeFn }) {
            setSubscribeFn(executeFn);
        },
    };
    return plugin;
}
