import { ImportFn, KeyValueCache } from '@graphql-mesh/types';
import DataLoader from 'dataloader';
export default class FileCache<V = any> implements KeyValueCache<V> {
    json$: Promise<Record<string, V>>;
    absolutePath: string;
    writeDataLoader: DataLoader<string, string>;
    constructor({ path, importFn }: {
        path: string;
        importFn: ImportFn;
    });
    getKeysByPrefix(prefix: string): Promise<string[]>;
    get(name: string): Promise<V>;
    set(name: string, value: V): Promise<void>;
    delete(name: string): Promise<void>;
}
