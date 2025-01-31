import { RenameTypes, RenameRootFields } from '@graphql-tools/wrap';
import { applyRequestTransforms, applyResultTransforms, applySchemaTransforms, } from '@graphql-mesh/utils';
import { ignoreList as defaultIgnoreList } from './shared.js';
export default class WrapPrefix {
    constructor(options) {
        this.transforms = [];
        const { apiName, config } = options;
        let prefix = null;
        if (config.value) {
            prefix = config.value;
        }
        else if (apiName) {
            prefix = `${apiName}_`;
        }
        if (!prefix) {
            throw new Error(`Transform 'prefix' has missing config: prefix`);
        }
        const ignoreList = [...(config.ignore || []), ...defaultIgnoreList];
        const includeTypes = config.includeTypes !== false;
        if (includeTypes) {
            this.transforms.push(new RenameTypes(typeName => ignoreList.includes(typeName) ? typeName : `${prefix}${typeName}`));
        }
        const includeRootOperations = config.includeRootOperations === true;
        if (includeRootOperations) {
            this.transforms.push(new RenameRootFields((typeName, fieldName) => ignoreList.includes(typeName) || ignoreList.includes(`${typeName}.${fieldName}`)
                ? fieldName
                : `${prefix}${fieldName}`));
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
