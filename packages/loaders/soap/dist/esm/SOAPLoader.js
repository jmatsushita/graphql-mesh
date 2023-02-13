import { sanitizeNameForGraphQL } from '@graphql-mesh/utils';
import { XMLParser } from 'fast-xml-parser';
import { GraphQLJSON, SchemaComposer, } from 'graphql-compose';
import { GraphQLURL, GraphQLByte, GraphQLDate, GraphQLDateTime, GraphQLDuration, GraphQLHexadecimal, GraphQLBigInt, GraphQLTime, GraphQLVoid, GraphQLUnsignedInt, RegularExpression, } from 'graphql-scalars';
import { DirectiveLocation, GraphQLBoolean, GraphQLDirective, GraphQLFloat, GraphQLInt, GraphQLString, } from 'graphql';
import { PARSE_XML_OPTIONS } from './utils.js';
const soapDirective = new GraphQLDirective({
    name: 'soap',
    locations: [DirectiveLocation.FIELD_DEFINITION],
    args: {
        elementName: {
            type: GraphQLString,
        },
        bindingNamespace: {
            type: GraphQLString,
        },
        endpoint: {
            type: GraphQLString,
        },
    },
});
const QUERY_PREFIXES = [
    'get',
    'find',
    'list',
    'search',
    'count',
    'exists',
    'fetch',
    'load',
    'query',
    'select',
];
function isQueryOperationName(operationName) {
    return QUERY_PREFIXES.some(prefix => operationName.toLowerCase().startsWith(prefix));
}
export class SOAPLoader {
    constructor(options) {
        this.options = options;
        this.schemaComposer = new SchemaComposer();
        this.namespaceDefinitionsMap = new Map();
        this.namespaceComplexTypesMap = new Map();
        this.namespaceSimpleTypesMap = new Map();
        this.namespacePortTypesMap = new Map();
        this.namespaceBindingMap = new Map();
        this.namespaceMessageMap = new Map();
        this.aliasMap = new WeakMap();
        this.messageOutputTCMap = new WeakMap();
        this.complexTypeInputTCMap = new WeakMap();
        this.complexTypeOutputTCMap = new WeakMap();
        this.simpleTypeTCMap = new WeakMap();
        this.namespaceTypePrefixMap = new Map();
        this.loadedLocations = new Map();
        this.xmlParser = new XMLParser(PARSE_XML_OPTIONS);
        this.loadXMLSchemaNamespace();
        this.schemaComposer.addDirective(soapDirective);
    }
    loadXMLSchemaNamespace() {
        const namespace = 'http://www.w3.org/2001/XMLSchema';
        const simpleTypeGraphQLScalarMap = new Map([
            ['anyType', GraphQLJSON],
            ['anyURI', GraphQLURL],
            ['base64Binary', GraphQLByte],
            ['byte', GraphQLByte],
            ['boolean', GraphQLBoolean],
            ['date', GraphQLDate],
            ['dateTime', GraphQLDateTime],
            ['decimal', GraphQLFloat],
            ['double', GraphQLFloat],
            ['duration', GraphQLDuration],
            ['float', GraphQLFloat],
            ['int', GraphQLInt],
            ['hexBinary', GraphQLHexadecimal],
            ['long', GraphQLBigInt],
            ['gDay', GraphQLString],
            ['gMonth', GraphQLString],
            ['gMonthDay', GraphQLString],
            ['gYear', GraphQLString],
            ['gYearMonth', GraphQLString],
            ['NOTATION', GraphQLString],
            ['QName', GraphQLString],
            ['short', GraphQLInt],
            ['string', GraphQLString],
            ['unsignedByte', GraphQLByte],
            ['unsignedInt', GraphQLUnsignedInt],
            ['unsignedLong', GraphQLBigInt],
            ['unsignedShort', GraphQLUnsignedInt],
            ['time', GraphQLTime],
        ]);
        const namespaceSimpleTypesMap = this.getNamespaceSimpleTypeMap(namespace);
        for (const [singleTypeName, scalarType] of simpleTypeGraphQLScalarMap) {
            const singleType = {
                attributes: {
                    name: singleTypeName,
                },
            };
            namespaceSimpleTypesMap.set(singleTypeName, singleType);
            const simpleTypeTC = this.schemaComposer.createScalarTC(scalarType);
            this.simpleTypeTCMap.set(singleType, simpleTypeTC);
        }
    }
    getNamespaceDefinitions(namespace) {
        let namespaceDefinitions = this.namespaceDefinitionsMap.get(namespace);
        if (!namespaceDefinitions) {
            namespaceDefinitions = [];
            this.namespaceDefinitionsMap.set(namespace, namespaceDefinitions);
        }
        return namespaceDefinitions;
    }
    getNamespaceComplexTypeMap(namespace) {
        let namespaceComplexTypes = this.namespaceComplexTypesMap.get(namespace);
        if (!namespaceComplexTypes) {
            namespaceComplexTypes = new Map();
            this.namespaceComplexTypesMap.set(namespace, namespaceComplexTypes);
        }
        return namespaceComplexTypes;
    }
    getNamespaceSimpleTypeMap(namespace) {
        let namespaceSimpleTypes = this.namespaceSimpleTypesMap.get(namespace);
        if (!namespaceSimpleTypes) {
            namespaceSimpleTypes = new Map();
            this.namespaceSimpleTypesMap.set(namespace, namespaceSimpleTypes);
        }
        return namespaceSimpleTypes;
    }
    getNamespacePortTypeMap(namespace) {
        let namespacePortTypes = this.namespacePortTypesMap.get(namespace);
        if (!namespacePortTypes) {
            namespacePortTypes = new Map();
            this.namespacePortTypesMap.set(namespace, namespacePortTypes);
        }
        return namespacePortTypes;
    }
    getNamespaceBindingMap(namespace) {
        let namespaceBindingMap = this.namespaceBindingMap.get(namespace);
        if (!namespaceBindingMap) {
            namespaceBindingMap = new Map();
            this.namespaceBindingMap.set(namespace, namespaceBindingMap);
        }
        return namespaceBindingMap;
    }
    getNamespaceMessageMap(namespace) {
        let namespaceMessageMap = this.namespaceMessageMap.get(namespace);
        if (!namespaceMessageMap) {
            namespaceMessageMap = new Map();
            this.namespaceMessageMap.set(namespace, namespaceMessageMap);
        }
        return namespaceMessageMap;
    }
    async loadSchema(schemaObj, parentAliasMap = new Map()) {
        var _a, _b;
        const schemaNamespace = schemaObj.attributes.targetNamespace;
        const aliasMap = this.getAliasMapFromAttributes(schemaObj.attributes);
        let typePrefix = this.namespaceTypePrefixMap.get(schemaNamespace);
        if (!typePrefix) {
            typePrefix =
                schemaObj.attributes.id ||
                    ((_a = [...aliasMap.entries()].find(([, namespace]) => namespace === schemaNamespace)) === null || _a === void 0 ? void 0 : _a[0]);
            this.namespaceTypePrefixMap.set(schemaNamespace, typePrefix);
        }
        for (const [alias, namespace] of parentAliasMap) {
            if (!aliasMap.has(alias)) {
                aliasMap.set(alias, namespace);
            }
        }
        if (schemaObj.import) {
            for (const importObj of schemaObj.import) {
                const importLocation = importObj.attributes.schemaLocation;
                if (importLocation && !this.loadedLocations.has(importLocation)) {
                    await this.fetchXSD(importLocation);
                }
            }
        }
        // Complex and simple types can be inside element tag or outside of it
        if (schemaObj.complexType) {
            const namespaceComplexTypes = this.getNamespaceComplexTypeMap(schemaNamespace);
            for (const complexType of schemaObj.complexType) {
                namespaceComplexTypes.set(complexType.attributes.name, complexType);
                this.aliasMap.set(complexType, aliasMap);
            }
        }
        if (schemaObj.simpleType) {
            const namespaceSimpleTypes = this.getNamespaceSimpleTypeMap(schemaNamespace);
            for (const simpleType of schemaObj.simpleType) {
                namespaceSimpleTypes.set(simpleType.attributes.name, simpleType);
                this.aliasMap.set(simpleType, aliasMap);
            }
        }
        if (schemaObj.element) {
            for (const elementObj of schemaObj.element) {
                if (elementObj.complexType) {
                    const namespaceComplexTypes = this.getNamespaceComplexTypeMap(schemaNamespace);
                    for (const complexType of elementObj.complexType) {
                        // Sometimes type name is defined on element object
                        complexType.attributes = complexType.attributes || {};
                        complexType.attributes.name = elementObj.attributes.name;
                        namespaceComplexTypes.set(complexType.attributes.name, complexType);
                        this.aliasMap.set(complexType, aliasMap);
                    }
                }
                if (elementObj.simpleType) {
                    const namespaceSimpleTypes = this.getNamespaceSimpleTypeMap(schemaNamespace);
                    for (const simpleType of elementObj.simpleType) {
                        simpleType.attributes = simpleType.attributes || {};
                        simpleType.attributes.name = elementObj.attributes.name;
                        namespaceSimpleTypes.set(simpleType.attributes.name, simpleType);
                        this.aliasMap.set(simpleType, aliasMap);
                    }
                }
                if ((_b = elementObj.attributes) === null || _b === void 0 ? void 0 : _b.type) {
                    const [refTypeNamespaceAlias, refTypeName] = elementObj.attributes.type.split(':');
                    const refTypeNamespace = aliasMap.get(refTypeNamespaceAlias);
                    if (!refTypeNamespace) {
                        throw new Error(`Invalid namespace alias: ${refTypeNamespaceAlias}`);
                    }
                    const refComplexType = this.getNamespaceComplexTypeMap(refTypeNamespace).get(refTypeName);
                    if (refComplexType) {
                        this.getNamespaceComplexTypeMap(schemaNamespace).set(elementObj.attributes.name, refComplexType);
                    }
                    const refSimpleType = this.getNamespaceSimpleTypeMap(refTypeNamespace).get(refTypeName);
                    if (refSimpleType) {
                        this.getNamespaceSimpleTypeMap(schemaNamespace).set(elementObj.attributes.name, refSimpleType);
                    }
                }
            }
        }
    }
    async loadDefinition(definition) {
        this.getNamespaceDefinitions(definition.attributes.targetNamespace).push(definition);
        const definitionAliasMap = this.getAliasMapFromAttributes(definition.attributes);
        const definitionNamespace = definition.attributes.targetNamespace;
        const typePrefix = definition.attributes.name ||
            [...definitionAliasMap.entries()].find(([, namespace]) => namespace === definitionNamespace)[0];
        this.namespaceTypePrefixMap.set(definition.attributes.targetNamespace, typePrefix);
        if (definition.import) {
            for (const importObj of definition.import) {
                const importLocation = importObj.attributes.location;
                if (importLocation && !this.loadedLocations.has(importLocation)) {
                    await this.fetchWSDL(importLocation);
                }
            }
        }
        if (definition.types) {
            for (const typesObj of definition.types) {
                for (const schemaObj of typesObj.schema) {
                    await this.loadSchema(schemaObj, definitionAliasMap);
                }
            }
        }
        if (definition.portType) {
            const namespacePortTypes = this.getNamespacePortTypeMap(definition.attributes.targetNamespace);
            for (const portTypeObj of definition.portType) {
                namespacePortTypes.set(portTypeObj.attributes.name, portTypeObj);
                this.aliasMap.set(portTypeObj, definitionAliasMap);
            }
        }
        if (definition.binding) {
            const namespaceBindingMap = this.getNamespaceBindingMap(definition.attributes.targetNamespace);
            for (const bindingObj of definition.binding) {
                namespaceBindingMap.set(bindingObj.attributes.name, bindingObj);
                this.aliasMap.set(bindingObj, definitionAliasMap);
            }
        }
        if (definition.message) {
            const namespaceMessageMap = this.getNamespaceMessageMap(definition.attributes.targetNamespace);
            for (const messageObj of definition.message) {
                namespaceMessageMap.set(messageObj.attributes.name, messageObj);
                this.aliasMap.set(messageObj, definitionAliasMap);
            }
        }
        const serviceAndPortAliasMap = this.getAliasMapFromAttributes(definition.attributes);
        if (definition.service) {
            for (const serviceObj of definition.service) {
                const serviceName = serviceObj.attributes.name;
                for (const portObj of serviceObj.port) {
                    const portName = portObj.attributes.name;
                    const [bindingNamespaceAlias, bindingName] = portObj.attributes.binding.split(':');
                    const bindingNamespace = serviceAndPortAliasMap.get(bindingNamespaceAlias);
                    if (!bindingNamespace) {
                        throw new Error(`Namespace alias: ${bindingNamespaceAlias} is undefined!`);
                    }
                    const bindingObj = this.getNamespaceBindingMap(bindingNamespace).get(bindingName);
                    if (!bindingObj) {
                        throw new Error(`Binding: ${bindingName} is not defined in ${bindingNamespace} needed for ${serviceName}->${portName}`);
                    }
                    const bindingAliasMap = this.aliasMap.get(bindingObj);
                    if (!bindingAliasMap) {
                        throw new Error(`Namespace alias definitions couldn't be found for ${bindingName}`);
                    }
                    const [portTypeNamespaceAlias, portTypeName] = bindingObj.attributes.type.split(':');
                    const portTypeNamespace = bindingAliasMap.get(portTypeNamespaceAlias);
                    if (!portTypeNamespace) {
                        throw new Error(`Namespace alias: ${portTypeNamespaceAlias} is undefined!`);
                    }
                    const portTypeObj = this.getNamespacePortTypeMap(portTypeNamespace).get(portTypeName);
                    if (!portTypeObj) {
                        throw new Error(`Port Type: ${portTypeName} is not defined in ${portTypeNamespace} needed for ${bindingNamespaceAlias}->${bindingName}`);
                    }
                    const portTypeAliasMap = this.aliasMap.get(portTypeObj);
                    for (const operationObj of portTypeObj.operation) {
                        const operationName = operationObj.attributes.name;
                        const rootTC = isQueryOperationName(operationName)
                            ? this.schemaComposer.Query
                            : this.schemaComposer.Mutation;
                        const operationFieldName = sanitizeNameForGraphQL(`${typePrefix}_${serviceName}_${portName}_${operationName}`);
                        const outputObj = operationObj.output[0];
                        const [messageNamespaceAlias, messageName] = outputObj.attributes.message.split(':');
                        const messageNamespace = portTypeAliasMap.get(messageNamespaceAlias);
                        if (!messageNamespace) {
                            throw new Error(`Namespace alias: ${messageNamespaceAlias} is undefined!`);
                        }
                        const { type, elementName } = this.getOutputTypeForMessage(this.getNamespaceMessageMap(messageNamespace).get(messageName));
                        const soapAnnotations = {
                            elementName,
                            bindingNamespace,
                            endpoint: portObj.address[0].attributes.location,
                        };
                        rootTC.addFields({
                            [operationFieldName]: {
                                type,
                                directives: [
                                    {
                                        name: 'soap',
                                        args: soapAnnotations,
                                    },
                                ],
                            },
                        });
                        const inputObj = operationObj.input[0];
                        const [inputMessageNamespaceAlias, inputMessageName] = inputObj.attributes.message.split(':');
                        const inputMessageNamespace = portTypeAliasMap.get(inputMessageNamespaceAlias);
                        if (!inputMessageNamespace) {
                            throw new Error(`Namespace alias: ${inputMessageNamespaceAlias} is undefined!`);
                        }
                        const inputMessageObj = this.getNamespaceMessageMap(inputMessageNamespace).get(inputMessageName);
                        if (!inputMessageObj) {
                            throw new Error(`Message: ${inputMessageName} is not defined in ${inputMessageNamespace} needed for ${portTypeName}->${operationName}`);
                        }
                        const aliasMap = this.aliasMap.get(inputMessageObj);
                        for (const part of inputMessageObj.part) {
                            if (part.attributes.element) {
                                const [elementNamespaceAlias, elementName] = part.attributes.element.split(':');
                                rootTC.addFieldArgs(operationFieldName, {
                                    [elementName]: {
                                        type: () => {
                                            const elementNamespace = aliasMap.get(elementNamespaceAlias) ||
                                                part.attributes[elementNamespaceAlias];
                                            if (!elementNamespace) {
                                                throw new Error(`Namespace alias: ${elementNamespaceAlias} is not defined.`);
                                            }
                                            return this.getInputTypeForTypeNameInNamespace({
                                                typeName: elementName,
                                                typeNamespace: elementNamespace,
                                            });
                                        },
                                        defaultValue: '',
                                    },
                                });
                            }
                            else if (part.attributes.name) {
                                const partName = part.attributes.name;
                                rootTC.addFieldArgs(operationFieldName, {
                                    [partName]: {
                                        type: () => {
                                            const typeRef = part.attributes.type;
                                            const [typeNamespaceAlias, typeName] = typeRef.split(':');
                                            const typeNamespace = aliasMap.get(typeNamespaceAlias);
                                            if (!typeNamespace) {
                                                throw new Error(`Namespace alias: ${typeNamespaceAlias} is undefined!`);
                                            }
                                            const inputTC = this.getInputTypeForTypeNameInNamespace({
                                                typeName,
                                                typeNamespace,
                                            });
                                            if ('getFields' in inputTC && Object.keys(inputTC.getFields()).length === 0) {
                                                return GraphQLJSON;
                                            }
                                            return inputTC;
                                        },
                                        defaultValue: '',
                                    },
                                });
                            }
                        }
                    }
                }
            }
        }
    }
    async fetchXSD(location, parentAliasMap = new Map()) {
        const response = await this.options.fetch(location);
        let xsdText = await response.text();
        xsdText = xsdText.split('xmlns:').join('namespace:');
        // WSDL Import is different than XS Import
        const xsdObj = this.xmlParser.parse(xsdText, PARSE_XML_OPTIONS);
        for (const schemaObj of xsdObj.schema) {
            await this.loadSchema(schemaObj, parentAliasMap);
        }
        this.loadedLocations.set(location, xsdObj);
    }
    async loadWSDL(wsdlText) {
        wsdlText = wsdlText.split('xmlns:').join('namespace:');
        const wsdlObject = this.xmlParser.parse(wsdlText, PARSE_XML_OPTIONS);
        for (const definition of wsdlObject.definitions) {
            await this.loadDefinition(definition);
        }
        return wsdlObject;
    }
    async fetchWSDL(location) {
        const response = await this.options.fetch(location);
        const wsdlText = await response.text();
        const wsdlObject = await this.loadWSDL(wsdlText);
        this.loadedLocations.set(location, wsdlObject);
    }
    getAliasMapFromAttributes(attributes) {
        const aliasMap = new Map();
        for (const attributeName in attributes) {
            const attributeValue = attributes[attributeName];
            if (attributeName !== 'targetNamespace' && attributeValue.startsWith('http')) {
                aliasMap.set(attributeName, attributeValue);
            }
        }
        return aliasMap;
    }
    getTypeForSimpleType(simpleType, simpleTypeNamespace) {
        var _a;
        let simpleTypeTC = this.simpleTypeTCMap.get(simpleType);
        if (!simpleTypeTC) {
            const simpleTypeName = simpleType.attributes.name;
            const restrictionObj = simpleType.restriction[0];
            const prefix = this.namespaceTypePrefixMap.get(simpleTypeNamespace);
            if (restrictionObj.attributes.base === 'string' && restrictionObj.enumeration) {
                const enumTypeName = `${prefix}_${simpleTypeName}`;
                const values = {};
                for (const enumerationObj of restrictionObj.enumeration) {
                    const enumValue = enumerationObj.attributes.value;
                    const enumKey = sanitizeNameForGraphQL(enumValue);
                    values[enumKey] = {
                        value: enumValue,
                    };
                }
                simpleTypeTC = this.schemaComposer.createEnumTC({
                    name: enumTypeName,
                    values,
                });
            }
            else if (restrictionObj.pattern) {
                const patternObj = restrictionObj.pattern[0];
                const pattern = patternObj.attributes.value;
                const scalarTypeName = `${prefix}_${simpleTypeName}`;
                simpleTypeTC = this.schemaComposer.createScalarTC(new RegularExpression(scalarTypeName, new RegExp(pattern)));
            }
            else {
                // TODO: Other restrictions are not supported yet
                const aliasMap = this.aliasMap.get(simpleType);
                const [baseTypeNamespaceAlias, baseTypeName] = restrictionObj.attributes.base.split(':');
                const baseTypeNamespace = aliasMap.get(baseTypeNamespaceAlias);
                if (!baseTypeNamespace) {
                    throw new Error(`Invalid base type namespace: ${baseTypeNamespaceAlias}`);
                }
                const baseType = (_a = this.getNamespaceSimpleTypeMap(baseTypeNamespace)) === null || _a === void 0 ? void 0 : _a.get(baseTypeName);
                if (!baseType) {
                    throw new Error(`Simple Type: ${baseTypeName} couldn't be found in ${baseTypeNamespace} needed for ${simpleTypeName}`);
                }
                simpleTypeTC = this.getTypeForSimpleType(baseType, baseTypeNamespace);
            }
            this.simpleTypeTCMap.set(simpleType, simpleTypeTC);
        }
        return simpleTypeTC;
    }
    getInputTypeForTypeNameInNamespace({ typeName, typeNamespace, }) {
        var _a, _b;
        const complexType = (_a = this.getNamespaceComplexTypeMap(typeNamespace)) === null || _a === void 0 ? void 0 : _a.get(typeName);
        if (complexType) {
            return this.getInputTypeForComplexType(complexType, typeNamespace);
        }
        const simpleType = (_b = this.getNamespaceSimpleTypeMap(typeNamespace)) === null || _b === void 0 ? void 0 : _b.get(typeName);
        if (simpleType) {
            return this.getTypeForSimpleType(simpleType, typeNamespace);
        }
        throw new Error(`Type: ${typeName} couldn't be found in ${typeNamespace}`);
    }
    getInputTypeForComplexType(complexType, complexTypeNamespace) {
        var _a, _b, _c;
        let complexTypeTC = this.complexTypeInputTCMap.get(complexType);
        if (!complexTypeTC) {
            const complexTypeName = complexType.attributes.name;
            const prefix = this.namespaceTypePrefixMap.get(complexTypeNamespace);
            const aliasMap = this.aliasMap.get(complexType);
            const fieldMap = {};
            const choiceOrSequenceObjects = [
                ...(complexType.sequence || []),
                ...(complexType.choice || []),
            ];
            for (const sequenceOrChoiceObj of choiceOrSequenceObjects) {
                if (sequenceOrChoiceObj.element) {
                    for (const elementObj of sequenceOrChoiceObj.element) {
                        const fieldName = elementObj.attributes.name;
                        if (fieldName) {
                            fieldMap[fieldName] = {
                                type: () => {
                                    var _a, _b, _c, _d, _e, _f, _g;
                                    const maxOccurs = ((_a = sequenceOrChoiceObj.attributes) === null || _a === void 0 ? void 0 : _a.maxOccurs) || ((_b = elementObj.attributes) === null || _b === void 0 ? void 0 : _b.maxOccurs);
                                    const minOccurs = ((_c = sequenceOrChoiceObj.attributes) === null || _c === void 0 ? void 0 : _c.minOccurs) || ((_d = elementObj.attributes) === null || _d === void 0 ? void 0 : _d.minOccurs);
                                    const nillable = ((_e = sequenceOrChoiceObj.attributes) === null || _e === void 0 ? void 0 : _e.nillable) || ((_f = elementObj.attributes) === null || _f === void 0 ? void 0 : _f.nillable);
                                    const isPlural = maxOccurs != null && maxOccurs !== '1';
                                    let isNullable = false;
                                    if (minOccurs == null || minOccurs === '0') {
                                        isNullable = true;
                                    }
                                    if (nillable === 'true') {
                                        isNullable = true;
                                    }
                                    if (nillable === 'false') {
                                        isNullable = false;
                                    }
                                    if ((_g = elementObj.attributes) === null || _g === void 0 ? void 0 : _g.type) {
                                        const [typeNamespaceAlias, typeName] = elementObj.attributes.type.split(':');
                                        let typeNamespace;
                                        if (elementObj.attributes[typeNamespaceAlias]) {
                                            typeNamespace = elementObj.attributes[typeNamespaceAlias];
                                        }
                                        else {
                                            typeNamespace = aliasMap.get(typeNamespaceAlias);
                                        }
                                        if (!typeNamespace) {
                                            throw new Error(`Namespace alias: ${typeNamespaceAlias} is undefined!`);
                                        }
                                        let finalTC = this.getInputTypeForTypeNameInNamespace({
                                            typeName,
                                            typeNamespace,
                                        });
                                        if (isPlural) {
                                            finalTC = finalTC.getTypePlural();
                                        }
                                        if (!isNullable) {
                                            finalTC = finalTC.getTypeNonNull();
                                        }
                                        return finalTC;
                                    }
                                    else if (elementObj.simpleType) {
                                        // eslint-disable-next-line no-unreachable-loop
                                        for (const simpleTypeObj of elementObj.simpleType) {
                                            // Dynamically defined simple type
                                            // So we need to define alias map for this type
                                            this.aliasMap.set(simpleTypeObj, aliasMap);
                                            // Inherit the name from elementObj
                                            simpleTypeObj.attributes = simpleTypeObj.attributes || {};
                                            simpleTypeObj.attributes.name =
                                                simpleTypeObj.attributes.name || elementObj.attributes.name;
                                            let finalTC = this.getTypeForSimpleType(simpleTypeObj, complexTypeNamespace);
                                            if (isPlural) {
                                                finalTC = finalTC.getTypePlural();
                                            }
                                            if (!isNullable) {
                                                finalTC = finalTC.getTypeNonNull();
                                            }
                                            return finalTC;
                                        }
                                    }
                                    else if (elementObj.complexType) {
                                        // eslint-disable-next-line no-unreachable-loop
                                        for (const complexTypeObj of elementObj.complexType) {
                                            // Dynamically defined type
                                            // So we need to define alias map for this type
                                            this.aliasMap.set(complexTypeObj, aliasMap);
                                            // Inherit the name from elementObj
                                            complexTypeObj.attributes = complexTypeObj.attributes || {};
                                            complexTypeObj.attributes.name =
                                                complexTypeObj.attributes.name || elementObj.attributes.name;
                                            let finalTC = this.getInputTypeForComplexType(complexTypeObj, complexTypeNamespace);
                                            if (isPlural) {
                                                finalTC = finalTC.getTypePlural();
                                            }
                                            if (!isNullable) {
                                                finalTC = finalTC.getTypeNonNull();
                                            }
                                            return finalTC;
                                        }
                                    }
                                    throw new Error(`Invalid element type definition: ${complexTypeName}->${fieldName}`);
                                },
                            };
                        }
                        else {
                            if ((_a = elementObj.attributes) === null || _a === void 0 ? void 0 : _a.ref) {
                                console.warn(`element.ref isn't supported yet.`);
                            }
                            else {
                                console.warn(`Element doesn't have a name in ${complexTypeName}. Ignoring...`);
                            }
                        }
                    }
                }
                if (sequenceOrChoiceObj.any) {
                    for (const anyObj of sequenceOrChoiceObj.any) {
                        const anyNamespace = (_b = anyObj.attributes) === null || _b === void 0 ? void 0 : _b.namespace;
                        if (anyNamespace) {
                            const anyTypeTC = this.getInputTypeForTypeNameInNamespace({
                                typeName: complexTypeName,
                                typeNamespace: anyNamespace,
                            });
                            if ('getFields' in anyTypeTC) {
                                for (const fieldName in anyTypeTC.getFields()) {
                                    fieldMap[fieldName] = anyTypeTC.getField(fieldName);
                                }
                            }
                        }
                    }
                }
            }
            if (complexType.complexContent) {
                for (const complexContentObj of complexType.complexContent) {
                    for (const extensionObj of complexContentObj.extension) {
                        const [baseTypeNamespaceAlias, baseTypeName] = extensionObj.attributes.base.split(':');
                        let baseTypeNamespace;
                        if (extensionObj.attributes[baseTypeNamespaceAlias]) {
                            baseTypeNamespace = extensionObj.attributes[baseTypeNamespaceAlias];
                        }
                        else {
                            baseTypeNamespace = aliasMap.get(baseTypeNamespaceAlias);
                        }
                        if (!baseTypeNamespace) {
                            throw new Error(`Namespace alias: ${baseTypeNamespaceAlias} is undefined!`);
                        }
                        const baseType = (_c = this.getNamespaceComplexTypeMap(baseTypeNamespace)) === null || _c === void 0 ? void 0 : _c.get(baseTypeName);
                        if (!baseType) {
                            throw new Error(`Complex Type: ${baseTypeName} couldn't be found in ${baseTypeNamespace} needed for ${complexTypeName}`);
                        }
                        const baseTypeTC = this.getInputTypeForComplexType(baseType, baseTypeNamespace);
                        for (const fieldName in baseTypeTC.getFields()) {
                            fieldMap[fieldName] = baseTypeTC.getField(fieldName);
                        }
                        for (const sequenceObj of extensionObj.sequence) {
                            for (const elementObj of sequenceObj.element) {
                                fieldMap[elementObj.attributes.name] = {
                                    type: () => {
                                        const [typeNamespaceAlias, typeName] = elementObj.attributes.type.split(':');
                                        let typeNamespace;
                                        if (elementObj.attributes[typeNamespaceAlias]) {
                                            typeNamespace = elementObj.attributes[typeNamespaceAlias];
                                        }
                                        else {
                                            typeNamespace = aliasMap.get(typeNamespaceAlias);
                                        }
                                        if (!typeNamespace) {
                                            throw new Error(`Namespace alias: ${typeNamespaceAlias} is undefined!`);
                                        }
                                        return this.getInputTypeForTypeNameInNamespace({ typeName, typeNamespace });
                                    },
                                };
                            }
                        }
                    }
                }
            }
            if (Object.keys(fieldMap).length === 0) {
                complexTypeTC = GraphQLJSON;
            }
            else {
                complexTypeTC = this.schemaComposer.createInputTC({
                    name: `${prefix}_${complexTypeName}_Input`,
                    fields: fieldMap,
                });
            }
            this.complexTypeInputTCMap.set(complexType, complexTypeTC);
        }
        return complexTypeTC;
    }
    getOutputFieldTypeFromElement(elementObj, aliasMap, namespace) {
        var _a;
        if ((_a = elementObj.attributes) === null || _a === void 0 ? void 0 : _a.type) {
            const [typeNamespaceAlias, typeName] = elementObj.attributes.type.split(':');
            let typeNamespace;
            if (elementObj.attributes[typeNamespaceAlias]) {
                typeNamespace = elementObj.attributes[typeNamespaceAlias];
            }
            else {
                typeNamespace = aliasMap.get(typeNamespaceAlias);
            }
            if (!typeNamespace) {
                throw new Error(`Namespace alias: ${typeNamespaceAlias} is undefined!`);
            }
            const outputTC = this.getOutputTypeForTypeNameInNamespace({ typeName, typeNamespace });
            return outputTC;
        }
        else if (elementObj.simpleType) {
            // eslint-disable-next-line no-unreachable-loop
            for (const simpleTypeObj of elementObj.simpleType) {
                // Dynamically defined simple type
                // So we need to define alias map for this type
                this.aliasMap.set(simpleTypeObj, aliasMap);
                // Inherit the name from elementObj
                simpleTypeObj.attributes = simpleTypeObj.attributes || {};
                simpleTypeObj.attributes.name = simpleTypeObj.attributes.name || elementObj.attributes.name;
                const outputTC = this.getTypeForSimpleType(simpleTypeObj, namespace);
                return outputTC;
            }
        }
        else if (elementObj.complexType) {
            // eslint-disable-next-line no-unreachable-loop
            for (const complexTypeObj of elementObj.complexType) {
                // Dynamically defined type
                // So we need to define alias map for this type
                this.aliasMap.set(complexTypeObj, aliasMap);
                // Inherit the name from elementObj
                complexTypeObj.attributes = complexTypeObj.attributes || {};
                complexTypeObj.attributes.name =
                    complexTypeObj.attributes.name || elementObj.attributes.name;
                const outputTC = this.getOutputTypeForComplexType(complexTypeObj, namespace);
                return outputTC;
            }
        }
        throw new Error(`Invalid element type definition: ${elementObj.attributes.name}`);
    }
    getOutputTypeForComplexType(complexType, complexTypeNamespace) {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r;
        let complexTypeTC = this.complexTypeOutputTCMap.get(complexType);
        if (!complexTypeTC) {
            const complexTypeName = complexType.attributes.name;
            const prefix = this.namespaceTypePrefixMap.get(complexTypeNamespace);
            const aliasMap = this.aliasMap.get(complexType);
            const fieldMap = {};
            const choiceOrSequenceObjects = [
                ...(complexType.sequence || []),
                ...(complexType.choice || []),
            ];
            for (const choiceOrSequenceObj of choiceOrSequenceObjects) {
                if (choiceOrSequenceObj.element) {
                    for (const elementObj of choiceOrSequenceObj.element) {
                        const fieldName = elementObj.attributes.name;
                        if (fieldName) {
                            const maxOccurs = ((_a = choiceOrSequenceObj.attributes) === null || _a === void 0 ? void 0 : _a.maxOccurs) || ((_b = elementObj.attributes) === null || _b === void 0 ? void 0 : _b.maxOccurs);
                            const minOccurs = ((_c = choiceOrSequenceObj.attributes) === null || _c === void 0 ? void 0 : _c.minOccurs) || ((_d = elementObj.attributes) === null || _d === void 0 ? void 0 : _d.minOccurs);
                            const nillable = ((_e = choiceOrSequenceObj.attributes) === null || _e === void 0 ? void 0 : _e.nillable) || ((_f = elementObj.attributes) === null || _f === void 0 ? void 0 : _f.nillable);
                            const isPlural = maxOccurs != null && maxOccurs !== '1';
                            let isNullable = false;
                            if (minOccurs == null || minOccurs === '0') {
                                isNullable = true;
                            }
                            if (nillable === 'true') {
                                isNullable = true;
                            }
                            if (nillable === 'false') {
                                isNullable = false;
                            }
                            fieldMap[fieldName] = {
                                type: () => {
                                    let outputTC = this.getOutputFieldTypeFromElement(elementObj, aliasMap, complexTypeNamespace);
                                    if (isPlural) {
                                        outputTC = outputTC.getTypePlural();
                                    }
                                    if (isNullable) {
                                        outputTC = outputTC.getTypeNonNull();
                                    }
                                    return outputTC;
                                },
                            };
                        }
                        else {
                            if ((_g = elementObj.attributes) === null || _g === void 0 ? void 0 : _g.ref) {
                                console.warn(`element.ref isn't supported yet.`, (_h = elementObj.attributes) === null || _h === void 0 ? void 0 : _h.ref);
                            }
                            else {
                                console.warn(`Element doesn't have a name in ${complexTypeName}. Ignoring...`);
                            }
                        }
                    }
                }
                if (choiceOrSequenceObj.any) {
                    for (const anyObj of choiceOrSequenceObj.any) {
                        const anyNamespace = (_j = anyObj.attributes) === null || _j === void 0 ? void 0 : _j.namespace;
                        if (anyNamespace) {
                            const anyTypeTC = this.getOutputTypeForTypeNameInNamespace({
                                typeName: complexTypeName,
                                typeNamespace: anyNamespace,
                            });
                            if ('getFields' in anyTypeTC) {
                                for (const fieldName in anyTypeTC.getFields()) {
                                    fieldMap[fieldName] = anyTypeTC.getField(fieldName);
                                }
                            }
                        }
                    }
                }
            }
            if (complexType.complexContent) {
                for (const complexContentObj of complexType.complexContent) {
                    for (const extensionObj of complexContentObj.extension) {
                        const [baseTypeNamespaceAlias, baseTypeName] = extensionObj.attributes.base.split(':');
                        const baseTypeNamespace = aliasMap.get(baseTypeNamespaceAlias) ||
                            extensionObj.attributes[baseTypeNamespaceAlias];
                        if (!baseTypeNamespace) {
                            throw new Error(`Namespace alias: ${baseTypeNamespaceAlias} is undefined!`);
                        }
                        const baseType = (_k = this.getNamespaceComplexTypeMap(baseTypeNamespace)) === null || _k === void 0 ? void 0 : _k.get(baseTypeName);
                        if (!baseType) {
                            throw new Error(`Complex Type: ${baseTypeName} couldn't be found in ${baseTypeNamespace} needed for ${complexTypeName}`);
                        }
                        const baseTypeTC = this.getOutputTypeForComplexType(baseType, baseTypeNamespace);
                        if ('getFields' in baseTypeTC) {
                            for (const fieldName in baseTypeTC.getFields()) {
                                fieldMap[fieldName] = baseTypeTC.getField(fieldName);
                            }
                        }
                        const choiceOrSequenceObjects = [
                            ...(extensionObj.sequence || []),
                            ...(extensionObj.choice || []),
                        ];
                        for (const choiceOrSequenceObj of choiceOrSequenceObjects) {
                            for (const elementObj of choiceOrSequenceObj.element) {
                                const fieldName = elementObj.attributes.name;
                                const maxOccurs = ((_l = choiceOrSequenceObj.attributes) === null || _l === void 0 ? void 0 : _l.maxOccurs) || ((_m = elementObj.attributes) === null || _m === void 0 ? void 0 : _m.maxOccurs);
                                const minOccurs = ((_o = choiceOrSequenceObj.attributes) === null || _o === void 0 ? void 0 : _o.minOccurs) || ((_p = elementObj.attributes) === null || _p === void 0 ? void 0 : _p.minOccurs);
                                const nillable = ((_q = choiceOrSequenceObj.attributes) === null || _q === void 0 ? void 0 : _q.nillable) || ((_r = elementObj.attributes) === null || _r === void 0 ? void 0 : _r.nillable);
                                const isPlural = maxOccurs != null && maxOccurs !== '1';
                                let isNullable = false;
                                if (minOccurs == null || minOccurs === '0') {
                                    isNullable = true;
                                }
                                if (nillable === 'true') {
                                    isNullable = true;
                                }
                                if (nillable === 'false') {
                                    isNullable = false;
                                }
                                fieldMap[fieldName] = {
                                    type: () => {
                                        let outputTC = this.getOutputFieldTypeFromElement(elementObj, aliasMap, complexTypeNamespace);
                                        if (isPlural) {
                                            outputTC = outputTC.getTypePlural();
                                        }
                                        if (isNullable) {
                                            outputTC = outputTC.getTypeNonNull();
                                        }
                                        return outputTC;
                                    },
                                };
                            }
                        }
                    }
                }
            }
            if (Object.keys(fieldMap).length === 0) {
                complexTypeTC = this.schemaComposer.createScalarTC(GraphQLJSON);
            }
            else {
                complexTypeTC = this.schemaComposer.createObjectTC({
                    name: `${prefix}_${complexTypeName}`,
                    fields: fieldMap,
                });
            }
            this.complexTypeOutputTCMap.set(complexType, complexTypeTC);
        }
        return complexTypeTC;
    }
    getOutputTypeForTypeNameInNamespace({ typeName, typeNamespace, }) {
        var _a, _b;
        const complexType = (_a = this.getNamespaceComplexTypeMap(typeNamespace)) === null || _a === void 0 ? void 0 : _a.get(typeName);
        if (complexType) {
            return this.getOutputTypeForComplexType(complexType, typeNamespace);
        }
        const simpleType = (_b = this.getNamespaceSimpleTypeMap(typeNamespace)) === null || _b === void 0 ? void 0 : _b.get(typeName);
        if (simpleType) {
            return this.getTypeForSimpleType(simpleType, typeNamespace);
        }
        throw new Error(`Type: ${typeName} couldn't be found in ${typeNamespace}`);
    }
    getOutputTypeForMessage(message) {
        let outputTCAndName = this.messageOutputTCMap.get(message);
        if (!outputTCAndName) {
            const aliasMap = this.aliasMap.get(message);
            const partObj = message.part[0];
            if (partObj.attributes.element) {
                const [elementNamespaceAlias, elementName] = partObj.attributes.element.split(':');
                outputTCAndName = {
                    type: () => {
                        const elementTypeNamespace = aliasMap.get(elementNamespaceAlias) || partObj.attributes[elementNamespaceAlias];
                        if (!elementTypeNamespace) {
                            throw new Error(`Namespace alias: ${elementNamespaceAlias} is undefined!`);
                        }
                        return this.getOutputTypeForTypeNameInNamespace({
                            typeName: elementName,
                            typeNamespace: elementTypeNamespace,
                        });
                    },
                    elementName,
                };
            }
            else if (partObj.attributes.type) {
                const elementName = partObj.attributes.name;
                outputTCAndName = {
                    type: () => {
                        const [typeNamespaceAlias, typeName] = partObj.attributes.type.split(':');
                        const typeNamespace = aliasMap.get(typeNamespaceAlias);
                        if (!typeNamespace) {
                            throw new Error(`Namespace alias: ${typeNamespaceAlias} is undefined!`);
                        }
                        return this.getOutputTypeForTypeNameInNamespace({ typeName, typeNamespace });
                    },
                    elementName,
                };
            }
            this.messageOutputTCMap.set(message, outputTCAndName);
        }
        return outputTCAndName;
    }
    buildSchema() {
        if (this.schemaComposer.Query.getFieldNames().length === 0) {
            this.schemaComposer.Query.addFields({
                placeholder: {
                    type: GraphQLVoid,
                },
            });
        }
        return this.schemaComposer.buildSchema();
    }
}
