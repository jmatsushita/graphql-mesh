"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const string_interpolation_1 = require("@graphql-mesh/string-interpolation");
const utils_1 = require("@graphql-mesh/utils");
const minimatch_1 = tslib_1.__importDefault(require("minimatch"));
const cross_helpers_1 = require("@graphql-mesh/cross-helpers");
const fetch_1 = require("@whatwg-node/fetch");
function calculateCacheKey(url, options) {
    return (0, string_interpolation_1.hashObject)({
        url,
        options,
    });
}
function useSnapshot(pluginOptions) {
    if (typeof pluginOptions.if === 'boolean') {
        if (!pluginOptions.if) {
            return {};
        }
    }
    if (typeof pluginOptions.if === 'string') {
        // eslint-disable-next-line no-new-func
        if (!new Function('env', 'return ' + pluginOptions.if)(cross_helpers_1.process.env)) {
            return {};
        }
    }
    const matches = pluginOptions.apply.map(glob => new minimatch_1.default.Minimatch(glob));
    const snapshotsDir = pluginOptions.outputDir || '__snapshots__';
    return {
        async onFetch({ url, options, setFetchFn }) {
            if (matches.some(matcher => matcher.match(url))) {
                const snapshotFileName = calculateCacheKey(url, options);
                const snapshotPath = cross_helpers_1.path.join(pluginOptions.baseDir, snapshotsDir, `${snapshotFileName}.json`);
                if (await (0, utils_1.pathExists)(snapshotPath)) {
                    setFetchFn(async () => {
                        const snapshotFile = await cross_helpers_1.fs.promises.readFile(snapshotPath, 'utf-8');
                        const snapshot = JSON.parse(snapshotFile);
                        return new fetch_1.Response(snapshot.text, {
                            headers: snapshot.headersObj,
                            status: snapshot.status,
                            statusText: snapshot.statusText,
                        });
                    });
                    return () => { };
                }
                return async ({ response, setResponse }) => {
                    const contentType = response.headers.get('content-type');
                    if (contentType.includes('json') ||
                        contentType.includes('text') ||
                        contentType.includes('xml')) {
                        const snapshot = {
                            text: await response.text(),
                            headersObj: (0, utils_1.getHeadersObj)(response.headers),
                            status: response.status,
                            statusText: response.statusText,
                        };
                        await (0, utils_1.writeJSON)(snapshotPath, snapshot, null, 2);
                        setResponse(new fetch_1.Response(snapshot.text, {
                            headers: snapshot.headersObj,
                            status: snapshot.status,
                            statusText: snapshot.statusText,
                        }));
                    }
                };
            }
            return () => { };
        },
    };
}
exports.default = useSnapshot;
