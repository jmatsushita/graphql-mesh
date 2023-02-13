"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const ioredis_1 = tslib_1.__importDefault(require("ioredis"));
const string_interpolation_1 = require("@graphql-mesh/string-interpolation");
const cross_helpers_1 = require("@graphql-mesh/cross-helpers");
const ioredis_mock_1 = tslib_1.__importDefault(require("ioredis-mock"));
function interpolateStrWithEnv(str) {
    return string_interpolation_1.stringInterpolator.parse(str, { env: cross_helpers_1.process.env });
}
class RedisCache {
    constructor(options) {
        var _a, _b, _c;
        if (options.url) {
            const redisUrl = new URL(interpolateStrWithEnv(options.url));
            redisUrl.searchParams.set('lazyConnect', 'true');
            redisUrl.searchParams.set('enableAutoPipelining', 'true');
            redisUrl.searchParams.set('enableOfflineQueue', 'true');
            if (!['redis:', 'rediss:'].includes(redisUrl.protocol)) {
                throw new Error('Redis URL must use either redis:// or rediss://');
            }
            this.client = new ioredis_1.default(redisUrl === null || redisUrl === void 0 ? void 0 : redisUrl.toString());
        }
        else {
            const parsedHost = interpolateStrWithEnv((_a = options.host) === null || _a === void 0 ? void 0 : _a.toString());
            const parsedPort = interpolateStrWithEnv((_b = options.port) === null || _b === void 0 ? void 0 : _b.toString());
            const parsedPassword = interpolateStrWithEnv((_c = options.password) === null || _c === void 0 ? void 0 : _c.toString());
            if (parsedHost) {
                this.client = new ioredis_1.default({
                    host: parsedHost,
                    port: parseInt(parsedPort),
                    password: parsedPassword,
                    lazyConnect: true,
                    enableAutoPipelining: true,
                    enableOfflineQueue: true,
                });
            }
            else {
                this.client = new ioredis_mock_1.default();
            }
        }
        const id = options.pubsub.subscribe('destroy', () => {
            this.client.disconnect(false);
            options.pubsub.unsubscribe(id);
        });
    }
    async set(key, value, options) {
        const stringifiedValue = JSON.stringify(value);
        if (options === null || options === void 0 ? void 0 : options.ttl) {
            await this.client.set(key, stringifiedValue, 'EX', options.ttl);
        }
        else {
            await this.client.set(key, stringifiedValue);
        }
    }
    async get(key) {
        const reply = await this.client.get(key);
        if (reply !== null) {
            const value = JSON.parse(reply);
            return value;
        }
        return undefined;
    }
    async getKeysByPrefix(prefix) {
        return this.client.keys(`${prefix}*`);
    }
    async delete(key) {
        try {
            await this.client.del(key);
            return true;
        }
        catch (e) {
            return false;
        }
    }
}
exports.default = RedisCache;
