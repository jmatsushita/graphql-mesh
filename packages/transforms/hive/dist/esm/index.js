import { createHive } from '@graphql-hive/client';
import { stringInterpolator } from '@graphql-mesh/string-interpolation';
import { process } from '@graphql-mesh/cross-helpers';
export default class HiveTransform {
    constructor({ config, pubsub, logger }) {
        var _a;
        const token = stringInterpolator.parse(config.token, {
            env: process.env,
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
                        name: stringInterpolator.parse(config.usage.clientInfo.name, {
                            context,
                            env: process.env,
                        }),
                        version: stringInterpolator.parse(config.usage.clientInfo.version, {
                            context,
                            env: process.env,
                        }),
                    };
                };
            }
        }
        let reporting;
        if (config.reporting) {
            reporting = {
                author: stringInterpolator.parse(config.reporting.author, { env: process.env }),
                commit: stringInterpolator.parse(config.reporting.commit, { env: process.env }),
                serviceName: stringInterpolator.parse(config.reporting.serviceName, { env: process.env }),
                serviceUrl: stringInterpolator.parse(config.reporting.serviceUrl, { env: process.env }),
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
        this.hiveClient = createHive({
            enabled: true,
            debug: !!process.env.DEBUG,
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
