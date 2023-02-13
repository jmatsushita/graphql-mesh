import { WrapType } from '@graphql-tools/wrap';
import { selectObjectFields } from '@graphql-tools/utils';
import { applyRequestTransforms, applyResultTransforms, applySchemaTransforms, } from '@graphql-mesh/utils';
const DEFUALT_APPLY_TO = {
    query: true,
    mutation: true,
    subscription: true,
};
export default class EncapsulateTransform {
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
            this.transformMap.Query = new WrapType('Query', `${name}Query`, name);
        }
        if (applyTo.mutation) {
            this.transformMap.Mutation = new WrapType('Mutation', `${name}Mutation`, name);
        }
        if (applyTo.subscription) {
            this.transformMap.Subscription = new WrapType('Subscription', `${name}Subscription`, name);
        }
    }
    *generateSchemaTransforms(originalWrappingSchema) {
        for (const typeName of Object.keys(this.transformMap)) {
            const fieldConfigMap = selectObjectFields(originalWrappingSchema, typeName, () => true);
            if (Object.keys(fieldConfigMap).length) {
                yield this.transformMap[typeName];
            }
        }
    }
    transformSchema(originalWrappingSchema, subschemaConfig, transformedSchema) {
        this.transforms = [...this.generateSchemaTransforms(originalWrappingSchema)];
        return applySchemaTransforms(originalWrappingSchema, subschemaConfig, transformedSchema, this.transforms);
    }
    transformRequest(originalRequest, delegationContext, transformationContext) {
        return applyRequestTransforms(originalRequest, delegationContext, transformationContext, this.transforms);
    }
    transformResult(originalResult, delegationContext, transformationContext) {
        return applyResultTransforms(originalResult, delegationContext, transformationContext, this.transforms);
    }
}
