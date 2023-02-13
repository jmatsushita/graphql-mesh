import JsonPointer from 'json-pointer';
import { path as pathModule, process } from '@graphql-mesh/cross-helpers';
import urlJoin from 'url-join';
import { fetch as crossUndiciFetch } from '@whatwg-node/fetch';
import { defaultImportFn, DefaultLogger, isUrl, readFileOrUrl } from '@graphql-mesh/utils';
import { handleUntitledDefinitions } from './healUntitledDefinitions.js';
export const resolvePath = (path, root) => {
    var _a;
    try {
        return JsonPointer.get(root, path);
    }
    catch (e) {
        if ((_a = e.message) === null || _a === void 0 ? void 0 : _a.startsWith('Invalid reference')) {
            return undefined;
        }
        throw e;
    }
};
function isRefObject(obj) {
    return typeof obj === 'object' && typeof obj.$ref === 'string';
}
const getAbsolute$Ref = (given$ref, baseFilePath) => {
    const [givenExternalFileRelativePath, givenRefPath] = given$ref.split('#');
    if (givenExternalFileRelativePath) {
        const cwd = isUrl(baseFilePath) ? getCwdForUrl(baseFilePath) : pathModule.dirname(baseFilePath);
        const givenExternalFilePath = getAbsolutePath(givenExternalFileRelativePath, cwd);
        if (givenRefPath) {
            return `${givenExternalFilePath}#${givenRefPath}`;
        }
        return givenExternalFilePath;
    }
    return `${baseFilePath}#${givenRefPath}`;
};
function getCwdForUrl(url) {
    const urlParts = url.split('/');
    urlParts.pop();
    return urlParts.join('/');
}
function normalizeUrl(url) {
    return new URL(url).toString();
}
export function getAbsolutePath(path, cwd) {
    if (isUrl(path)) {
        return path;
    }
    if (isUrl(cwd)) {
        return normalizeUrl(urlJoin(cwd, path));
    }
    if (pathModule.isAbsolute(path)) {
        return path;
    }
    return pathModule.join(cwd, path);
}
export function getCwd(path) {
    return isUrl(path) ? getCwdForUrl(path) : pathModule.dirname(path);
}
export async function dereferenceObject(obj, { cwd = process.cwd(), externalFileCache = new Map(), refMap = new Map(), root = obj, fetchFn: fetch = crossUndiciFetch, importFn = defaultImportFn, logger = new DefaultLogger('dereferenceObject'), resolvedObjects = new WeakSet(), headers, } = {}) {
    if (obj != null && typeof obj === 'object') {
        if (isRefObject(obj)) {
            const $ref = obj.$ref;
            if (refMap.has($ref)) {
                return refMap.get($ref);
            }
            else {
                logger.debug(`Resolving ${$ref}`);
                const [externalRelativeFilePath, refPath] = $ref.split('#');
                if (externalRelativeFilePath) {
                    const externalFilePath = getAbsolutePath(externalRelativeFilePath, cwd);
                    const newCwd = getCwd(externalFilePath);
                    let externalFile = externalFileCache.get(externalFilePath);
                    if (!externalFile) {
                        externalFile = await readFileOrUrl(externalFilePath, {
                            fetch,
                            headers,
                            cwd,
                            importFn,
                            logger,
                        }).catch(() => {
                            throw new Error(`Unable to load ${externalRelativeFilePath} from ${cwd}`);
                        });
                        externalFileCache.set(externalFilePath, externalFile);
                        // Title should not be overwritten by the title given from the reference
                        // Usually Swagger and OpenAPI Schemas have this
                        handleUntitledDefinitions(externalFile);
                    }
                    const result = await dereferenceObject(refPath
                        ? {
                            $ref: `#${refPath}`,
                        }
                        : externalFile, {
                        cwd: newCwd,
                        externalFileCache,
                        refMap: new Proxy(refMap, {
                            get: (originalRefMap, key) => {
                                switch (key) {
                                    case 'has':
                                        return (given$ref) => {
                                            const original$Ref = getAbsolute$Ref(given$ref, externalFilePath);
                                            return originalRefMap.has(original$Ref);
                                        };
                                    case 'get':
                                        return (given$ref) => {
                                            const original$Ref = getAbsolute$Ref(given$ref, externalFilePath);
                                            return originalRefMap.get(original$Ref);
                                        };
                                    case 'set':
                                        return (given$ref, val) => {
                                            const original$Ref = getAbsolute$Ref(given$ref, externalFilePath);
                                            return originalRefMap.set(original$Ref, val);
                                        };
                                }
                                throw new Error('Not implemented ' + key.toString());
                            },
                        }),
                        fetchFn: fetch,
                        importFn,
                        logger,
                        headers,
                        root: externalFile,
                        resolvedObjects,
                    });
                    refMap.set($ref, result);
                    resolvedObjects.add(result);
                    if (result && !result.$resolvedRef) {
                        result.$resolvedRef = refPath;
                    }
                    if (obj.title && !result.title) {
                        result.title = obj.title;
                    }
                    return result;
                }
                else {
                    const resolvedObj = resolvePath(refPath, root);
                    if (resolvedObjects.has(resolvedObj)) {
                        refMap.set($ref, resolvedObj);
                        return resolvedObj;
                    }
                    /*
                    if (resolvedObj && !resolvedObj.$resolvedRef) {
                      resolvedObj.$resolvedRef = refPath;
                    }
                    */
                    const result = await dereferenceObject(resolvedObj, {
                        cwd,
                        externalFileCache,
                        refMap,
                        root,
                        fetchFn: fetch,
                        importFn,
                        logger,
                        headers,
                        resolvedObjects,
                    });
                    if (!result) {
                        return obj;
                    }
                    resolvedObjects.add(result);
                    refMap.set($ref, result);
                    if (!result.$resolvedRef) {
                        result.$resolvedRef = refPath;
                    }
                    return result;
                }
            }
        }
        else {
            if (!resolvedObjects.has(obj)) {
                resolvedObjects.add(obj);
                for (const key in obj) {
                    const val = obj[key];
                    if (typeof val === 'object') {
                        obj[key] = await dereferenceObject(val, {
                            cwd,
                            externalFileCache,
                            refMap,
                            root,
                            fetchFn: fetch,
                            headers,
                            resolvedObjects,
                        });
                    }
                }
            }
        }
    }
    return obj;
}
