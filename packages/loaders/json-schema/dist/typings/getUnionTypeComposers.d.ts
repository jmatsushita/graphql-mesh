import { Logger } from '@graphql-mesh/types';
import { JSONSchemaObject } from '@json-schema-tools/meta-schema';
import { AnyTypeComposer, ComposeInputType, InputTypeComposer, ObjectTypeComposer, SchemaComposer, UnionTypeComposer } from 'graphql-compose';
import { TypeComposers } from './getComposerFromJSONSchema.js';
export interface GetUnionTypeComposersOpts {
    schemaComposer: SchemaComposer;
    typeComposersList: {
        input?: AnyTypeComposer<any>;
        output?: ObjectTypeComposer | UnionTypeComposer;
    }[];
    subSchemaAndTypeComposers: JSONSchemaObject & TypeComposers;
    logger: Logger;
}
export declare function getContainerTC(schemaComposer: SchemaComposer, output: ComposeInputType): ObjectTypeComposer<any, any>;
export declare function getUnionTypeComposers({ schemaComposer, typeComposersList, subSchemaAndTypeComposers, logger, }: GetUnionTypeComposersOpts): {
    input?: AnyTypeComposer<any>;
    output?: ObjectTypeComposer<any, any> | UnionTypeComposer<any, any>;
} | {
    input: InputTypeComposer<any>;
    output: UnionTypeComposer<any, any>;
    nullable: boolean;
    readOnly: boolean;
    writeOnly: boolean;
};
