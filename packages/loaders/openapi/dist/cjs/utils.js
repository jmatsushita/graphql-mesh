"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getFieldNameFromPath = void 0;
const change_case_1 = require("change-case");
function getFieldNameFromPath(path, method, responseTypeSchemaRef) {
    // Replace identifiers with "by"
    path = path.split('{').join('by_').split('}').join('');
    const [actualPartsStr, allQueryPartsStr] = path.split('?');
    const actualParts = actualPartsStr.split('/').filter(Boolean);
    let fieldNameWithoutMethod = actualParts.join('_');
    // If path doesn't give any field name without identifiers, we can use the return type with HTTP Method name
    if ((!fieldNameWithoutMethod || fieldNameWithoutMethod.startsWith('by')) &&
        responseTypeSchemaRef) {
        const refArr = responseTypeSchemaRef.split('/');
        // lowercase looks better in the schema
        const prefix = (0, change_case_1.camelCase)(refArr[refArr.length - 1]);
        if (fieldNameWithoutMethod) {
            fieldNameWithoutMethod = prefix + '_' + fieldNameWithoutMethod;
        }
        else {
            fieldNameWithoutMethod = prefix;
        }
    }
    if (fieldNameWithoutMethod.startsWith('by_')) {
        fieldNameWithoutMethod = fieldNameWithoutMethod.replace('by_', '');
    }
    if (allQueryPartsStr) {
        const queryParts = allQueryPartsStr.split('&');
        for (const queryPart of queryParts) {
            const [queryName] = queryPart.split('=');
            fieldNameWithoutMethod += '_' + 'by' + '_' + queryName;
        }
    }
    // get_ doesn't look good in field names
    const methodPrefix = method.toLowerCase();
    if (methodPrefix === 'get') {
        return fieldNameWithoutMethod;
    }
    if (fieldNameWithoutMethod) {
        return methodPrefix + '_' + fieldNameWithoutMethod;
    }
    return methodPrefix;
}
exports.getFieldNameFromPath = getFieldNameFromPath;
