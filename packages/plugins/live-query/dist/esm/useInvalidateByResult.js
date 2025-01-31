import { getInterpolatedStringFactory, } from '@graphql-mesh/string-interpolation';
import { getArgumentValues, getOperationAST, TypeInfo, visit, visitWithTypeInfo } from 'graphql';
export function useInvalidateByResult(params) {
    const liveQueryInvalidationFactoryMap = new Map();
    params.invalidations.forEach(liveQueryInvalidation => {
        const rawInvalidationPaths = liveQueryInvalidation.invalidate;
        const factories = rawInvalidationPaths.map(rawInvalidationPath => getInterpolatedStringFactory(rawInvalidationPath));
        liveQueryInvalidationFactoryMap.set(liveQueryInvalidation.field, factories);
    });
    return {
        onExecute() {
            return {
                onExecuteDone({ args: executionArgs, result }) {
                    const { schema, document, operationName, variableValues, rootValue, contextValue } = executionArgs;
                    const operationAST = getOperationAST(document, operationName);
                    if (!operationAST) {
                        throw new Error(`Operation couldn't be found`);
                    }
                    const typeInfo = new TypeInfo(schema);
                    visit(operationAST, visitWithTypeInfo(typeInfo, {
                        Field: fieldNode => {
                            const parentType = typeInfo.getParentType();
                            const fieldDef = typeInfo.getFieldDef();
                            const path = `${parentType.name}.${fieldDef.name}`;
                            if (liveQueryInvalidationFactoryMap.has(path)) {
                                const invalidationPathFactories = liveQueryInvalidationFactoryMap.get(path);
                                const args = getArgumentValues(fieldDef, fieldNode, variableValues);
                                const invalidationPaths = invalidationPathFactories.map(invalidationPathFactory => invalidationPathFactory({
                                    root: rootValue,
                                    args,
                                    context: contextValue,
                                    env: process.env,
                                    result,
                                }));
                                params.pubsub.publish('live-query:invalidate', invalidationPaths);
                            }
                        },
                    }));
                },
            };
        },
    };
}
