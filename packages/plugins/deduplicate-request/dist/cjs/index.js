"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const utils_1 = require("@graphql-mesh/utils");
function useDeduplicateRequest() {
    const reqResMapByContext = new WeakMap();
    function getReqResMapByContext(context) {
        let reqResMap = reqResMapByContext.get(context);
        if (!reqResMap) {
            reqResMap = new Map();
            reqResMapByContext.set(context, reqResMap);
        }
        return reqResMap;
    }
    return {
        onFetch({ url, options, context, info, fetchFn, setFetchFn }) {
            if (context != null) {
                let method = 'GET';
                if (options.method) {
                    method = options.method;
                }
                if (method === 'GET') {
                    let headers = {};
                    if (options.headers) {
                        headers = (0, utils_1.getHeadersObj)(options.headers);
                    }
                    const reqResMap = getReqResMapByContext(context);
                    const dedupCacheKey = JSON.stringify({
                        url,
                        headers,
                    });
                    setFetchFn(() => {
                        let dedupRes$ = reqResMap.get(dedupCacheKey);
                        if (dedupRes$ == null) {
                            dedupRes$ = fetchFn(url, options, context, info);
                            reqResMap.set(dedupCacheKey, dedupRes$);
                        }
                        return dedupRes$;
                    });
                }
            }
        },
    };
}
exports.default = useDeduplicateRequest;