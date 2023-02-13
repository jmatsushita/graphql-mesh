"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const wrap_1 = require("@graphql-tools/wrap");
const utils_1 = require("@graphql-mesh/utils");
const shared_js_1 = require("./shared.js");
class NamingConventionTransform {
    constructor(options) {
        this.transforms = [];
        if (options.config.typeNames) {
            const namingConventionFn = shared_js_1.NAMING_CONVENTIONS[options.config.typeNames];
            this.transforms.push(new wrap_1.RenameTypes(typeName => shared_js_1.IGNORED_TYPE_NAMES.includes(typeName)
                ? typeName
                : namingConventionFn(typeName) || typeName));
        }
        if (options.config.fieldNames) {
            const fieldNamingConventionFn = options.config.fieldNames
                ? shared_js_1.NAMING_CONVENTIONS[options.config.fieldNames]
                : (s) => s;
            this.transforms.push(new wrap_1.RenameInputObjectFields((_, fieldName) => fieldNamingConventionFn(fieldName) || fieldName), new wrap_1.TransformObjectFields((_, fieldName, fieldConfig) => [
                shared_js_1.IGNORED_ROOT_FIELD_NAMES.includes(fieldName)
                    ? fieldName
                    : fieldNamingConventionFn(fieldName) || fieldName,
                fieldConfig,
            ]), new wrap_1.RenameInterfaceFields((_, fieldName) => fieldNamingConventionFn(fieldName) || fieldName));
        }
        if (options.config.fieldArgumentNames) {
            const fieldArgNamingConventionFn = options.config.fieldArgumentNames
                ? shared_js_1.NAMING_CONVENTIONS[options.config.fieldArgumentNames]
                : (s) => s;
            this.transforms.push(new wrap_1.RenameObjectFieldArguments((_typeName, _fieldName, argName) => fieldArgNamingConventionFn(argName)));
        }
        if (options.config.enumValues) {
            const namingConventionFn = shared_js_1.NAMING_CONVENTIONS[options.config.enumValues];
            this.transforms.push(new wrap_1.TransformEnumValues((typeName, externalValue, enumValueConfig) => {
                const newEnumValue = namingConventionFn(externalValue) || externalValue;
                return [newEnumValue, enumValueConfig];
            }));
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
exports.default = NamingConventionTransform;
