import { EnumTypeComposer, InputTypeComposer, ObjectTypeComposer, ScalarTypeComposer } from 'graphql-compose';
import { XSComplexType, WSDLDefinition, WSDLObject, WSDLMessage, XSSchema, XSSimpleType, XSElement, XSDObject } from './types.js';
import { MeshFetch } from '@graphql-mesh/types';
export interface SOAPLoaderOptions {
    fetch: MeshFetch;
}
export declare class SOAPLoader {
    private options;
    private schemaComposer;
    private namespaceDefinitionsMap;
    private namespaceComplexTypesMap;
    private namespaceSimpleTypesMap;
    private namespacePortTypesMap;
    private namespaceBindingMap;
    private namespaceMessageMap;
    private aliasMap;
    private messageOutputTCMap;
    private complexTypeInputTCMap;
    private complexTypeOutputTCMap;
    private simpleTypeTCMap;
    private namespaceTypePrefixMap;
    loadedLocations: Map<string, WSDLObject | XSDObject>;
    constructor(options: SOAPLoaderOptions);
    loadXMLSchemaNamespace(): void;
    private getNamespaceDefinitions;
    private getNamespaceComplexTypeMap;
    private getNamespaceSimpleTypeMap;
    private getNamespacePortTypeMap;
    private getNamespaceBindingMap;
    private getNamespaceMessageMap;
    loadSchema(schemaObj: XSSchema, parentAliasMap?: Map<string, string>): Promise<void>;
    loadDefinition(definition: WSDLDefinition): Promise<void>;
    private xmlParser;
    fetchXSD(location: string, parentAliasMap?: Map<string, string>): Promise<void>;
    loadWSDL(wsdlText: string): Promise<WSDLObject>;
    fetchWSDL(location: string): Promise<void>;
    getAliasMapFromAttributes(attributes: XSSchema['attributes'] | WSDLDefinition['attributes']): Map<string, string>;
    getTypeForSimpleType(simpleType: XSSimpleType, simpleTypeNamespace: string): EnumTypeComposer | ScalarTypeComposer;
    getInputTypeForTypeNameInNamespace({ typeName, typeNamespace, }: {
        typeName: string;
        typeNamespace: string;
    }): InputTypeComposer<any> | EnumTypeComposer<any> | ScalarTypeComposer<any>;
    getInputTypeForComplexType(complexType: XSComplexType, complexTypeNamespace: string): InputTypeComposer<any>;
    getOutputFieldTypeFromElement(elementObj: XSElement, aliasMap: Map<string, string>, namespace: string): ObjectTypeComposer<any, any> | EnumTypeComposer<any> | ScalarTypeComposer<any>;
    getOutputTypeForComplexType(complexType: XSComplexType, complexTypeNamespace: string): ObjectTypeComposer<any, any> | ScalarTypeComposer<any>;
    getOutputTypeForTypeNameInNamespace({ typeName, typeNamespace, }: {
        typeName: string;
        typeNamespace: string;
    }): ObjectTypeComposer<any, any> | EnumTypeComposer<any> | ScalarTypeComposer<any>;
    getOutputTypeForMessage(message: WSDLMessage): {
        type: () => ObjectTypeComposer<any, any> | EnumTypeComposer<any> | ScalarTypeComposer<any>;
        elementName: string;
    };
    buildSchema(): import("graphql").GraphQLSchema;
}
