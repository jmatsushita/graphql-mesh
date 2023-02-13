"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.addMetaDataToCall = exports.addIncludePathResolver = exports.getTypeName = void 0;
const tslib_1 = require("tslib");
const utils_1 = require("@graphql-mesh/utils");
const string_interpolation_1 = require("@graphql-mesh/string-interpolation");
const grpc_js_1 = require("@grpc/grpc-js");
const cross_helpers_1 = require("@graphql-mesh/cross-helpers");
const lodash_get_1 = tslib_1.__importDefault(require("lodash.get"));
const scalars_js_1 = require("./scalars.js");
function getTypeName(schemaComposer, pathWithName, isInput) {
    if (pathWithName === null || pathWithName === void 0 ? void 0 : pathWithName.length) {
        const baseTypeName = pathWithName.filter(Boolean).join('_');
        if ((0, scalars_js_1.isScalarType)(baseTypeName)) {
            return (0, scalars_js_1.getGraphQLScalar)(baseTypeName);
        }
        if (schemaComposer.isEnumType(baseTypeName)) {
            return baseTypeName;
        }
        return isInput ? baseTypeName + '_Input' : baseTypeName;
    }
    return 'Void';
}
exports.getTypeName = getTypeName;
function addIncludePathResolver(root, includePaths) {
    const originalResolvePath = root.resolvePath;
    root.resolvePath = (origin, target) => {
        if (cross_helpers_1.path.isAbsolute(target)) {
            return target;
        }
        for (const directory of includePaths) {
            const fullPath = cross_helpers_1.path.join(directory, target);
            if (cross_helpers_1.fs.existsSync(fullPath)) {
                return fullPath;
            }
        }
        const path = originalResolvePath(origin, target);
        if (path === null) {
            console.warn(`${target} not found in any of the include paths ${includePaths}`);
        }
        return path;
    };
}
exports.addIncludePathResolver = addIncludePathResolver;
function isBlob(input) {
    return input != null && input.stream instanceof Function;
}
function addMetaDataToCall(callFn, input, resolverData, metaData, isResponseStream = false) {
    const callFnArguments = [];
    if (!isBlob(input)) {
        callFnArguments.push(input);
    }
    if (metaData) {
        const meta = new grpc_js_1.Metadata();
        for (const [key, value] of Object.entries(metaData)) {
            let metaValue = value;
            if (Array.isArray(value)) {
                // Extract data from context
                metaValue = (0, lodash_get_1.default)(resolverData.context, value);
            }
            // Ensure that the metadata is compatible with what node-grpc expects
            if (typeof metaValue !== 'string' && !(metaValue instanceof Buffer)) {
                metaValue = JSON.stringify(metaValue);
            }
            if (typeof metaValue === 'string') {
                metaValue = string_interpolation_1.stringInterpolator.parse(metaValue, resolverData);
            }
            meta.add(key, metaValue);
        }
        callFnArguments.push(meta);
    }
    return new Promise((resolve, reject) => {
        const call = callFn(...callFnArguments, (error, response) => {
            if (error) {
                reject(error);
            }
            resolve(response);
        });
        if (isResponseStream) {
            let isCancelled = false;
            const responseStreamWithCancel = (0, utils_1.withCancel)(call, () => {
                var _a;
                if (!isCancelled) {
                    (_a = call.call) === null || _a === void 0 ? void 0 : _a.cancelWithStatus(0, 'Cancelled by GraphQL Mesh');
                    isCancelled = true;
                }
            });
            resolve(responseStreamWithCancel);
            if (isBlob(input)) {
                const blobStream = input.stream();
                blobStream.pipe(call);
            }
        }
    });
}
exports.addMetaDataToCall = addMetaDataToCall;
