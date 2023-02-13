import { compileQuery, isCompiledQuery } from 'graphql-jit';
import { createLruCache, printWithCache } from '@graphql-mesh/utils';
import { getOperationASTFromRequest, memoize1, } from '@graphql-tools/utils';
const getLruCacheForSchema = memoize1(function getLruCacheForSchema(schema) {
    return createLruCache(1000, 3600);
});
export function createJITExecutor(schema, prefix, logger) {
    const lruCache = getLruCacheForSchema(schema);
    return function jitExecutor(request) {
        const { document, variables, context, operationName, rootValue } = request;
        const documentStr = printWithCache(document);
        logger.debug(`Executing ${documentStr}`);
        const cacheKey = [prefix, documentStr, operationName].join('_');
        let compiledQueryFn = lruCache.get(cacheKey);
        if (!compiledQueryFn) {
            logger.debug(`Compiling ${documentStr}`);
            const compiledQuery = compileQuery(schema, document, operationName);
            if (isCompiledQuery(compiledQuery)) {
                const { operation } = getOperationASTFromRequest(request);
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
