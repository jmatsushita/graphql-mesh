import { AnyTypeComposer, SchemaComposer } from 'graphql-compose';
import { JSONSchema } from 'json-machete';
import { Logger } from '@graphql-mesh/types';
export interface TypeComposers {
    input?: AnyTypeComposer<any>;
    output: AnyTypeComposer<any> | SchemaComposer;
    description?: string;
    nullable?: boolean;
    default?: any;
    readOnly?: boolean;
    writeOnly?: boolean;
}
export declare function getComposerFromJSONSchema(schema: JSONSchema, logger: Logger): Promise<TypeComposers>;
