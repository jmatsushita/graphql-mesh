import { memoize1 } from '@graphql-tools/utils';
import { parse, print } from 'graphql';
import { createLruCache } from './global-lru-cache.js';
const parseCache = createLruCache(1000, 3600);
const printCache = createLruCache(1000, 3600);
export function parseWithCache(sdl) {
    const trimmedSdl = sdl.trim();
    let document = parseCache.get(trimmedSdl);
    if (!document) {
        document = parse(trimmedSdl, { noLocation: true });
        parseCache.set(trimmedSdl, document);
        printCache.set(JSON.stringify(document), trimmedSdl);
    }
    return document;
}
export const printWithCache = memoize1(function printWithCache(document) {
    const stringifedDocumentJson = JSON.stringify(document);
    let sdl = printCache.get(stringifedDocumentJson);
    if (!sdl) {
        sdl = print(document).trim();
        printCache.set(stringifedDocumentJson, sdl);
        parseCache.set(sdl, document);
    }
    return sdl;
});
export function gql([sdl], ...args) {
    let result = sdl;
    for (const arg of args || []) {
        if (typeof arg === 'string') {
            result += arg;
        }
        else {
            result += printWithCache(arg);
        }
    }
    return parseWithCache(result);
}
