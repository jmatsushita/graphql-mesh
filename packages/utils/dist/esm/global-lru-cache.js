import lru from 'tiny-lru';
export function createLruCache(max, ttl) {
    return lru(max, ttl);
}
