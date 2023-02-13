import { Logger } from '@graphql-mesh/types';
import { JSONSchema } from './types.cjs';
export declare const AnySchema: {
    title: string;
    oneOf: ({
        type: string;
        additionalProperties?: undefined;
    } | {
        type: string;
        additionalProperties: boolean;
    })[];
};
export declare function healJSONSchema(schema: JSONSchema, { logger }?: {
    logger?: Logger;
}): Promise<JSONSchema>;
