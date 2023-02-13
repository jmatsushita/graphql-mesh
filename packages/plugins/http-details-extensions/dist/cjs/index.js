"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@envelop/core");
const utils_1 = require("@graphql-mesh/utils");
function useIncludeHttpDetailsInExtensions(opts) {
    if (typeof opts.if === 'boolean') {
        if (!opts.if) {
            return {};
        }
    }
    let ifFn = () => true;
    if (typeof opts.if === 'string') {
        ifFn = ({ url, context, info, options, env }) => {
            // eslint-disable-next-line no-new-func
            return new Function('url', 'context', 'info', 'options', 'env', 'return ' + opts.if)(url, context, info, options, env);
        };
    }
    const httpDetailsByContext = new WeakMap();
    function getHttpDetailsByContext(context) {
        let httpDetails = httpDetailsByContext.get(context);
        if (!httpDetails) {
            httpDetails = [];
            httpDetailsByContext.set(context, httpDetails);
        }
        return httpDetails;
    }
    return {
        onFetch({ url, context, info, options }) {
            if (context != null && ifFn({ url, context, info, options, env: process.env })) {
                const requestTimestamp = Date.now();
                return ({ response }) => {
                    const responseTimestamp = Date.now();
                    const responseTime = responseTimestamp - requestTimestamp;
                    const httpDetailsList = getHttpDetailsByContext(context);
                    const httpDetails = {
                        sourceName: info === null || info === void 0 ? void 0 : info.sourceName,
                        path: info === null || info === void 0 ? void 0 : info.path,
                        request: {
                            timestamp: requestTimestamp,
                            url,
                            method: options.method || 'GET',
                            headers: (0, utils_1.getHeadersObj)(options.headers),
                        },
                        response: {
                            timestamp: responseTimestamp,
                            status: response.status,
                            statusText: response.statusText,
                            headers: (0, utils_1.getHeadersObj)(response.headers),
                        },
                        responseTime,
                    };
                    httpDetailsList.push(httpDetails);
                };
            }
            return undefined;
        },
        onExecute({ args: { contextValue } }) {
            return {
                onExecuteDone({ result, setResult }) {
                    if (!(0, core_1.isAsyncIterable)(result)) {
                        const httpDetailsList = httpDetailsByContext.get(contextValue);
                        if (httpDetailsList != null) {
                            setResult({
                                ...result,
                                extensions: {
                                    ...result.extensions,
                                    httpDetails: httpDetailsList,
                                },
                            });
                        }
                    }
                },
            };
        },
    };
}
exports.default = useIncludeHttpDetailsInExtensions;
