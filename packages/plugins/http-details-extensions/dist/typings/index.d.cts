import { Path } from '@envelop/core';
import { MeshPlugin } from '@graphql-mesh/types';
export interface MeshFetchHTTPInformation {
    sourceName: string;
    path: Path;
    request: {
        timestamp: number;
        url: string;
        method: string;
        headers: Record<string, string>;
    };
    response: {
        timestamp: number;
        status: number;
        statusText: string;
        headers: Record<string, string>;
    };
    responseTime: number;
}
export default function useIncludeHttpDetailsInExtensions(opts: {
    if: boolean | string | number;
}): MeshPlugin<any>;
