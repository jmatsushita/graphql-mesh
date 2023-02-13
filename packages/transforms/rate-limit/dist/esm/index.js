import { AggregateError } from '@graphql-tools/utils';
import { GraphQLError, TypeInfo, visit, visitWithTypeInfo } from 'graphql';
import { stringInterpolator } from '@graphql-mesh/string-interpolation';
import { process } from '@graphql-mesh/cross-helpers';
export default class RateLimitTransform {
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
                env: process.env,
                root: rootValue,
                args,
                context,
                info,
            };
            const typeInfo = new TypeInfo(transformedSchema);
            let remainingFields = 0;
            const newDocument = visit(executionRequest.document, visitWithTypeInfo(typeInfo, {
                Field: () => {
                    const parentType = typeInfo.getParentType();
                    const fieldDef = typeInfo.getFieldDef();
                    const path = `${parentType.name}.${fieldDef.name}`;
                    const rateLimitConfig = this.pathRateLimitDef.get(path);
                    if (rateLimitConfig) {
                        const identifier = stringInterpolator.parse(rateLimitConfig.identifier, resolverData);
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
                            errors.push(new GraphQLError(`Rate limit of "${path}" exceeded for "${identifier}"`));
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
                    throw new AggregateError(errors);
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
