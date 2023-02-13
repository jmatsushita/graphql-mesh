import { GraphQLSchema } from 'graphql';
import { YamlConfig } from '@graphql-mesh/types';
import { ExecutionResult, ExecutionRequest } from '@graphql-tools/utils';
import { Transform, SubschemaConfig, DelegationContext } from '@graphql-tools/delegate';
export default class WrapRename implements Transform {
    private transforms;
    constructor({ config }: {
        config: YamlConfig.RenameTransform;
    });
    transformSchema(originalWrappingSchema: GraphQLSchema, subschemaConfig: SubschemaConfig, transformedSchema?: GraphQLSchema): GraphQLSchema;
    transformRequest(originalRequest: ExecutionRequest, delegationContext: DelegationContext, transformationContext: Record<string, any>): ExecutionRequest<any, any, any, Record<string, any>, any>;
    transformResult(originalResult: ExecutionResult, delegationContext: DelegationContext, transformationContext: any): ExecutionResult<any, any>;
}
