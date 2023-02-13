"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const utils_1 = require("@graphql-tools/utils");
const graphql_1 = require("graphql");
const string_interpolation_1 = require("@graphql-mesh/string-interpolation");
const cross_helpers_1 = require("@graphql-mesh/cross-helpers");
class RateLimitTransform {
    constructor(options) {
        this.pathRateLimitDef = new Map();
        this.tokenMap = new Map();
        this.timeouts = new Set();
        this.errors = new WeakMap();
        if (options.config) {
            options.config.forEach(config => {
                this.pathRateLimitDef.set(`${config.type}.${config.field}`, config);
            });
        }
        if (options.pubsub) {
            const id = options.pubsub.subscribe('destroy', () => {
                options.pubsub.unsubscribe(id);
                this.timeouts.forEach(timeout => clearTimeout(timeout));
            });
        }
    }
    transformRequest(executionRequest, delegationContext) {
        const { transformedSchema, rootValue, args, context, info } = delegationContext;
        if (transformedSchema) {
            const errors = [];
            const resolverData = {
                env: cross_helpers_1.process.env,
                root: rootValue,
                args,
                context,
                info,
            };
            const typeInfo = new graphql_1.TypeInfo(transformedSchema);
            let remainingFields = 0;
            const newDocument = (0, graphql_1.visit)(executionRequest.document, (0, graphql_1.visitWithTypeInfo)(typeInfo, {
                Field: () => {
                    const parentType = typeInfo.getParentType();
                    const fieldDef = typeInfo.getFieldDef();
                    const path = `${parentType.name}.${fieldDef.name}`;
                    const rateLimitConfig = this.pathRateLimitDef.get(path);
                    if (rateLimitConfig) {
                        const identifier = string_interpolation_1.stringInterpolator.parse(rateLimitConfig.identifier, resolverData);
                        const mapKey = `${identifier}-${path}`;
                        let remainingTokens = this.tokenMap.get(mapKey);
                        if (remainingTokens == null) {
                            remainingTokens = rateLimitConfig.max;
                            const timeout = setTimeout(() => {
                                this.tokenMap.delete(mapKey);
                                this.timeouts.delete(timeout);
                            }, rateLimitConfig.ttl);
                            this.timeouts.add(timeout);
                        }
                        if (remainingTokens === 0) {
                            errors.push(new graphql_1.GraphQLError(`Rate limit of "${path}" exceeded for "${identifier}"`));
                            // Remove this field from the selection set
                            return null;
                        }
                        else {
                            this.tokenMap.set(mapKey, remainingTokens - 1);
                        }
                    }
                    remainingFields++;
                    return false;
                },
            }));
            if (remainingFields === 0) {
                if (errors.length === 1) {
                    throw errors[0];
                }
                else if (errors.length > 0) {
                    throw new utils_1.AggregateError(errors);
                }
            }
            this.errors.set(delegationContext, errors);
            return {
                ...executionRequest,
                document: newDocument,
            };
        }
        return executionRequest;
    }
    transformResult(result, delegationContext) {
        const errors = this.errors.get(delegationContext);
        if (errors === null || errors === void 0 ? void 0 : errors.length) {
            return {
                ...result,
                errors: [...(result.errors || []), ...errors],
            };
        }
        return result;
    }
}
exports.default = RateLimitTransform;
