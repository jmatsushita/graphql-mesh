"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const hot_shots_1 = tslib_1.__importDefault(require("hot-shots"));
const statsd_1 = require("@envelop/statsd");
const utils_1 = require("@graphql-mesh/utils");
const metricNames = {
    delegationCount: 'delegations.count',
    delegationErrorCount: 'delegations.error.count',
    delegationLatency: 'delegations.latency',
    fetchCount: 'fetch.count',
    fetchErrorCount: 'fetch.error.count',
    fetchLatency: 'fetch.latency',
};
function useMeshStatsd(pluginOptions) {
    const client = new hot_shots_1.default(pluginOptions.client);
    const prefix = pluginOptions.prefix || 'graphql';
    return {
        onPluginInit({ addPlugin }) {
            addPlugin((0, statsd_1.useStatsD)({
                ...pluginOptions,
                client,
            }));
        },
        onFetch({ url, options, info }) {
            const tags = {
                url,
                method: options.method,
                sourceName: info === null || info === void 0 ? void 0 : info.sourceName,
                fieldName: info === null || info === void 0 ? void 0 : info.fieldName,
                requestHeaders: JSON.stringify(options.headers),
            };
            const start = Date.now();
            return ({ response }) => {
                tags.statusCode = response.status.toString();
                tags.statusText = response.statusText;
                const responseHeadersObj = (0, utils_1.getHeadersObj)(response.headers);
                tags.responseHeaders = JSON.stringify(responseHeadersObj);
                client.increment(`${prefix}.${metricNames.fetchCount}`, tags);
                const end = Date.now();
                if (!response.ok) {
                    client.increment(`${prefix}.${metricNames.fetchErrorCount}`, tags);
                }
                client.histogram(`${prefix}.${metricNames.fetchLatency}`, end - start, tags);
            };
        },
        onDelegate({ sourceName, fieldName, args, key }) {
            const tags = {
                sourceName,
                fieldName,
                args: JSON.stringify(args),
                key,
            };
            const start = Date.now();
            return ({ result }) => {
                if (result instanceof Error) {
                    client.increment(`${prefix}.${metricNames.delegationErrorCount}`, tags);
                }
                client.increment(`${prefix}.${metricNames.delegationCount}`, tags);
                const end = Date.now();
                client.histogram(`${prefix}.${metricNames.delegationLatency}`, end - start, tags);
            };
        },
    };
}
exports.default = useMeshStatsd;
