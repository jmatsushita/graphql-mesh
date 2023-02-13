"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const cross_helpers_1 = require("@graphql-mesh/cross-helpers");
const dataloader_1 = tslib_1.__importDefault(require("dataloader"));
const utils_1 = require("@graphql-mesh/utils");
class FileCache {
    constructor({ path, importFn }) {
        this.absolutePath = cross_helpers_1.path.isAbsolute(path) ? path : cross_helpers_1.path.join(process.cwd(), path);
        this.json$ = (0, utils_1.pathExists)(this.absolutePath).then(async (isExists) => {
            if (isExists) {
                const existingData = await importFn(this.absolutePath);
                return {
                    ...existingData,
                };
            }
            return {};
        });
        this.writeDataLoader = new dataloader_1.default(async (keys) => {
            const json = await this.json$;
            await (0, utils_1.writeJSON)(this.absolutePath, json);
            return keys;
        });
    }
    async getKeysByPrefix(prefix) {
        const json = await this.json$;
        return Object.keys(json).filter(key => key.startsWith(prefix));
    }
    async get(name) {
        const json = await this.json$;
        return json[name];
    }
    async set(name, value) {
        const json = await this.json$;
        json[name] = value;
        await this.writeDataLoader.load(name);
    }
    async delete(name) {
        const json = await this.json$;
        delete json[name];
        await this.writeDataLoader.load(name);
    }
}
exports.default = FileCache;
