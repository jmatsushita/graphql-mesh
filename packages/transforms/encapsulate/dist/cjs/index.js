"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const wrap_1 = require("@graphql-tools/wrap");
const utils_1 = require("@graphql-tools/utils");
const utils_2 = require("@graphql-mesh/utils");
const DEFUALT_APPLY_TO = {
    query: true,
    mutation: true,
    subscription: true,
};
class EncapsulateTransform {
    constructor(options) {
        this.transformMap = {};
        this.transforms = [];
        const config = options.config;
        const name = (config === null || config === void 0 ? void 0 : config.name) || options.apiName;
        if (!name) {
            throw new Error(`Unable to execute encapsulate transform without a name. Please make sure to use it over a specific schema, or specify a name in your configuration!`);
        }
        const applyTo = { ...DEFUALT_APPLY_TO, ...((config === null || config === void 0 ? void 0 : config.applyTo) || {}) };
        if (applyTo.query) {
            this.transformMap.Query = new wrap_1.WrapType('Query', `${name}Query`, name);
        }
        if (applyTo.mutation) {
            this.transformMap.Mutation = new wrap_1.WrapType('Mutation', `${name}Mutation`, name);
        }
        if (applyTo.subscription) {
            this.transformMap.Subscription = new wrap_1.WrapType('Subscription', `${name}Subscription`, name);
        }
    }
    *generateSchemaTransforms(originalWrappingSchema) {
        for (const typeName of Object.keys(this.transformMap)) {
            const fieldConfigMap = (0, utils_1.selectObjectFields)(originalWrappingSchema, typeName, () => true);
            if (Object.keys(fieldConfigMap).length) {
                yield this.transformMap[typeName];
            }
        }
    }
    transformSchema(originalWrappingSchema, subschemaConfig, transformedSchema) {
        this.transforms = [...this.generateSchemaTransforms(originalWrappingSchema)];
        return (0, utils_2.applySchemaTransforms)(originalWrappingSchema, subschemaConfig, transformedSchema, this.transforms);
    }
    transformRequest(originalRequest, delegationContext, transformationContext) {
        return (0, utils_2.applyRequestTransforms)(originalRequest, delegationContext, transformationContext, this.transforms);
    }
    transformResult(originalResult, delegationContext, transformationContext) {
        return (0, utils_2.applyResultTransforms)(originalResult, delegationContext, transformationContext, this.transforms);
    }
}
exports.default = EncapsulateTransform;
