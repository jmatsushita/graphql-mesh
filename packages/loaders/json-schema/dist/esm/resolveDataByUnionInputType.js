import { isListType, isNonNullType, isInputObjectType, } from 'graphql';
import { asArray, getDirective } from '@graphql-tools/utils';
import { sanitizeNameForGraphQL } from '@graphql-mesh/utils';
export function resolveDataByUnionInputType(data, type, schema) {
    var _a;
    if (data) {
        if (isListType(type)) {
            return asArray(data).map(elem => resolveDataByUnionInputType(elem, type.ofType, schema));
        }
        if (isNonNullType(type)) {
            return resolveDataByUnionInputType(data, type.ofType, schema);
        }
        if (isInputObjectType(type)) {
            const typeOneOfDirectives = getDirective(schema, type, 'oneOf');
            const isOneOf = typeOneOfDirectives === null || typeOneOfDirectives === void 0 ? void 0 : typeOneOfDirectives.length;
            const fieldMap = type.getFields();
            data = asArray(data)[0];
            for (const propertyName in data) {
                const fieldName = sanitizeNameForGraphQL(propertyName);
                const field = fieldMap[fieldName];
                if (field) {
                    if (isOneOf) {
                        const resolvedData = resolveDataByUnionInputType(data[fieldName], field.type, schema);
                        return resolvedData;
                    }
                    const fieldData = data[fieldName];
                    data[fieldName] = undefined;
                    const fieldResolveRootFieldDirectives = getDirective(schema, field, 'resolveRootField');
                    const realFieldName = ((_a = fieldResolveRootFieldDirectives === null || fieldResolveRootFieldDirectives === void 0 ? void 0 : fieldResolveRootFieldDirectives[0]) === null || _a === void 0 ? void 0 : _a.field) || fieldName;
                    data[realFieldName] = resolveDataByUnionInputType(fieldData, field.type, schema);
                }
            }
        }
    }
    return data;
}
