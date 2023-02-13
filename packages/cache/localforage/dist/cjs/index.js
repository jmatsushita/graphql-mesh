"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const InMemoryLRUDriver_js_1 = require("./InMemoryLRUDriver.js");
const localforage_1 = tslib_1.__importDefault(require("localforage"));
localforage_1.default.defineDriver((0, InMemoryLRUDriver_js_1.createInMemoryLRUDriver)()).catch(err => console.error('Failed at defining InMemoryLRU driver', err));
class LocalforageCache {
    constructor(config) {
        const driverNames = (config === null || config === void 0 ? void 0 : config.driver) || ['INDEXEDDB', 'WEBSQL', 'LOCALSTORAGE', 'INMEMORY_LRU'];
        this.localforage = localforage_1.default.createInstance({
            name: (config === null || config === void 0 ? void 0 : config.name) || 'graphql-mesh-cache',
            storeName: (config === null || config === void 0 ? void 0 : config.storeName) || 'graphql-mesh-cache-store',
            driver: driverNames.map(driverName => { var _a; return (_a = localforage_1.default[driverName]) !== null && _a !== void 0 ? _a : driverName; }),
            size: config === null || config === void 0 ? void 0 : config.size,
            version: config === null || config === void 0 ? void 0 : config.version,
            description: config === null || config === void 0 ? void 0 : config.description,
        });
    }
    async get(key) {
        const expiresAt = await this.localforage.getItem(`${key}.expiresAt`);
        if (expiresAt && Date.now() > expiresAt) {
            await this.localforage.removeItem(key);
        }
        return this.localforage.getItem(key.toString());
    }
    async getKeysByPrefix(prefix) {
        const keys = await this.localforage.keys();
        return keys.filter(key => key.startsWith(prefix));
    }
    async set(key, value, options) {
        const jobs = [this.localforage.setItem(key, value)];
        if (options === null || options === void 0 ? void 0 : options.ttl) {
            jobs.push(this.localforage.setItem(`${key}.expiresAt`, Date.now() + options.ttl * 1000));
        }
        await Promise.all(jobs);
    }
    delete(key) {
        return this.localforage.removeItem(key);
    }
}
exports.default = LocalforageCache;