import { KeyValueCache, Logger } from '@graphql-mesh/types';
export default class CFWorkerKVCache implements KeyValueCache {
    private kvNamespace?;
    constructor(config: {
        namespace: string;
        logger: Logger;
    });
    get<T>(key: string): Promise<T | undefined>;
    getKeysByPrefix(prefix: string): Promise<string[]>;
    set(key: string, value: any, options?: {
        ttl?: number;
    }): Promise<void>;
    delete(key: string): Promise<void>;
}
