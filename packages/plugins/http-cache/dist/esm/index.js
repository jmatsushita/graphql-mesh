import { getHeadersObj } from '@graphql-mesh/utils';
import CachePolicy from 'http-cache-semantics';
import { Response } from '@whatwg-node/fetch';
export default function useHTTPCache({ cache }) {
    return {
        async onFetch({ url, options, fetchFn, setFetchFn }) {
            if (options.cache === 'no-cache') {
                return () => { };
            }
            const reqHeaders = getHeadersObj(options.headers);
            const policyRequest = {
                url,
                method: options.method,
                headers: reqHeaders,
            };
            const cacheEntry = (await cache.get(url));
            if (cacheEntry) {
                const policy = CachePolicy.fromObject(cacheEntry.policy);
                setFetchFn(async (url, options, context, info) => {
                    if (options.cache !== 'reload' && (policy === null || policy === void 0 ? void 0 : policy.satisfiesWithoutRevalidation(policyRequest))) {
                        const resHeaders = {};
                        const policyHeaders = policy.responseHeaders();
                        for (const key in policyHeaders) {
                            const value = policyHeaders[key];
                            if (Array.isArray(value)) {
                                resHeaders[key] = value.join(', ');
                            }
                            else {
                                resHeaders[key] = value;
                            }
                        }
                        const response = new Response(cacheEntry.body, {
                            status: cacheEntry.response.status,
                            headers: resHeaders,
                        });
                        return response;
                    }
                    const policyHeaders = policy.revalidationHeaders(policyRequest);
                    const reqHeaders = {};
                    for (const key in policyHeaders) {
                        const value = policyHeaders[key];
                        if (Array.isArray(value)) {
                            reqHeaders[key] = value.join(', ');
                        }
                        else {
                            reqHeaders[key] = value;
                        }
                    }
                    const revalidationRequest = {
                        url,
                        method: options.method,
                        headers: reqHeaders,
                    };
                    const revalidationResponse = await fetchFn(url, {
                        ...options,
                        method: revalidationRequest.method,
                        headers: {
                            ...options.headers,
                            ...revalidationRequest.headers,
                        },
                    }, context, info);
                    const { policy: revalidatedPolicy, modified } = policy.revalidatedPolicy(revalidationRequest, {
                        status: revalidationResponse.status,
                        headers: getHeadersObj(revalidationResponse.headers),
                    });
                    const newBody = await revalidationResponse.text();
                    const resHeaders = {};
                    const resPolicyHeaders = revalidatedPolicy.responseHeaders();
                    for (const key in resPolicyHeaders) {
                        const value = resPolicyHeaders[key];
                        if (Array.isArray(value)) {
                            resHeaders[key] = value.join(', ');
                        }
                        else {
                            resHeaders[key] = value;
                        }
                    }
                    return new Response(modified ? newBody : cacheEntry.body, {
                        status: revalidationResponse.status,
                        headers: resHeaders,
                    });
                });
            }
            if (options.cache === 'no-store') {
                return () => { };
            }
            return async ({ response, setResponse }) => {
                const resHeaders = getHeadersObj(response.headers);
                const policyResponse = {
                    status: response.status,
                    headers: resHeaders,
                };
                const policy = new CachePolicy(policyRequest, policyResponse);
                if (policy.storable()) {
                    const resText = await response.text();
                    const cacheEntry = {
                        policy: policy.toObject(),
                        response: policyResponse,
                        body: resText,
                    };
                    let ttl = Math.round(policy.timeToLive() / 1000);
                    if (ttl > 0) {
                        // If a response can be revalidated, we don't want to remove it from the cache right after it expires.
                        // We may be able to use better heuristics here, but for now we'll take the max-age times 2.
                        if (canBeRevalidated(response)) {
                            ttl *= 2;
                        }
                        await cache.set(url, cacheEntry, { ttl });
                        setResponse(new Response(resText, {
                            status: response.status,
                            headers: resHeaders,
                        }));
                    }
                }
            };
        },
    };
}
function canBeRevalidated(response) {
    return response.headers.has('ETag');
}
