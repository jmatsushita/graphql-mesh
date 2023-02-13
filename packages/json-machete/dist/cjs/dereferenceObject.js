"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.dereferenceObject = exports.getCwd = exports.getAbsolutePath = exports.resolvePath = void 0;
const tslib_1 = require("tslib");
const json_pointer_1 = tslib_1.__importDefault(require("json-pointer"));
const cross_helpers_1 = require("@graphql-mesh/cross-helpers");
const url_join_1 = tslib_1.__importDefault(require("url-join"));
const fetch_1 = require("@whatwg-node/fetch");
const utils_1 = require("@graphql-mesh/utils");
const healUntitledDefinitions_js_1 = require("./healUntitledDefinitions.js");
const resolvePath = (path, root) => {
    var _a;
    try {
        return json_pointer_1.default.get(root, path);
    }
    catch (e) {
        if ((_a = e.message) === null || _a === void 0 ? void 0 : _a.startsWith('Invalid reference')) {
            return undefined;
        }
        throw e;
    }
};
exports.resolvePath = resolvePath;
function isRefObject(obj) {
    return typeof obj === 'object' && typeof obj.$ref === 'string';
}
const getAbsolute$Ref = (given$ref, baseFilePath) => {
    const [givenExternalFileRelativePath, givenRefPath] = given$ref.split('#');
    if (givenExternalFileRelativePath) {
        const cwd = (0, utils_1.isUrl)(baseFilePath) ? getCwdForUrl(baseFilePath) : cross_helpers_1.path.dirname(baseFilePath);
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
function getAbsolutePath(path, cwd) {
    if ((0, utils_1.isUrl)(path)) {
        return path;
    }
    if ((0, utils_1.isUrl)(cwd)) {
        return normalizeUrl((0, url_join_1.default)(cwd, path));
    }
    if (cross_helpers_1.path.isAbsolute(path)) {
        return path;
    }
    return cross_helpers_1.path.join(cwd, path);
}
exports.getAbsolutePath = getAbsolutePath;
function getCwd(path) {
    return (0, utils_1.isUrl)(path) ? getCwdForUrl(path) : cross_helpers_1.path.dirname(path);
}
exports.getCwd = getCwd;
async function dereferenceObject(obj, { cwd = cross_helpers_1.process.cwd(), externalFileCache = new Map(), refMap = new Map(), root = obj, fetchFn: fetch = fetch_1.fetch, importFn = utils_1.defaultImportFn, logger = new utils_1.DefaultLogger('dereferenceObject'), resolvedObjects = new WeakSet(), headers, } = {}) {
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
                        externalFile = await (0, utils_1.readFileOrUrl)(externalFilePath, {
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
                        (0, healUntitledDefinitions_js_1.handleUntitledDefinitions)(externalFile);
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
                    const resolvedObj = (0, exports.resolvePath)(refPath, root);
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
exports.dereferenceObject = dereferenceObject;
