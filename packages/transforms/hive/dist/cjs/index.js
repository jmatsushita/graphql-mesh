"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@graphql-hive/client");
const string_interpolation_1 = require("@graphql-mesh/string-interpolation");
const cross_helpers_1 = require("@graphql-mesh/cross-helpers");
class HiveTransform {
    constructor({ config, pubsub, logger }) {
        var _a;
        const token = string_interpolation_1.stringInterpolator.parse(config.token, {
            env: cross_helpers_1.process.env,
        });
        let usage;
        if (config.usage) {
            usage = {
                max: config.usage.max,
                ttl: config.usage.ttl,
                exclude: config.usage.exclude,
                sampleRate: config.usage.sampleRate,
                processVariables: config.usage.processVariables,
            };
            if ((_a = config.usage) === null || _a === void 0 ? void 0 : _a.clientInfo) {
                usage.clientInfo = function (context) {
                    return {
                        name: string_interpolation_1.stringInterpolator.parse(config.usage.clientInfo.name, {
                            context,
                            env: cross_helpers_1.process.env,
                        }),
                        version: string_interpolation_1.stringInterpolator.parse(config.usage.clientInfo.version, {
                            context,
                            env: cross_helpers_1.process.env,
                        }),
                    };
                };
            }
        }
        let reporting;
        if (config.reporting) {
            reporting = {
                author: string_interpolation_1.stringInterpolator.parse(config.reporting.author, { env: cross_helpers_1.process.env }),
                commit: string_interpolation_1.stringInterpolator.parse(config.reporting.commit, { env: cross_helpers_1.process.env }),
                serviceName: string_interpolation_1.stringInterpolator.parse(config.reporting.serviceName, { env: cross_helpers_1.process.env }),
                serviceUrl: string_interpolation_1.stringInterpolator.parse(config.reporting.serviceUrl, { env: cross_helpers_1.process.env }),
            };
        }
        let agent;
        if (config.agent) {
            agent = {
                timeout: config.agent.timeout,
                maxRetries: config.agent.maxRetries,
                minTimeout: config.agent.minTimeout,
                sendInterval: config.agent.sendInterval,
                maxSize: config.agent.maxSize,
                logger,
            };
        }
        this.hiveClient = (0, client_1.createHive)({
            enabled: true,
            debug: !!cross_helpers_1.process.env.DEBUG,
            token,
            agent,
            usage,
            reporting,
        });
        const id = pubsub.subscribe('destroy', () => {
            this.hiveClient
                .dispose()
                .catch(e => logger.error(`Hive client failed to dispose`, e))
                .finally(() => pubsub.unsubscribe(id));
        });
    }
    transformSchema(schema) {
        this.hiveClient.reportSchema({ schema });
        return schema;
    }
    transformRequest(request, delegationContext, transformationContext) {
        transformationContext.collectUsageCallback = this.hiveClient.collectUsage({
            schema: delegationContext.transformedSchema,
            document: request.document,
            rootValue: request.rootValue,
            contextValue: request.context,
            variableValues: request.variables,
            operationName: request.operationName,
        });
        return request;
    }
    transformResult(result, _delegationContext, transformationContext) {
        transformationContext.collectUsageCallback(result);
        return result;
    }
}
exports.default = HiveTransform;
