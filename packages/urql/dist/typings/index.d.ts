import { Exchange } from '@urql/core';
import { ExecuteMeshFn, SubscribeMeshFn } from '@graphql-mesh/runtime';
export interface MeshExchangeOptions {
    execute: ExecuteMeshFn;
    subscribe?: SubscribeMeshFn;
}
/** Exchange for executing queries locally on a schema using graphql-js. */
export declare const meshExchange: (options: MeshExchangeOptions) => Exchange;
