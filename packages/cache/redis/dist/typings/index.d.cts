import { KeyValueCache, KeyValueCacheSetOptions, MeshPubSub, YamlConfig } from '@graphql-mesh/types';
export default class RedisCache<V = string> implements KeyValueCache<V> {
    private client;
    constructor(options: YamlConfig.Cache['redis'] & {
        pubsub: MeshPubSub;
    });
    set(key: string, value: V, options?: KeyValueCacheSetOptions): Promise<void>;
    get(key: string): Promise<V | undefined>;
    getKeysByPrefix(prefix: string): Promise<string[]>;
    delete(key: string): Promise<boolean>;
}
