import { GraphQLSchema } from 'graphql';
import { Logger, OnDelegateHook, RawSourceOutput } from '@graphql-mesh/types';
export declare function getInContextSDK(unifiedSchema: GraphQLSchema, rawSources: RawSourceOutput[], logger: Logger, onDelegateHooks: OnDelegateHook<any>[]): Promise<Record<string, any>>;
