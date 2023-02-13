"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const wrap_1 = require("@graphql-tools/wrap");
const utils_1 = require("@graphql-mesh/utils");
const shared_js_1 = require("./shared.js");
class WrapRename {
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
                this.transforms.push(new wrap_1.RenameTypes(typeName => {
                    if (shared_js_1.ignoreList.includes(typeName)) {
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
                this.transforms.push(new wrap_1.RenameObjectFields(replaceFieldNameFn));
                this.transforms.push(new wrap_1.RenameInputObjectFields(replaceFieldNameFn));
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
                this.transforms.push(new wrap_1.RenameObjectFieldArguments(replaceArgNameFn));
            }
        }
    }
    transformSchema(originalWrappingSchema, subschemaConfig, transformedSchema) {
        return (0, utils_1.applySchemaTransforms)(originalWrappingSchema, subschemaConfig, transformedSchema, this.transforms);
    }
    transformRequest(originalRequest, delegationContext, transformationContext) {
        return (0, utils_1.applyRequestTransforms)(originalRequest, delegationContext, transformationContext, this.transforms);
    }
    transformResult(originalResult, delegationContext, transformationContext) {
        return (0, utils_1.applyResultTransforms)(originalResult, delegationContext, transformationContext, this.transforms);
    }
}
exports.default = WrapRename;
