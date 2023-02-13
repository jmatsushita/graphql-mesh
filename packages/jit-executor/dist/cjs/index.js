"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createJITExecutor = void 0;
const graphql_jit_1 = require("graphql-jit");
const utils_1 = require("@graphql-mesh/utils");
const utils_2 = require("@graphql-tools/utils");
const getLruCacheForSchema = (0, utils_2.memoize1)(function getLruCacheForSchema(schema) {
    return (0, utils_1.createLruCache)(1000, 3600);
});
function createJITExecutor(schema, prefix, logger) {
    const lruCache = getLruCacheForSchema(schema);
    return function jitExecutor(request) {
        const { document, variables, context, operationName, rootValue } = request;
        const documentStr = (0, utils_1.printWithCache)(document);
        logger.debug(`Executing ${documentStr}`);
        const cacheKey = [prefix, documentStr, operationName].join('_');
        let compiledQueryFn = lruCache.get(cacheKey);
        if (!compiledQueryFn) {
            logger.debug(`Compiling ${documentStr}`);
            const compiledQuery = (0, graphql_jit_1.compileQuery)(schema, document, operationName);
            if ((0, graphql_jit_1.isCompiledQuery)(compiledQuery)) {
                const { operation } = (0, utils_2.getOperationASTFromRequest)(request);
                if (operation === 'subscription') {
                    compiledQueryFn = compiledQuery.subscribe.bind(compiledQuery);
                }
                else {
                    compiledQueryFn = compiledQuery.query.bind(compiledQuery);
                }
            }
            else {
                compiledQueryFn = () => compiledQuery;
            }
            lruCache.set(cacheKey, compiledQueryFn);
        }
        else {
            logger.debug(`Compiled version found for ${documentStr}`);
        }
        return compiledQueryFn(rootValue, context, variables);
    };
}
exports.createJITExecutor = createJITExecutor;
