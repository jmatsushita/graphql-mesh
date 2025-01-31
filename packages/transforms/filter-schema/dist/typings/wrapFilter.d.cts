import { YamlConfig } from '@graphql-mesh/types';
import { DelegationContext, SubschemaConfig, Transform } from '@graphql-tools/delegate';
import { ExecutionResult, ExecutionRequest } from '@graphql-tools/utils';
import { GraphQLSchema } from 'graphql';
export default class WrapFilter implements Transform {
    private transforms;
    constructor({ config: { filters } }: {
        config: YamlConfig.FilterSchemaTransform;
    });
    transformSchema(originalWrappingSchema: GraphQLSchema, subschemaConfig: SubschemaConfig, transformedSchema?: GraphQLSchema): GraphQLSchema;
    transformRequest(originalRequest: ExecutionRequest, delegationContext: DelegationContext, transformationContext: Record<string, any>): ExecutionRequest<any, any, any, Record<string, any>, any>;
    transformResult(originalResult: ExecutionResult, delegationContext: DelegationContext, transformationContext: any): ExecutionResult<any, any>;
}
