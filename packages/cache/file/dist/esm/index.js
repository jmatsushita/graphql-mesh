import { path as pathModule } from '@graphql-mesh/cross-helpers';
import DataLoader from 'dataloader';
import { pathExists, writeJSON } from '@graphql-mesh/utils';
export default class FileCache {
    constructor({ path, importFn }) {
        this.absolutePath = pathModule.isAbsolute(path) ? path : pathModule.join(process.cwd(), path);
        this.json$ = pathExists(this.absolutePath).then(async (isExists) => {
            if (isExists) {
                const existingData = await importFn(this.absolutePath);
                return {
                    ...existingData,
                };
            }
            return {};
        });
        this.writeDataLoader = new DataLoader(async (keys) => {
            const json = await this.json$;
            await writeJSON(this.absolutePath, json);
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
