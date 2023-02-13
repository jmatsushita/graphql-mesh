import { applyRequestTransforms, applyResultTransforms, applySchemaTransforms, } from '@graphql-mesh/utils';
import { FilterRootFields, FilterObjectFields, FilterInputObjectFields, FilterTypes, TransformCompositeFields, } from '@graphql-tools/wrap';
import minimatch from 'minimatch';
export default class WrapFilter {
    constructor({ config: { filters } }) {
        this.transforms = [];
        for (const filter of filters) {
            const [typeName, fieldNameOrGlob, argsGlob] = filter.split('.');
            const typeMatcher = new minimatch.Minimatch(typeName);
            // TODO: deprecate this in next major release as dscussed in #1605
            if (!fieldNameOrGlob) {
                this.transforms.push(new FilterTypes(type => {
                    return typeMatcher.match(type.name);
                }));
                continue;
            }
            let fixedFieldGlob = argsGlob || fieldNameOrGlob;
            if (fixedFieldGlob.includes('{') && !fixedFieldGlob.includes(',')) {
                fixedFieldGlob = fieldNameOrGlob.replace('{', '').replace('}', '');
            }
            fixedFieldGlob = fixedFieldGlob.split(', ').join(',');
            const globalTypeMatcher = new minimatch.Minimatch(fixedFieldGlob.trim());
            if (typeName === 'Type') {
                this.transforms.push(new FilterTypes(type => {
                    return globalTypeMatcher.match(type.name);
                }));
                continue;
            }
            if (argsGlob) {
                const fieldMatcher = new minimatch.Minimatch(fieldNameOrGlob);
                this.transforms.push(new TransformCompositeFields((fieldTypeName, fieldName, fieldConfig) => {
                    if (typeMatcher.match(fieldTypeName) && fieldMatcher.match(fieldName)) {
                        const fieldArgs = Object.entries(fieldConfig.args).reduce((args, [argName, argConfig]) => !globalTypeMatcher.match(argName) ? args : { ...args, [argName]: argConfig }, {});
                        return { ...fieldConfig, args: fieldArgs };
                    }
                    return undefined;
                }));
                continue;
            }
            // If the glob is not for Types nor Args, finally we register Fields filters
            this.transforms.push(new FilterRootFields((rootTypeName, rootFieldName) => {
                if (typeMatcher.match(rootTypeName)) {
                    return globalTypeMatcher.match(rootFieldName);
                }
                return true;
            }));
            this.transforms.push(new FilterObjectFields((objectTypeName, objectFieldName) => {
                if (typeMatcher.match(objectTypeName)) {
                    return globalTypeMatcher.match(objectFieldName);
                }
                return true;
            }));
            this.transforms.push(new FilterInputObjectFields((inputObjectTypeName, inputObjectFieldName) => {
                if (typeMatcher.match(inputObjectTypeName)) {
                    return globalTypeMatcher.match(inputObjectFieldName);
                }
                return true;
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
