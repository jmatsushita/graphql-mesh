"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const live_query_1 = require("@envelop/live-query");
const in_memory_live_query_store_1 = require("@n1ru4l/in-memory-live-query-store");
const useInvalidateByResult_js_1 = require("./useInvalidateByResult.js");
const cross_helpers_1 = require("@graphql-mesh/cross-helpers");
const string_interpolation_1 = require("@graphql-mesh/string-interpolation");
function useMeshLiveQuery(options) {
    options.logger.debug(`Creating Live Query Store`);
    const liveQueryStore = new in_memory_live_query_store_1.InMemoryLiveQueryStore({
        buildResourceIdentifier: options.resourceIdentifier != null
            ? function resourceIdentifierFactory({ typename, id }) {
                return string_interpolation_1.stringInterpolator.parse(options.resourceIdentifier, {
                    typename,
                    id,
                    env: cross_helpers_1.process.env,
                });
            }
            : in_memory_live_query_store_1.defaultResourceIdentifierNormalizer,
        includeIdentifierExtension: options.includeIdentifierExtension != null
            ? options.includeIdentifierExtension
            : cross_helpers_1.process.env.DEBUG === '1',
        idFieldName: options.idFieldName,
        indexBy: options.indexBy,
    });
    options.pubsub.subscribe('live-query:invalidate', (identifiers) => liveQueryStore.invalidate(identifiers));
    return {
        onPluginInit({ addPlugin }) {
            var _a;
            addPlugin((0, live_query_1.useLiveQuery)({ liveQueryStore }));
            if ((_a = options.invalidations) === null || _a === void 0 ? void 0 : _a.length) {
                addPlugin((0, useInvalidateByResult_js_1.useInvalidateByResult)({
                    pubsub: options.pubsub,
                    invalidations: options.invalidations,
                    logger: options.logger,
                }));
            }
        },
    };
}
exports.default = useMeshLiveQuery;
