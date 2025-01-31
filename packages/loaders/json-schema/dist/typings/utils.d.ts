import { OperationTypeNode } from 'graphql';
import { JSONSchemaOperationConfig, JSONSchemaPubSubOperationConfig, HTTPMethod } from './types.js';
export declare function isPubSubOperationConfig(operationConfig: JSONSchemaOperationConfig): operationConfig is JSONSchemaPubSubOperationConfig;
export declare function getOperationMetadata(operationConfig: JSONSchemaOperationConfig): {
    httpMethod: HTTPMethod;
    operationType: OperationTypeNode;
    rootTypeName: "Query" | "Mutation" | "Subscription";
    fieldName: string;
};
export declare function cleanObject(obj: any): any;
export declare function isFileUpload(obj: any): obj is {
    createReadStream: () => AsyncIterable<Uint8Array>;
    mimetype: string;
};
export declare function isFile(obj: any): obj is File;
