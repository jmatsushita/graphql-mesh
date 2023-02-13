"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isFile = exports.isFileUpload = exports.cleanObject = exports.getOperationMetadata = exports.isPubSubOperationConfig = void 0;
function isPubSubOperationConfig(operationConfig) {
    return 'pubsubTopic' in operationConfig;
}
exports.isPubSubOperationConfig = isPubSubOperationConfig;
function getOperationMetadata(operationConfig) {
    let httpMethod;
    let operationType;
    let rootTypeName;
    if (isPubSubOperationConfig(operationConfig)) {
        httpMethod = null;
        operationType = 'subscription';
        rootTypeName = 'Subscription';
    }
    else {
        httpMethod = operationConfig.method;
        // Fix compability with Mesh handler
        operationType = operationConfig.type.toLowerCase();
        if (!httpMethod) {
            if (operationType === 'mutation') {
                httpMethod = 'POST';
            }
            else {
                httpMethod = 'GET';
            }
        }
        if (!rootTypeName) {
            if (httpMethod === 'GET') {
                rootTypeName = 'Query';
            }
        }
        rootTypeName = operationType === 'query' ? 'Query' : 'Mutation';
    }
    return {
        httpMethod,
        operationType,
        rootTypeName,
        fieldName: operationConfig.field,
    };
}
exports.getOperationMetadata = getOperationMetadata;
function cleanObject(obj) {
    if (typeof obj === 'object' && obj != null) {
        const newObj = Array.isArray(obj) ? [] : {};
        for (const key in obj) {
            const newObjForKey = cleanObject(obj[key]);
            if (newObjForKey != null) {
                newObj[key] = newObjForKey;
            }
        }
        return newObj;
    }
    return obj;
}
exports.cleanObject = cleanObject;
function isFileUpload(obj) {
    return typeof obj.createReadStream === 'function';
}
exports.isFileUpload = isFileUpload;
function isFile(obj) {
    return typeof obj.arrayBuffer === 'function';
}
exports.isFile = isFile;
