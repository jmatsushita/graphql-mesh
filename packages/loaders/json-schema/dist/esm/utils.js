export function isPubSubOperationConfig(operationConfig) {
    return 'pubsubTopic' in operationConfig;
}
export function getOperationMetadata(operationConfig) {
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
export function cleanObject(obj) {
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
export function isFileUpload(obj) {
    return typeof obj.createReadStream === 'function';
}
export function isFile(obj) {
    return typeof obj.arrayBuffer === 'function';
}
