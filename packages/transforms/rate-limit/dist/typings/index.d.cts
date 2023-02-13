import { MeshTransform, MeshTransformOptions, YamlConfig } from '@graphql-mesh/types';
import { ExecutionRequest } from '@graphql-tools/utils';
import type { DelegationContext } from '@graphql-tools/delegate';
import { ExecutionResult } from 'graphql';
export default class RateLimitTransform implements MeshTransform {
    private pathRateLimitDef;
    private tokenMap;
    private timeouts;
    constructor(options: MeshTransformOptions<YamlConfig.RateLimitTransformConfig[]>);
    private errors;
    transformRequest(executionRequest: ExecutionRequest, delegationContext: DelegationContext): ExecutionRequest;
    transformResult(result: ExecutionResult, delegationContext: DelegationContext): ExecutionResult<import("graphql/jsutils/ObjMap").ObjMap<unknown>, import("graphql/jsutils/ObjMap").ObjMap<unknown>>;
}
