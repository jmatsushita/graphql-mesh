import { withCancel } from '@graphql-mesh/utils';
import { stringInterpolator } from '@graphql-mesh/string-interpolation';
import { Metadata, } from '@grpc/grpc-js';
import { fs, path as pathModule } from '@graphql-mesh/cross-helpers';
import lodashGet from 'lodash.get';
import { getGraphQLScalar, isScalarType } from './scalars.js';
export function getTypeName(schemaComposer, pathWithName, isInput) {
    if (pathWithName === null || pathWithName === void 0 ? void 0 : pathWithName.length) {
        const baseTypeName = pathWithName.filter(Boolean).join('_');
        if (isScalarType(baseTypeName)) {
            return getGraphQLScalar(baseTypeName);
        }
        if (schemaComposer.isEnumType(baseTypeName)) {
            return baseTypeName;
        }
        return isInput ? baseTypeName + '_Input' : baseTypeName;
    }
    return 'Void';
}
export function addIncludePathResolver(root, includePaths) {
    const originalResolvePath = root.resolvePath;
    root.resolvePath = (origin, target) => {
        if (pathModule.isAbsolute(target)) {
            return target;
        }
        for (const directory of includePaths) {
            const fullPath = pathModule.join(directory, target);
            if (fs.existsSync(fullPath)) {
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
function isBlob(input) {
    return input != null && input.stream instanceof Function;
}
export function addMetaDataToCall(callFn, input, resolverData, metaData, isResponseStream = false) {
    const callFnArguments = [];
    if (!isBlob(input)) {
        callFnArguments.push(input);
    }
    if (metaData) {
        const meta = new Metadata();
        for (const [key, value] of Object.entries(metaData)) {
            let metaValue = value;
            if (Array.isArray(value)) {
                // Extract data from context
                metaValue = lodashGet(resolverData.context, value);
            }
            // Ensure that the metadata is compatible with what node-grpc expects
            if (typeof metaValue !== 'string' && !(metaValue instanceof Buffer)) {
                metaValue = JSON.stringify(metaValue);
            }
            if (typeof metaValue === 'string') {
                metaValue = stringInterpolator.parse(metaValue, resolverData);
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
            const responseStreamWithCancel = withCancel(call, () => {
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
