import { RenameTypes, RenameObjectFields, RenameInputObjectFields, RenameObjectFieldArguments, } from '@graphql-tools/wrap';
import { applyRequestTransforms, applyResultTransforms, applySchemaTransforms, } from '@graphql-mesh/utils';
import { ignoreList } from './shared.js';
export default class WrapRename {
    constructor({ config }) {
        this.transforms = [];
        for (const change of config.renames) {
            const { from: { type: fromTypeName, field: fromFieldName, argument: fromArgumentName }, to: { type: toTypeName, field: toFieldName, argument: toArgumentName }, useRegExpForTypes, useRegExpForFields, useRegExpForArguments, } = change;
            const regExpFlags = change.regExpFlags || undefined;
            if (fromTypeName !== toTypeName) {
                let replaceTypeNameFn;
                if (useRegExpForTypes) {
                    const typeNameRegExp = new RegExp(fromTypeName, regExpFlags);
                    replaceTypeNameFn = (t) => t.replace(typeNameRegExp, toTypeName);
                }
                else {
                    replaceTypeNameFn = t => (t === fromTypeName ? toTypeName : t);
                }
                this.transforms.push(new RenameTypes(typeName => {
                    if (ignoreList.includes(typeName)) {
                        return typeName;
                    }
                    return replaceTypeNameFn(typeName);
                }));
            }
            if (fromFieldName && toFieldName && fromFieldName !== toFieldName) {
                let replaceFieldNameFn;
                if (useRegExpForFields) {
                    const fieldNameRegExp = new RegExp(fromFieldName, regExpFlags);
                    replaceFieldNameFn = (typeName, fieldName) => typeName === toTypeName ? fieldName.replace(fieldNameRegExp, toFieldName) : fieldName;
                }
                else {
                    replaceFieldNameFn = (typeName, fieldName) => typeName === toTypeName && fieldName === fromFieldName ? toFieldName : fieldName;
                }
                this.transforms.push(new RenameObjectFields(replaceFieldNameFn));
                this.transforms.push(new RenameInputObjectFields(replaceFieldNameFn));
            }
            if (fromTypeName &&
                (fromTypeName === toTypeName || useRegExpForTypes) &&
                toFieldName &&
                (fromFieldName === toFieldName || useRegExpForFields) &&
                fromArgumentName &&
                fromArgumentName !== toArgumentName) {
                let replaceArgNameFn;
                const fieldNameMatch = (fieldName) => fieldName ===
                    (useRegExpForFields
                        ? fieldName.replace(new RegExp(fromFieldName, regExpFlags), toFieldName)
                        : toFieldName);
                const typeNameMatch = (typeName) => typeName ===
                    (useRegExpForTypes
                        ? typeName.replace(new RegExp(fromTypeName, regExpFlags), toTypeName)
                        : toTypeName);
                if (useRegExpForArguments) {
                    const argNameRegExp = new RegExp(fromArgumentName, regExpFlags);
                    replaceArgNameFn = (typeName, fieldName, argName) => typeNameMatch(typeName) && fieldNameMatch(fieldName)
                        ? argName.replace(argNameRegExp, toArgumentName)
                        : argName;
                }
                else {
                    replaceArgNameFn = (typeName, fieldName, argName) => typeNameMatch(typeName) && fieldNameMatch(fieldName) && argName === fromArgumentName
                        ? toArgumentName
                        : argName;
                }
                this.transforms.push(new RenameObjectFieldArguments(replaceArgNameFn));
            }
        }
    }
    transformSchema(originalWrappingSchema, subschemaConfig, transformedSchema) {
        return applySchemaTransforms(originalWrappingSchema, subschemaConfig, transformedSchema, this.transforms);
    }
    transformRequest(originalRequest, delegationContext, transformationContext) {
        return applyRequestTransforms(originalRequest, delegationContext, transformationContext, this.transforms);
    }
    transformResult(originalResult, delegationContext, transformationContext) {
        return applyResultTransforms(originalResult, delegationContext, transformationContext, this.transforms);
    }
}
