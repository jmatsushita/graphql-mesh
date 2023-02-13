"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@graphql-hive/client");
const cross_helpers_1 = require("@graphql-mesh/cross-helpers");
const string_interpolation_1 = require("@graphql-mesh/string-interpolation");
function useMeshHive(pluginOptions) {
    var _a;
    const token = string_interpolation_1.stringInterpolator.parse(pluginOptions.token, {
        env: cross_helpers_1.process.env,
    });
    if (!token) {
        return {};
    }
    let usage;
    if (pluginOptions.usage) {
        usage = {
            max: pluginOptions.usage.max,
            ttl: pluginOptions.usage.ttl,
            exclude: pluginOptions.usage.exclude,
            sampleRate: pluginOptions.usage.sampleRate,
            processVariables: pluginOptions.usage.processVariables,
        };
        if ((_a = pluginOptions.usage) === null || _a === void 0 ? void 0 : _a.clientInfo) {
            usage.clientInfo = function (context) {
                return {
                    name: string_interpolation_1.stringInterpolator.parse(pluginOptions.usage.clientInfo.name, {
                        context,
                        env: cross_helpers_1.process.env,
                    }),
                    version: string_interpolation_1.stringInterpolator.parse(pluginOptions.usage.clientInfo.version, {
                        context,
                        env: cross_helpers_1.process.env,
                    }),
                };
            };
        }
    }
    let reporting;
    if (pluginOptions.reporting) {
        reporting = {
            author: string_interpolation_1.stringInterpolator.parse(pluginOptions.reporting.author, { env: cross_helpers_1.process.env }),
            commit: string_interpolation_1.stringInterpolator.parse(pluginOptions.reporting.commit, { env: cross_helpers_1.process.env }),
            serviceName: string_interpolation_1.stringInterpolator.parse(pluginOptions.reporting.serviceName, {
                env: cross_helpers_1.process.env,
            }),
            serviceUrl: string_interpolation_1.stringInterpolator.parse(pluginOptions.reporting.serviceUrl, {
                env: cross_helpers_1.process.env,
            }),
        };
    }
    let agent;
    if (pluginOptions.agent) {
        agent = {
            timeout: pluginOptions.agent.timeout,
            maxRetries: pluginOptions.agent.maxRetries,
            minTimeout: pluginOptions.agent.minTimeout,
            sendInterval: pluginOptions.agent.sendInterval,
            maxSize: pluginOptions.agent.maxSize,
            logger: pluginOptions.logger,
        };
    }
    const hiveClient = (0, client_1.createHive)({
        enabled: true,
        debug: !!cross_helpers_1.process.env.DEBUG,
        token,
        agent,
        usage,
        reporting,
    });
    const id = pluginOptions.pubsub.subscribe('destroy', () => {
        hiveClient
            .dispose()
            .catch(e => pluginOptions.logger.error(`Hive client failed to dispose`, e))
            .finally(() => pluginOptions.pubsub.unsubscribe(id));
    });
    return {
        onPluginInit({ addPlugin }) {
            addPlugin((0, client_1.useHive)(hiveClient));
        },
    };
}
exports.default = useMeshHive;
