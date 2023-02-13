import { Plugin } from '@envelop/core';
import { Logger, MeshPubSub, YamlConfig } from '@graphql-mesh/types';
interface InvalidateByResultParams {
    pubsub: MeshPubSub;
    invalidations: YamlConfig.LiveQueryInvalidation[];
    logger: Logger;
}
export declare function useInvalidateByResult(params: InvalidateByResultParams): Plugin;
export {};
