import { JSONSchemaObject, JSONSchema } from './types.cjs';
export interface JSONSchemaVisitorContext {
    visitedSubschemaResultMap: WeakMap<JSONSchemaObject, any>;
    path: string;
}
export type JSONSchemaVisitor = (subSchema: any, context: JSONSchemaVisitorContext) => Promise<any> | any;
export declare function visitJSONSchema(schema: JSONSchema, { enter, leave, }: {
    enter?: JSONSchemaVisitor;
    leave?: JSONSchemaVisitor;
}, { visitedSubschemaResultMap, path }?: JSONSchemaVisitorContext): Promise<any>;
