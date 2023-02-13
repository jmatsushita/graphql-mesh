import { hashObject } from '@graphql-mesh/string-interpolation';
import { getHeadersObj, pathExists, writeJSON } from '@graphql-mesh/utils';
import minimatch from 'minimatch';
import { fs, path, process } from '@graphql-mesh/cross-helpers';
import { Response } from '@whatwg-node/fetch';
function calculateCacheKey(url, options) {
    return hashObject({
        url,
        options,
    });
}
export default function useSnapshot(pluginOptions) {
    if (typeof pluginOptions.if === 'boolean') {
        if (!pluginOptions.if) {
            return {};
        }
    }
    if (typeof pluginOptions.if === 'string') {
        // eslint-disable-next-line no-new-func
        if (!new Function('env', 'return ' + pluginOptions.if)(process.env)) {
            return {};
        }
    }
    const matches = pluginOptions.apply.map(glob => new minimatch.Minimatch(glob));
    const snapshotsDir = pluginOptions.outputDir || '__snapshots__';
    return {
        async onFetch({ url, options, setFetchFn }) {
            if (matches.some(matcher => matcher.match(url))) {
                const snapshotFileName = calculateCacheKey(url, options);
                const snapshotPath = path.join(pluginOptions.baseDir, snapshotsDir, `${snapshotFileName}.json`);
                if (await pathExists(snapshotPath)) {
                    setFetchFn(async () => {
                        const snapshotFile = await fs.promises.readFile(snapshotPath, 'utf-8');
                        const snapshot = JSON.parse(snapshotFile);
                        return new Response(snapshot.text, {
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
                            headersObj: getHeadersObj(response.headers),
                            status: response.status,
                            statusText: response.statusText,
                        };
                        await writeJSON(snapshotPath, snapshot, null, 2);
                        setResponse(new Response(snapshot.text, {
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
