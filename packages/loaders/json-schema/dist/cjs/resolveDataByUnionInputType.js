"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveDataByUnionInputType = void 0;
const graphql_1 = require("graphql");
const utils_1 = require("@graphql-tools/utils");
const utils_2 = require("@graphql-mesh/utils");
function resolveDataByUnionInputType(data, type, schema) {
    var _a;
    if (data) {
        if ((0, graphql_1.isListType)(type)) {
            return (0, utils_1.asArray)(data).map(elem => resolveDataByUnionInputType(elem, type.ofType, schema));
        }
        if ((0, graphql_1.isNonNullType)(type)) {
            return resolveDataByUnionInputType(data, type.ofType, schema);
        }
        if ((0, graphql_1.isInputObjectType)(type)) {
            const typeOneOfDirectives = (0, utils_1.getDirective)(schema, type, 'oneOf');
            const isOneOf = typeOneOfDirectives === null || typeOneOfDirectives === void 0 ? void 0 : typeOneOfDirectives.length;
            const fieldMap = type.getFields();
            data = (0, utils_1.asArray)(data)[0];
            for (const propertyName in data) {
                const fieldName = (0, utils_2.sanitizeNameForGraphQL)(propertyName);
                const field = fieldMap[fieldName];
                if (field) {
                    if (isOneOf) {
                        const resolvedData = resolveDataByUnionInputType(data[fieldName], field.type, schema);
                        return resolvedData;
                    }
                    const fieldData = data[fieldName];
                    data[fieldName] = undefined;
                    const fieldResolveRootFieldDirectives = (0, utils_1.getDirective)(schema, field, 'resolveRootField');
                    const realFieldName = ((_a = fieldResolveRootFieldDirectives === null || fieldResolveRootFieldDirectives === void 0 ? void 0 : fieldResolveRootFieldDirectives[0]) === null || _a === void 0 ? void 0 : _a.field) || fieldName;
                    data[realFieldName] = resolveDataByUnionInputType(fieldData, field.type, schema);
                }
            }
        }
    }
    return data;
}
exports.resolveDataByUnionInputType = resolveDataByUnionInputType;
