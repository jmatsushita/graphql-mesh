"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const utils_1 = require("@graphql-mesh/utils");
const wrap_1 = require("@graphql-tools/wrap");
const minimatch_1 = tslib_1.__importDefault(require("minimatch"));
class WrapFilter {
    constructor({ config: { filters } }) {
        this.transforms = [];
        for (const filter of filters) {
            const [typeName, fieldNameOrGlob, argsGlob] = filter.split('.');
            const typeMatcher = new minimatch_1.default.Minimatch(typeName);
            // TODO: deprecate this in next major release as dscussed in #1605
            if (!fieldNameOrGlob) {
                this.transforms.push(new wrap_1.FilterTypes(type => {
                    return typeMatcher.match(type.name);
                }));
                continue;
            }
            let fixedFieldGlob = argsGlob || fieldNameOrGlob;
            if (fixedFieldGlob.includes('{') && !fixedFieldGlob.includes(',')) {
                fixedFieldGlob = fieldNameOrGlob.replace('{', '').replace('}', '');
            }
            fixedFieldGlob = fixedFieldGlob.split(', ').join(',');
            const globalTypeMatcher = new minimatch_1.default.Minimatch(fixedFieldGlob.trim());
            if (typeName === 'Type') {
                this.transforms.push(new wrap_1.FilterTypes(type => {
                    return globalTypeMatcher.match(type.name);
                }));
                continue;
            }
            if (argsGlob) {
                const fieldMatcher = new minimatch_1.default.Minimatch(fieldNameOrGlob);
                this.transforms.push(new wrap_1.TransformCompositeFields((fieldTypeName, fieldName, fieldConfig) => {
                    if (typeMatcher.match(fieldTypeName) && fieldMatcher.match(fieldName)) {
                        const fieldArgs = Object.entries(fieldConfig.args).reduce((args, [argName, argConfig]) => !globalTypeMatcher.match(argName) ? args : { ...args, [argName]: argConfig }, {});
                        return { ...fieldConfig, args: fieldArgs };
                    }
                    return undefined;
                }));
                continue;
            }
            // If the glob is not for Types nor Args, finally we register Fields filters
            this.transforms.push(new wrap_1.FilterRootFields((rootTypeName, rootFieldName) => {
                if (typeMatcher.match(rootTypeName)) {
                    return globalTypeMatcher.match(rootFieldName);
                }
                return true;
            }));
            this.transforms.push(new wrap_1.FilterObjectFields((objectTypeName, objectFieldName) => {
                if (typeMatcher.match(objectTypeName)) {
                    return globalTypeMatcher.match(objectFieldName);
                }
                return true;
            }));
            this.transforms.push(new wrap_1.FilterInputObjectFields((inputObjectTypeName, inputObjectFieldName) => {
                if (typeMatcher.match(inputObjectTypeName)) {
                    return globalTypeMatcher.match(inputObjectFieldName);
                }
                return true;
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
exports.default = WrapFilter;
