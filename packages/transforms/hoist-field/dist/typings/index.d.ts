import { MeshTransform, MeshTransformOptions, YamlConfig } from '@graphql-mesh/types';
import { DelegationContext, SubschemaConfig } from '@graphql-tools/delegate';
import { ExecutionRequest, ExecutionResult } from '@graphql-tools/utils';
import { GraphQLSchema } from 'graphql';
export default class MeshHoistField implements MeshTransform {
    noWrap: boolean;
    private transforms;
    constructor({ config }: MeshTransformOptions<YamlConfig.HoistFieldTransformConfig[]>);
    private getPathConfigItem;
    transformSchema(originalWrappingSchema: GraphQLSchema, subschemaConfig: SubschemaConfig, transformedSchema?: GraphQLSchema): GraphQLSchema;
    transformRequest(originalRequest: ExecutionRequest, delegationContext: DelegationContext, transformationContext: Record<string, any>): ExecutionRequest<any, any, any, Record<string, any>, any>;
    transformResult(originalResult: ExecutionResult, delegationContext: DelegationContext, transformationContext: any): ExecutionResult<any, any>;
}
