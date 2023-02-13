import { GraphQLSchema } from 'graphql';
import { MeshTransform, YamlConfig, MeshTransformOptions } from '@graphql-mesh/types';
import { ExecutionResult, ExecutionRequest } from '@graphql-tools/utils';
import { Transform, SubschemaConfig, DelegationContext } from '@graphql-tools/delegate';
export default class EncapsulateTransform implements MeshTransform {
    private transformMap;
    private transforms;
    constructor(options: MeshTransformOptions<YamlConfig.Transform['encapsulate']>);
    generateSchemaTransforms(originalWrappingSchema: GraphQLSchema): Generator<Transform<any, Record<string, any>>, void, unknown>;
    transformSchema(originalWrappingSchema: GraphQLSchema, subschemaConfig: SubschemaConfig, transformedSchema?: GraphQLSchema): GraphQLSchema;
    transformRequest(originalRequest: ExecutionRequest, delegationContext: DelegationContext, transformationContext: Record<string, any>): ExecutionRequest<any, any, any, Record<string, any>, any>;
    transformResult(originalResult: ExecutionResult, delegationContext: DelegationContext, transformationContext: any): ExecutionResult<any, any>;
}
