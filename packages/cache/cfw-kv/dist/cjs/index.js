"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class CFWorkerKVCache {
    constructor(config) {
        this.kvNamespace = globalThis[config.namespace];
        if (this.kvNamespace === undefined) {
            // We don't use mocks because they increase the bundle size.
            config.logger.warn(`Make sure KV Namespace: ${config.namespace} exists.`);
        }
    }
    async get(key) {
        var _a;
        return (_a = this.kvNamespace) === null || _a === void 0 ? void 0 : _a.get(key, 'json');
    }
    async getKeysByPrefix(prefix) {
        var _a;
        const result = await ((_a = this.kvNamespace) === null || _a === void 0 ? void 0 : _a.list({
            prefix,
        }));
        if (!result) {
            return [];
        }
        return result.keys.map(keyEntry => keyEntry.name);
    }
    async set(key, value, options) {
        var _a;
        return (_a = this.kvNamespace) === null || _a === void 0 ? void 0 : _a.put(key, JSON.stringify(value), {
            expirationTtl: options === null || options === void 0 ? void 0 : options.ttl,
        });
    }
    async delete(key) {
        var _a;
        return (_a = this.kvNamespace) === null || _a === void 0 ? void 0 : _a.delete(key);
    }
}
exports.default = CFWorkerKVCache;
