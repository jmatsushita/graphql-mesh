"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const prom_client_1 = require("prom-client");
const utils_1 = require("@graphql-mesh/utils");
const plugin_prometheus_1 = require("@graphql-yoga/plugin-prometheus");
const createHistogramForEnvelop_js_1 = require("./createHistogramForEnvelop.js");
async function useMeshPrometheus(pluginOptions) {
    const registry = pluginOptions.registry
        ? await (0, utils_1.loadFromModuleExportExpression)(pluginOptions.registry, {
            cwd: pluginOptions.baseDir,
            importFn: pluginOptions.importFn,
            defaultExportName: 'default',
        })
        : prom_client_1.register;
    let fetchHistogram;
    if (pluginOptions.fetch) {
        const name = typeof pluginOptions.fetch === 'string' ? pluginOptions.fetch : 'graphql_mesh_fetch_duration';
        fetchHistogram = new prom_client_1.Histogram({
            name,
            help: 'Time spent on outgoing HTTP calls',
            labelNames: [
                'url',
                'method',
                'requestHeaders',
                'statusCode',
                'statusText',
                'responseHeaders',
            ],
            registers: [registry],
        });
    }
    let delegateHistogram;
    if (pluginOptions.delegation) {
        const name = typeof pluginOptions.delegation === 'string'
            ? pluginOptions.delegation
            : 'graphql_mesh_delegate_duration';
        delegateHistogram = new prom_client_1.Histogram({
            name,
            help: 'Time spent on delegate execution',
            labelNames: ['sourceName', 'typeName', 'fieldName', 'args', 'key'],
            registers: [registry],
        });
    }
    let httpHistogram;
    if (pluginOptions.http) {
        const labelNames = ['url', 'method', 'statusCode', 'statusText', 'responseHeaders'];
        if (pluginOptions.httpRequestHeaders) {
            labelNames.push('requestHeaders');
        }
        const name = typeof pluginOptions.http === 'string' ? pluginOptions.http : 'graphql_mesh_http_duration';
        httpHistogram = {
            histogram: new prom_client_1.Histogram({
                name,
                help: 'Time spent on incoming HTTP requests',
                labelNames,
                registers: [registry],
            }),
            fillLabelsFn(_, { request, response }) {
                const labels = {
                    url: request.url,
                    method: request.method,
                    statusCode: response.status,
                    statusText: response.statusText,
                    responseHeaders: JSON.stringify((0, utils_1.getHeadersObj)(response.headers)),
                };
                if (pluginOptions.httpRequestHeaders) {
                    labels.requestHeaders = JSON.stringify((0, utils_1.getHeadersObj)(request.headers));
                }
                return labels;
            },
        };
    }
    let requestCounter;
    if (pluginOptions.requestCount) {
        const name = typeof pluginOptions.requestCount === 'string'
            ? pluginOptions.requestCount
            : 'graphql_mesh_request_count';
        requestCounter = {
            counter: new prom_client_1.Counter({
                name,
                help: 'Counts the amount of GraphQL requests executed',
                labelNames: createHistogramForEnvelop_js_1.commonLabelsForEnvelop,
                registers: [registry],
            }),
            fillLabelsFn: createHistogramForEnvelop_js_1.commonFillLabelsFnForEnvelop,
        };
    }
    let requestSummary;
    if (pluginOptions.requestSummary) {
        const name = typeof pluginOptions.requestSummary === 'string'
            ? pluginOptions.requestSummary
            : 'graphql_mesh_request_time_summary';
        requestSummary = {
            summary: new prom_client_1.Summary({
                name,
                help: 'Summary to measure the time to complete GraphQL operations',
                labelNames: createHistogramForEnvelop_js_1.commonLabelsForEnvelop,
                registers: [registry],
            }),
            fillLabelsFn: createHistogramForEnvelop_js_1.commonFillLabelsFnForEnvelop,
        };
    }
    let errorsCounter;
    if (pluginOptions.errors) {
        const name = typeof pluginOptions.errors === 'string' ? pluginOptions.errors : 'graphql_mesh_error_result';
        errorsCounter = {
            counter: new prom_client_1.Counter({
                name,
                help: 'Counts the amount of errors reported from all phases',
                labelNames: ['operationType', 'operationName', 'path', 'phase'],
                registers: [registry],
            }),
            fillLabelsFn: params => {
                var _a, _b;
                return ({
                    operationName: params.operationName,
                    operationType: params.operationType,
                    path: (_b = (_a = params.error) === null || _a === void 0 ? void 0 : _a.path) === null || _b === void 0 ? void 0 : _b.join('.'),
                    phase: params.errorPhase,
                });
            },
        };
    }
    let deprecatedCounter;
    if (pluginOptions.deprecatedFields) {
        const name = typeof pluginOptions.deprecatedFields === 'string'
            ? pluginOptions.deprecatedFields
            : 'graphql_mesh_deprecated_fields';
        deprecatedCounter = {
            counter: new prom_client_1.Counter({
                name,
                help: 'Counts the amount of deprecated fields used in selection sets',
                labelNames: ['operationType', 'operationName', 'fieldName', 'typeName'],
                registers: [registry],
            }),
            fillLabelsFn: params => {
                var _a, _b;
                return ({
                    operationName: params.operationName,
                    operationType: params.operationType,
                    fieldName: (_a = params.deprecationInfo) === null || _a === void 0 ? void 0 : _a.fieldName,
                    typeName: (_b = params.deprecationInfo) === null || _b === void 0 ? void 0 : _b.typeName,
                });
            },
        };
    }
    return {
        onPluginInit({ addPlugin }) {
            addPlugin((0, plugin_prometheus_1.usePrometheus)({
                ...pluginOptions,
                http: httpHistogram,
                requestCount: requestCounter,
                requestTotalDuration: (0, createHistogramForEnvelop_js_1.createHistogramForEnvelop)({
                    defaultName: 'graphql_mesh_request_duration',
                    valueFromConfig: pluginOptions.requestTotalDuration,
                    help: 'Time spent on running the GraphQL operation from parse to execute',
                    registry,
                }),
                requestSummary,
                parse: (0, createHistogramForEnvelop_js_1.createHistogramForEnvelop)({
                    defaultName: 'graphql_mesh_parse_duration',
                    valueFromConfig: pluginOptions.parse,
                    help: 'Time spent on parsing the GraphQL operation',
                    registry,
                }),
                validate: (0, createHistogramForEnvelop_js_1.createHistogramForEnvelop)({
                    defaultName: 'graphql_mesh_validate_duration',
                    valueFromConfig: pluginOptions.validate,
                    help: 'Time spent on validating the GraphQL operation',
                    registry,
                }),
                contextBuilding: (0, createHistogramForEnvelop_js_1.createHistogramForEnvelop)({
                    defaultName: 'graphql_mesh_context_building_duration',
                    valueFromConfig: pluginOptions.contextBuilding,
                    help: 'Time spent on building the GraphQL context',
                    registry,
                }),
                execute: (0, createHistogramForEnvelop_js_1.createHistogramForEnvelop)({
                    defaultName: 'graphql_mesh_execute_duration',
                    valueFromConfig: pluginOptions.execute,
                    help: 'Time spent on executing the GraphQL operation',
                    registry,
                }),
                errors: errorsCounter,
                deprecatedFields: deprecatedCounter,
                registry,
            }));
        },
        onDelegate({ sourceName, typeName, fieldName, args, key }) {
            if (delegateHistogram) {
                const start = Date.now();
                return () => {
                    const end = Date.now();
                    const duration = end - start;
                    delegateHistogram.observe({
                        sourceName,
                        typeName,
                        fieldName,
                        args: JSON.stringify(args),
                        key: JSON.stringify(key),
                    }, duration);
                };
            }
            return undefined;
        },
        onFetch({ url, options }) {
            if (fetchHistogram) {
                const start = Date.now();
                return ({ response }) => {
                    const end = Date.now();
                    const duration = end - start;
                    fetchHistogram.observe({
                        url,
                        method: options.method,
                        requestHeaders: JSON.stringify(options.headers),
                        statusCode: response.status,
                        statusText: response.statusText,
                        responseHeaders: JSON.stringify((0, utils_1.getHeadersObj)(response.headers)),
                    }, duration);
                };
            }
            return undefined;
        },
    };
}
exports.default = useMeshPrometheus;
