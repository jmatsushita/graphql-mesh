import { Logger, MeshFetch, MeshPubSub } from '@graphql-mesh/types';
import { GraphQLDirective, GraphQLField, GraphQLInterfaceType, GraphQLLeafType, GraphQLScalarType, GraphQLSchema } from 'graphql';
export declare const LengthDirective: GraphQLDirective;
export declare function processLengthAnnotations(scalar: GraphQLScalarType, { min: minLength, max: maxLength, }: {
    min?: number;
    max?: number;
}): void;
export declare const DiscriminatorDirective: GraphQLDirective;
export declare function processDiscriminatorAnnotations(interfaceType: GraphQLInterfaceType, fieldName: string): void;
export declare const ResolveRootDirective: GraphQLDirective;
export declare function processResolveRootAnnotations(field: GraphQLField<any, any>): void;
export declare const ResolveRootFieldDirective: GraphQLDirective;
export declare function processResolveRootFieldAnnotations(field: GraphQLField<any, any>, propertyName: string): void;
export declare const RegExpDirective: GraphQLDirective;
export declare function processRegExpAnnotations(scalar: GraphQLScalarType, pattern: string): void;
export declare const PubSubOperationDirective: GraphQLDirective;
interface ProcessPubSubOperationAnnotationsOpts {
    field: GraphQLField<any, any>;
    globalPubsub: MeshPubSub;
    pubsubTopic: string;
    logger: Logger;
}
export declare function processPubSubOperationAnnotations({ field, globalPubsub, pubsubTopic, logger, }: ProcessPubSubOperationAnnotationsOpts): void;
export declare const TypeScriptDirective: GraphQLDirective;
export declare function processTypeScriptAnnotations(type: GraphQLLeafType, typeDefinition: string): void;
export declare function processScalarType(schema: GraphQLSchema, type: GraphQLScalarType): void;
export declare const HTTPOperationDirective: GraphQLDirective;
export declare const GlobalOptionsDirective: GraphQLDirective;
export declare const ResponseMetadataDirective: GraphQLDirective;
export declare function processResponseMetadataAnnotations(field: GraphQLField<any, any>): void;
export declare const LinkDirective: GraphQLDirective;
export declare const LinkResolverDirective: GraphQLDirective;
export declare function processLinkFieldAnnotations(field: GraphQLField<any, any>, defaultRootTypeName: string, defaultFieldName: string): void;
export declare const DictionaryDirective: GraphQLDirective;
export declare function processDictionaryDirective(fieldMap: Record<string, GraphQLField<any, any>>, field: GraphQLField<any, any>): void;
interface ProcessDirectiveArgs {
    schema: GraphQLSchema;
    pubsub: MeshPubSub;
    logger: Logger;
    globalFetch: MeshFetch;
    endpoint?: string;
    operationHeaders?: Record<string, string>;
    queryParams?: Record<string, any>;
}
export declare function processDirectives({ schema, globalFetch, logger, pubsub, ...extraGlobalOptions }: ProcessDirectiveArgs): GraphQLSchema;
export declare const StatusCodeTypeNameDirective: GraphQLDirective;
export declare const EnumDirective: GraphQLDirective;
export declare const OneOfDirective: GraphQLDirective;
export declare const ExampleDirective: GraphQLDirective;
export {};
