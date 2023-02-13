import { GraphQLSchema } from 'graphql';
import { Logger } from '@graphql-mesh/types';
import { Executor } from '@graphql-tools/utils';
export declare function createJITExecutor(schema: GraphQLSchema, prefix: string, logger: Logger): Executor;
