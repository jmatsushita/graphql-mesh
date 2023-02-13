import { MeshTransform, MeshTransformOptions, YamlConfig } from '@graphql-mesh/types';
import { HiveClient } from '@graphql-hive/client';
import { ExecutionResult, GraphQLSchema } from 'graphql';
import { DelegationContext } from '@graphql-tools/delegate';
import { ExecutionRequest } from '@graphql-tools/utils';
interface TransformationContext {
    collectUsageCallback: ReturnType<HiveClient['collectUsage']>;
}
export default class HiveTransform implements MeshTransform {
    private hiveClient;
    constructor({ config, pubsub, logger }: MeshTransformOptions<YamlConfig.HivePlugin>);
    transformSchema(schema: GraphQLSchema): GraphQLSchema;
    transformRequest(request: ExecutionRequest, delegationContext: DelegationContext, transformationContext: TransformationContext): ExecutionRequest<any, any, any, Record<string, any>, any>;
    transformResult(result: ExecutionResult, _delegationContext: DelegationContext, transformationContext: TransformationContext): ExecutionResult<import("graphql/jsutils/ObjMap").ObjMap<unknown>, import("graphql/jsutils/ObjMap").ObjMap<unknown>>;
}
export {};
