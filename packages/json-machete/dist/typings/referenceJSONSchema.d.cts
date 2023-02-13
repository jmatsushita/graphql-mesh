import { JSONSchemaObject } from './types.cjs';
import { DefaultLogger } from '@graphql-mesh/utils';
export declare function referenceJSONSchema(schema: JSONSchemaObject, logger?: DefaultLogger): Promise<{
    $ref: any;
    definitions: any;
}>;
