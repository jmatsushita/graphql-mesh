import { JSONSchemaObject } from 'json-machete';
import { AddExecutionLogicToComposerOptions } from './addExecutionLogicToComposer.cjs';
export declare function getGraphQLSchemaFromDereferencedJSONSchema(name: string, opts: Omit<AddExecutionLogicToComposerOptions, 'schemaComposer'> & {
    fullyDeferencedSchema: JSONSchemaObject;
}): Promise<import("graphql").GraphQLSchema>;
