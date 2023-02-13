"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const resolvers_composition_1 = require("@graphql-tools/resolvers-composition");
const compute_cache_key_js_1 = require("./compute-cache-key.js");
const utils_1 = require("@graphql-mesh/utils");
const schema_1 = require("@graphql-tools/schema");
class CacheTransform {
    constructor(options) {
        this.options = options;
        this.noWrap = true;
        this.shouldWaitLocal = {};
    }
    transformSchema(schema) {
        var _a;
        const { config, cache } = this.options;
        const sourceResolvers = (0, utils_1.extractResolvers)(schema);
        const compositions = {};
        for (const cacheItem of config) {
            const effectingOperations = ((_a = cacheItem.invalidate) === null || _a === void 0 ? void 0 : _a.effectingOperations) || [];
            for (const { operation, matchKey } of effectingOperations) {
                compositions[operation] = originalResolver => async (root, args, context, info) => {
                    const result = await originalResolver(root, args, context, info);
                    const cacheKey = (0, compute_cache_key_js_1.computeCacheKey)({
                        keyStr: matchKey,
                        args,
                        info,
                    });
                    await cache.delete(cacheKey);
                    return result;
                };
            }
            compositions[cacheItem.field] = originalResolver => async (root, args, context, info) => {
                var _a, _b;
                const cacheKey = (0, compute_cache_key_js_1.computeCacheKey)({
                    keyStr: cacheItem.cacheKey,
                    args,
                    info,
                });
                const cachedValue = await cache.get(cacheKey);
                if (cachedValue) {
                    return cachedValue;
                }
                const shouldWaitCacheKey = `${cacheKey}_shouldWait`;
                const pubsubTopic = `${cacheKey}_resolved`;
                const shouldWait = await this.shouldWait(shouldWaitCacheKey);
                if (shouldWait) {
                    return this.waitAndReturn(pubsubTopic);
                }
                this.setShouldWait(shouldWaitCacheKey);
                try {
                    const result = await originalResolver(root, args, context, info);
                    await cache.set(cacheKey, result, {
                        ttl: (_a = cacheItem.invalidate) === null || _a === void 0 ? void 0 : _a.ttl,
                    });
                    // do not await setting the cache here, otherwise we would delay returnig the result unnecessarily
                    // instead await as part of shouldWait cleanup
                    const setCachePromise = this.options.cache.set(cacheKey, result, {
                        ttl: (_b = cacheItem.invalidate) === null || _b === void 0 ? void 0 : _b.ttl,
                    });
                    // do not wait for cleanup to complete
                    this.cleanupShouldWait({
                        shouldWaitCacheKey,
                        pubsubTopic,
                        data: { result },
                        setCachePromise,
                    });
                    return result;
                }
                catch (error) {
                    this.cleanupShouldWait({
                        shouldWaitCacheKey,
                        pubsubTopic,
                        data: { error },
                    });
                    throw error;
                }
            };
        }
        const wrappedResolvers = (0, resolvers_composition_1.composeResolvers)(sourceResolvers, compositions);
        return (0, schema_1.addResolversToSchema)({
            schema,
            resolvers: wrappedResolvers,
            updateResolversInPlace: true,
        });
    }
    async shouldWait(shouldWaitCacheKey) {
        // this is to prevent a call to a the cache (which might be distributed)
        // when the should wait was set from current instance
        const shouldWaitLocal = this.shouldWaitLocal[shouldWaitCacheKey];
        if (shouldWaitLocal) {
            return true;
        }
        const shouldWaitGlobal = await this.options.cache.get(shouldWaitCacheKey);
        if (shouldWaitGlobal) {
            return true;
        }
        // requried to be called after async check to eliminate local race condition
        return this.shouldWaitLocal[shouldWaitCacheKey];
    }
    setShouldWait(shouldWaitCacheKey) {
        this.options.cache.set(shouldWaitCacheKey, true);
        this.shouldWaitLocal[shouldWaitCacheKey] = true;
    }
    async cleanupShouldWait({ shouldWaitCacheKey, pubsubTopic, data, setCachePromise, }) {
        if (setCachePromise) {
            // we need to wait for cache to be filled before removing the shouldWait
            await setCachePromise;
        }
        // the below order is deliberate and important
        // we need to delete the shouldWait keys first
        // this ensures that no new subscriptions for topic are created after publish is called
        // since the cache is async we need to await the delete
        await this.options.cache.delete(shouldWaitCacheKey);
        delete this.shouldWaitLocal[shouldWaitCacheKey];
        this.options.pubsub.publish(pubsubTopic, data);
    }
    waitAndReturn(pubsubTopic) {
        return new Promise((resolve, reject) => {
            const subId = this.options.pubsub.subscribe(pubsubTopic, ({ result, error }) => {
                this.options.pubsub.unsubscribe(subId);
                if (error) {
                    reject(error);
                }
                if (result) {
                    resolve(result);
                }
            });
        });
    }
}
exports.default = CacheTransform;
