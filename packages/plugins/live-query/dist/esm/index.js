import { useLiveQuery } from '@envelop/live-query';
import { defaultResourceIdentifierNormalizer, InMemoryLiveQueryStore, } from '@n1ru4l/in-memory-live-query-store';
import { useInvalidateByResult } from './useInvalidateByResult.js';
import { process } from '@graphql-mesh/cross-helpers';
import { stringInterpolator } from '@graphql-mesh/string-interpolation';
export default function useMeshLiveQuery(options) {
    options.logger.debug(`Creating Live Query Store`);
    const liveQueryStore = new InMemoryLiveQueryStore({
        buildResourceIdentifier: options.resourceIdentifier != null
            ? function resourceIdentifierFactory({ typename, id }) {
                return stringInterpolator.parse(options.resourceIdentifier, {
                    typename,
                    id,
                    env: process.env,
                });
            }
            : defaultResourceIdentifierNormalizer,
        includeIdentifierExtension: options.includeIdentifierExtension != null
            ? options.includeIdentifierExtension
            : process.env.DEBUG === '1',
        idFieldName: options.idFieldName,
        indexBy: options.indexBy,
    });
    options.pubsub.subscribe('live-query:invalidate', (identifiers) => liveQueryStore.invalidate(identifiers));
    return {
        onPluginInit({ addPlugin }) {
            var _a;
            addPlugin(useLiveQuery({ liveQueryStore }));
            if ((_a = options.invalidations) === null || _a === void 0 ? void 0 : _a.length) {
                addPlugin(useInvalidateByResult({
                    pubsub: options.pubsub,
                    invalidations: options.invalidations,
                    logger: options.logger,
                }));
            }
        },
    };
}
