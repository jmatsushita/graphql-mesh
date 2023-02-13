import { RenameTypes, TransformEnumValues, RenameInterfaceFields, TransformObjectFields, RenameInputObjectFields, RenameObjectFieldArguments, } from '@graphql-tools/wrap';
import { applyRequestTransforms, applyResultTransforms, applySchemaTransforms, } from '@graphql-mesh/utils';
import { NAMING_CONVENTIONS, IGNORED_ROOT_FIELD_NAMES, IGNORED_TYPE_NAMES } from './shared.js';
export default class NamingConventionTransform {
    constructor(options) {
        this.transforms = [];
        if (options.config.typeNames) {
            const namingConventionFn = NAMING_CONVENTIONS[options.config.typeNames];
            this.transforms.push(new RenameTypes(typeName => IGNORED_TYPE_NAMES.includes(typeName)
                ? typeName
                : namingConventionFn(typeName) || typeName));
        }
        if (options.config.fieldNames) {
            const fieldNamingConventionFn = options.config.fieldNames
                ? NAMING_CONVENTIONS[options.config.fieldNames]
                : (s) => s;
            this.transforms.push(new RenameInputObjectFields((_, fieldName) => fieldNamingConventionFn(fieldName) || fieldName), new TransformObjectFields((_, fieldName, fieldConfig) => [
                IGNORED_ROOT_FIELD_NAMES.includes(fieldName)
                    ? fieldName
                    : fieldNamingConventionFn(fieldName) || fieldName,
                fieldConfig,
            ]), new RenameInterfaceFields((_, fieldName) => fieldNamingConventionFn(fieldName) || fieldName));
        }
        if (options.config.fieldArgumentNames) {
            const fieldArgNamingConventionFn = options.config.fieldArgumentNames
                ? NAMING_CONVENTIONS[options.config.fieldArgumentNames]
                : (s) => s;
            this.transforms.push(new RenameObjectFieldArguments((_typeName, _fieldName, argName) => fieldArgNamingConventionFn(argName)));
        }
        if (options.config.enumValues) {
            const namingConventionFn = NAMING_CONVENTIONS[options.config.enumValues];
            this.transforms.push(new TransformEnumValues((typeName, externalValue, enumValueConfig) => {
                const newEnumValue = namingConventionFn(externalValue) || externalValue;
                return [newEnumValue, enumValueConfig];
            }));
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
