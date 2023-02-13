import { GraphQLSchema } from 'graphql';
import { MeshFetch } from '@graphql-mesh/types';
import { Executor } from '@graphql-tools/utils';
export declare function createExecutorFromSchemaAST(schema: GraphQLSchema, fetchFn: MeshFetch): Executor<Record<string, any>, Record<string, any>>;
