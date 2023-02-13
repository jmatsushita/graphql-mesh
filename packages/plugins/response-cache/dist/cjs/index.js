"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const plugin_response_cache_1 = require("@graphql-yoga/plugin-response-cache");
const string_interpolation_1 = require("@graphql-mesh/string-interpolation");
const cross_helpers_1 = require("@graphql-mesh/cross-helpers");
const defaultBuildResponseCacheKey = async (params) => (0, string_interpolation_1.hashObject)(params);
function generateSessionIdFactory(sessionIdDef) {
    if (sessionIdDef == null) {
        return function voidSession() {
            return null;
        };
    }
    return function session(context) {
        return string_interpolation_1.stringInterpolator.parse(sessionIdDef, {
            context,
            env: cross_helpers_1.process.env,
        });
    };
}
function generateEnabledFactory(ifDef) {
    return function enabled(context) {
        // eslint-disable-next-line no-new-func
        return new Function(`return ${ifDef}`)();
    };
}
function getBuildResponseCacheKey(cacheKeyDef) {
    return function buildResponseCacheKey(cacheKeyParameters) {
        let cacheKey = string_interpolation_1.stringInterpolator.parse(cacheKeyDef, {
            ...cacheKeyParameters,
            env: cross_helpers_1.process.env,
        });
        if (!cacheKey) {
            cacheKey = defaultBuildResponseCacheKey(cacheKeyParameters);
        }
        return cacheKey;
    };
}
function getShouldCacheResult(shouldCacheResultDef) {
    return function shouldCacheResult({ result }) {
        // eslint-disable-next-line no-new-func
        return new Function(`return ${shouldCacheResultDef}`)();
    };
}
function getCacheForResponseCache(meshCache) {
    return {
        get(responseId) {
            return meshCache.get(`response-cache:${responseId}`);
        },
        async set(responseId, data, entities, ttl) {
            const ttlConfig = Number.isFinite(ttl) ? { ttl: ttl / 1000 } : undefined;
            await Promise.all([...entities].map(async ({ typename, id }) => {
                const entryId = `${typename}.${id}`;
                await meshCache.set(`response-cache:${entryId}:${responseId}`, {}, ttlConfig);
                await meshCache.set(`response-cache:${responseId}:${entryId}`, {}, ttlConfig);
            }));
            return meshCache.set(`response-cache:${responseId}`, data, ttlConfig);
        },
        async invalidate(entitiesToRemove) {
            const responseIdsToCheck = new Set();
            await Promise.all([...entitiesToRemove].map(async ({ typename, id }) => {
                const entryId = `${typename}.${id}`;
                const cacheEntriesToDelete = await meshCache.getKeysByPrefix(`response-cache:${entryId}:`);
                await Promise.all(cacheEntriesToDelete.map(cacheEntryName => {
                    const [, , responseId] = cacheEntryName.split(':');
                    responseIdsToCheck.add(responseId);
                    return meshCache.delete(entryId);
                }));
            }));
            await Promise.all([...responseIdsToCheck].map(async (responseId) => {
                const cacheEntries = await meshCache.getKeysByPrefix(`response-cache:${responseId}:`);
                if (cacheEntries.length === 0) {
                    await meshCache.delete(`response-cache:${responseId}`);
                }
            }));
        },
    };
}
function useMeshResponseCache(options) {
    const ttlPerType = {};
    const ttlPerSchemaCoordinate = {};
    if (options.ttlPerCoordinate) {
        for (const ttlConfig of options.ttlPerCoordinate) {
            if (ttlConfig.coordinate.includes('.')) {
                ttlPerSchemaCoordinate[ttlConfig.coordinate] = ttlConfig.ttl;
            }
            else {
                ttlPerType[ttlConfig.coordinate] = ttlConfig.ttl;
            }
        }
    }
    return (0, plugin_response_cache_1.useResponseCache)({
        ttl: options.ttl,
        ignoredTypes: options.ignoredTypes,
        idFields: options.idFields,
        invalidateViaMutation: options.invalidateViaMutation,
        includeExtensionMetadata: options.includeExtensionMetadata != null
            ? options.includeExtensionMetadata
            : cross_helpers_1.process.env.DEBUG === '1',
        ttlPerType,
        ttlPerSchemaCoordinate,
        session: generateSessionIdFactory(options.sessionId),
        enabled: options.if ? generateEnabledFactory(options.if) : undefined,
        buildResponseCacheKey: options.cacheKey
            ? getBuildResponseCacheKey(options.cacheKey)
            : undefined,
        shouldCacheResult: options.shouldCacheResult
            ? getShouldCacheResult(options.shouldCacheResult)
            : undefined,
        cache: getCacheForResponseCache(options.cache),
    });
}
exports.default = useMeshResponseCache;
