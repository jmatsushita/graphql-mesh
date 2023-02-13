import { ApolloLink } from '@apollo/client';
import { ExecuteMeshFn, SubscribeMeshFn } from '@graphql-mesh/runtime';
export interface MeshApolloRequestHandlerOptions {
    execute: ExecuteMeshFn;
    subscribe?: SubscribeMeshFn;
}
export declare class MeshApolloLink extends ApolloLink {
    constructor(options: MeshApolloRequestHandlerOptions);
}
