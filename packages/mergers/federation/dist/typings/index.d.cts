import { MeshMerger, MeshMergerContext, MeshMergerOptions } from '@graphql-mesh/types';
import { GraphQLSchema, ExecutionResult } from 'graphql';
import { ExecutionRequest } from '@graphql-tools/utils';
export default class FederationMerger implements MeshMerger {
    name: string;
    private logger;
    private cache;
    private pubsub;
    private store;
    constructor(options: MeshMergerOptions);
    getUnifiedSchema({ rawSources, typeDefs, resolvers }: MeshMergerContext): Promise<{
        schema: GraphQLSchema;
        executor: <TReturn>({ document, info, variables, context, operationName, }: ExecutionRequest) => ExecutionResult<TReturn, import("graphql/jsutils/ObjMap").ObjMap<unknown>>;
    }>;
}
