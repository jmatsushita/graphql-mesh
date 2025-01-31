"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const wrap_1 = require("@graphql-tools/wrap");
const utils_1 = require("@graphql-mesh/utils");
const shared_js_1 = require("./shared.js");
class WrapPrefix {
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
        const ignoreList = [...(config.ignore || []), ...shared_js_1.ignoreList];
        const includeTypes = config.includeTypes !== false;
        if (includeTypes) {
            this.transforms.push(new wrap_1.RenameTypes(typeName => ignoreList.includes(typeName) ? typeName : `${prefix}${typeName}`));
        }
        const includeRootOperations = config.includeRootOperations === true;
        if (includeRootOperations) {
            this.transforms.push(new wrap_1.RenameRootFields((typeName, fieldName) => ignoreList.includes(typeName) || ignoreList.includes(`${typeName}.${fieldName}`)
                ? fieldName
                : `${prefix}${fieldName}`));
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
exports.default = WrapPrefix;
