"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.useInvalidateByResult = void 0;
const string_interpolation_1 = require("@graphql-mesh/string-interpolation");
const graphql_1 = require("graphql");
function useInvalidateByResult(params) {
    const liveQueryInvalidationFactoryMap = new Map();
    params.invalidations.forEach(liveQueryInvalidation => {
        const rawInvalidationPaths = liveQueryInvalidation.invalidate;
        const factories = rawInvalidationPaths.map(rawInvalidationPath => (0, string_interpolation_1.getInterpolatedStringFactory)(rawInvalidationPath));
        liveQueryInvalidationFactoryMap.set(liveQueryInvalidation.field, factories);
    });
    return {
        onExecute() {
            return {
                onExecuteDone({ args: executionArgs, result }) {
                    const { schema, document, operationName, variableValues, rootValue, contextValue } = executionArgs;
                    const operationAST = (0, graphql_1.getOperationAST)(document, operationName);
                    if (!operationAST) {
                        throw new Error(`Operation couldn't be found`);
                    }
                    const typeInfo = new graphql_1.TypeInfo(schema);
                    (0, graphql_1.visit)(operationAST, (0, graphql_1.visitWithTypeInfo)(typeInfo, {
                        Field: fieldNode => {
                            const parentType = typeInfo.getParentType();
                            const fieldDef = typeInfo.getFieldDef();
                            const path = `${parentType.name}.${fieldDef.name}`;
                            if (liveQueryInvalidationFactoryMap.has(path)) {
                                const invalidationPathFactories = liveQueryInvalidationFactoryMap.get(path);
                                const args = (0, graphql_1.getArgumentValues)(fieldDef, fieldNode, variableValues);
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
exports.useInvalidateByResult = useInvalidateByResult;
