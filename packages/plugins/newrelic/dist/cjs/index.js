"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const newrelic_1 = require("@envelop/newrelic");
const string_interpolation_1 = require("@graphql-mesh/string-interpolation");
const cross_helpers_1 = require("@graphql-mesh/cross-helpers");
const http_external_js_1 = tslib_1.__importDefault(require("newrelic/lib/metrics/recorders/http_external.js"));
const names_js_1 = tslib_1.__importDefault(require("newrelic/lib/metrics/names.js"));
const cat_js_1 = tslib_1.__importDefault(require("newrelic/lib/util/cat.js"));
const utils_1 = require("@graphql-mesh/utils");
const newrelic_2 = tslib_1.__importDefault(require("newrelic"));
const EnvelopAttributeName = 'Envelop_NewRelic_Plugin';
function useMeshNewrelic(options) {
    const instrumentationApi = newrelic_2.default === null || newrelic_2.default === void 0 ? void 0 : newrelic_2.default.shim;
    if (!(instrumentationApi === null || instrumentationApi === void 0 ? void 0 : instrumentationApi.agent)) {
        options.logger.debug('Agent unavailable. Please check your New Relic Agent configuration and ensure New Relic is enabled.');
        return {};
    }
    instrumentationApi.agent.metrics
        .getOrCreateMetric(`Supportability/ExternalModules/${EnvelopAttributeName}`)
        .incrementCallCount();
    const logger = instrumentationApi.logger.child({ component: EnvelopAttributeName });
    const segmentByRequestContext = new WeakMap();
    return {
        onPluginInit({ addPlugin }) {
            addPlugin((0, newrelic_1.useNewRelic)({
                ...options,
                extractOperationName: options.extractOperationName
                    ? context => string_interpolation_1.stringInterpolator.parse(options.extractOperationName, {
                        context,
                        env: cross_helpers_1.process.env,
                    })
                    : undefined,
            }));
        },
        onExecute({ args: { contextValue } }) {
            const operationSegment = instrumentationApi.getActiveSegment() || instrumentationApi.getSegment();
            segmentByRequestContext.set(contextValue.request || contextValue, operationSegment);
        },
        onDelegate({ sourceName, fieldName, args, context, key }) {
            var _a, _b;
            const parentSegment = instrumentationApi.getActiveSegment() ||
                instrumentationApi.getSegment() ||
                segmentByRequestContext.get(context.request || context);
            const delimiter = ((_b = (_a = parentSegment === null || parentSegment === void 0 ? void 0 : parentSegment.transaction) === null || _a === void 0 ? void 0 : _a.nameState) === null || _b === void 0 ? void 0 : _b.delimiter) || '/';
            const sourceSegment = instrumentationApi.createSegment(`source${delimiter}${sourceName || 'unknown'}${delimiter}${fieldName}`, null, parentSegment);
            if (options.includeResolverArgs) {
                if (args) {
                    sourceSegment.addAttribute('args', JSON.stringify(args));
                }
                if (key) {
                    sourceSegment.addAttribute('key', JSON.stringify(key));
                }
            }
            sourceSegment.start();
            return ({ result }) => {
                if (options.includeRawResult) {
                    sourceSegment.addAttribute('result', JSON.stringify(result));
                }
                sourceSegment.end();
            };
        },
        onFetch({ url, options, context }) {
            const agent = instrumentationApi === null || instrumentationApi === void 0 ? void 0 : instrumentationApi.agent;
            const parentSegment = instrumentationApi.getActiveSegment() ||
                instrumentationApi.getSegment() ||
                (context ? segmentByRequestContext.get(context.request || context) : undefined);
            const parsedUrl = new URL(url);
            const name = names_js_1.default.EXTERNAL.PREFIX + parsedUrl.host + parsedUrl.pathname;
            const httpDetailSegment = instrumentationApi.createSegment(name, (0, http_external_js_1.default)(parsedUrl.host, 'graphql-mesh'), parentSegment);
            if (!httpDetailSegment) {
                logger.error(`Unable to create segment for external request: ${name}`);
                return undefined;
            }
            httpDetailSegment.start();
            httpDetailSegment.addAttribute('url', url);
            parsedUrl.searchParams.forEach((value, key) => {
                httpDetailSegment.addAttribute(`request.parameters.${key}`, value);
            });
            httpDetailSegment.addAttribute('procedure', options.method || 'GET');
            const transaction = parentSegment === null || parentSegment === void 0 ? void 0 : parentSegment.transaction;
            if (transaction) {
                const outboundHeaders = Object.create(null);
                if (agent.config.encoding_key && transaction.syntheticsHeader) {
                    outboundHeaders['x-newrelic-synthetics'] = transaction.syntheticsHeader;
                }
                if (agent.config.distributed_tracing.enabled) {
                    transaction.insertDistributedTraceHeaders(outboundHeaders);
                }
                else if (agent.config.cross_application_tracer.enabled) {
                    cat_js_1.default.addCatHeaders(agent.config, transaction, outboundHeaders);
                }
                else {
                    logger.trace('Both DT and CAT are disabled, not adding headers!');
                }
                for (const key in outboundHeaders) {
                    options.headers[key] = outboundHeaders[key];
                }
            }
            for (const key in options.headers) {
                httpDetailSegment.addAttribute(`request.headers.${key}`, options.headers[key]);
            }
            return ({ response }) => {
                httpDetailSegment.addAttribute('http.statusCode', response.status);
                httpDetailSegment.addAttribute('http.statusText', response.statusText);
                const responseHeadersObj = (0, utils_1.getHeadersObj)(response.headers);
                for (const key in responseHeadersObj) {
                    httpDetailSegment.addAttribute(`response.headers.${key}`, responseHeadersObj[key]);
                }
                if (agent.config.cross_application_tracer.enabled &&
                    !agent.config.distributed_tracing.enabled) {
                    try {
                        const { appData } = cat_js_1.default.extractCatHeaders(responseHeadersObj);
                        const decodedAppData = cat_js_1.default.parseAppData(agent.config, appData);
                        const attrs = httpDetailSegment.getAttributes();
                        const url = new URL(attrs.url);
                        cat_js_1.default.assignCatToSegment(decodedAppData, httpDetailSegment, url.host);
                    }
                    catch (err) {
                        logger.warn(err, 'Cannot add CAT data to segment');
                    }
                }
                httpDetailSegment.end();
            };
        },
    };
}
exports.default = useMeshNewrelic;
