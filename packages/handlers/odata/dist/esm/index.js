import { readFileOrUrl } from '@graphql-mesh/utils';
import { getInterpolatedHeadersFactory, parseInterpolationStrings, stringInterpolator, } from '@graphql-mesh/string-interpolation';
import urljoin from 'url-join';
import { SchemaComposer, InterfaceTypeComposer, } from 'graphql-compose';
import { GraphQLBigInt, GraphQLGUID, GraphQLDateTime, GraphQLJSON, GraphQLDate, GraphQLByte, GraphQLISO8601Duration, } from 'graphql-scalars';
import { isListType, isAbstractType, specifiedDirectives, getNamedType, } from 'graphql';
import { parseResolveInfo, simplifyParsedResolveInfoFragmentWithType, } from 'graphql-parse-resolve-info';
import DataLoader from 'dataloader';
import { parseResponse } from 'http-string-parser';
import { pascalCase } from 'pascal-case';
// eslint-disable-next-line import/no-nodejs-modules
import EventEmitter from 'events';
import { XMLParser } from 'fast-xml-parser';
import { memoize1 } from '@graphql-tools/utils';
import { Request, Response } from '@whatwg-node/fetch';
import { PredefinedProxyOptions } from '@graphql-mesh/store';
import { createDefaultExecutor } from '@graphql-tools/delegate';
import { process } from '@graphql-mesh/cross-helpers';
const SCALARS = new Map([
    ['Edm.Binary', 'String'],
    ['Edm.Stream', 'String'],
    ['Edm.String', 'String'],
    ['Edm.Int16', 'Int'],
    ['Edm.Byte', 'Byte'],
    ['Edm.Int32', 'Int'],
    ['Edm.Int64', 'BigInt'],
    ['Edm.Double', 'Float'],
    ['Edm.Boolean', 'Boolean'],
    ['Edm.Guid', 'GUID'],
    ['Edm.DateTimeOffset', 'DateTime'],
    ['Edm.Date', 'Date'],
    ['Edm.TimeOfDay', 'String'],
    ['Edm.Single', 'Float'],
    ['Edm.Duration', 'ISO8601Duration'],
    ['Edm.Decimal', 'Float'],
    ['Edm.SByte', 'Byte'],
    ['Edm.GeographyPoint', 'String'],
]);
const queryOptionsFields = {
    orderby: {
        type: 'String',
        description: 'A data service URI with a $orderby System Query Option specifies an expression for determining what values are used to order the collection of Entries identified by the Resource Path section of the URI. This query option is only supported when the resource path identifies a Collection of Entries.',
    },
    top: {
        type: 'Int',
        description: 'A data service URI with a $top System Query Option identifies a subset of the Entries in the Collection of Entries identified by the Resource Path section of the URI. This subset is formed by selecting only the first N items of the set, where N is an integer greater than or equal to zero specified by this query option. If a value less than zero is specified, the URI should be considered malformed.',
    },
    skip: {
        type: 'Int',
        description: 'A data service URI with a $skip System Query Option identifies a subset of the Entries in the Collection of Entries identified by the Resource Path section of the URI. That subset is defined by seeking N Entries into the Collection and selecting only the remaining Entries (starting with Entry N+1). N is an integer greater than or equal to zero specified by this query option. If a value less than zero is specified, the URI should be considered malformed.',
    },
    filter: {
        type: 'String',
        description: 'A URI with a $filter System Query Option identifies a subset of the Entries from the Collection of Entries identified by the Resource Path section of the URI. The subset is determined by selecting only the Entries that satisfy the predicate expression specified by the query option.',
    },
    inlinecount: {
        type: 'InlineCount',
        description: 'A URI with a $inlinecount System Query Option specifies that the response to the request includes a count of the number of Entries in the Collection of Entries identified by the Resource Path section of the URI. The count must be calculated after applying any $filter System Query Options present in the URI. The set of valid values for the $inlinecount query option are shown in the table below. If a value other than one shown in Table 4 is specified the URI is considered malformed.',
    },
    count: {
        type: 'Boolean',
    },
};
export default class ODataHandler {
    constructor({ name, config, baseDir, importFn, logger, store, }) {
        this.eventEmitterSet = new Set();
        this.xmlParser = new XMLParser({
            attributeNamePrefix: '',
            attributesGroupName: 'attributes',
            textNodeName: 'innerText',
            ignoreAttributes: false,
            removeNSPrefix: true,
            isArray: (_, __, ___, isAttribute) => !isAttribute,
            allowBooleanAttributes: true,
            preserveOrder: false,
        });
        this.name = name;
        this.config = config;
        this.baseDir = baseDir;
        this.importFn = importFn;
        this.logger = logger;
        this.metadataJson = store.proxy('metadata.json', PredefinedProxyOptions.JsonWithoutValidation);
    }
    async getCachedMetadataJson() {
        return this.metadataJson.getWithSet(async () => {
            const endpoint = stringInterpolator.parse(this.config.endpoint, {
                env: process.env,
            });
            const metadataUrl = urljoin(endpoint, '$metadata');
            const metadataText = await readFileOrUrl(this.config.source || metadataUrl, {
                allowUnknownExtensions: true,
                cwd: this.baseDir,
                headers: this.config.schemaHeaders,
                fetch: this.fetchFn,
                logger: this.logger,
                importFn: this.importFn,
            });
            return this.xmlParser.parse(metadataText);
        });
    }
    async getMeshSource({ fetchFn }) {
        this.fetchFn = fetchFn;
        const { endpoint: nonInterpolatedBaseUrl, operationHeaders } = this.config;
        const endpoint = stringInterpolator.parse(nonInterpolatedBaseUrl, {
            env: process.env,
        });
        const schemaComposer = new SchemaComposer();
        schemaComposer.add(GraphQLBigInt);
        schemaComposer.add(GraphQLGUID);
        schemaComposer.add(GraphQLDateTime);
        schemaComposer.add(GraphQLJSON);
        schemaComposer.add(GraphQLByte);
        schemaComposer.add(GraphQLDate);
        schemaComposer.add(GraphQLISO8601Duration);
        const aliasNamespaceMap = new Map();
        const metadataJson = await this.getCachedMetadataJson();
        const schemas = metadataJson.Edmx[0].DataServices[0].Schema;
        const multipleSchemas = schemas.length > 1;
        const namespaces = new Set();
        const contextDataloaderName = Symbol(`${this.name}DataLoader`);
        function getNamespaceFromTypeRef(typeRef) {
            let namespace = '';
            namespaces === null || namespaces === void 0 ? void 0 : namespaces.forEach(el => {
                if (typeRef.startsWith(el) &&
                    el.length > namespace.length && // It can be deeper namespace
                    !typeRef.replace(el + '.', '').includes('.') // Typename cannot have `.`
                ) {
                    namespace = el;
                }
            });
            return namespace;
        }
        function getTypeNameFromRef({ typeRef, isInput, isRequired, }) {
            const typeRefArr = typeRef.split('Collection(');
            const arrayDepth = typeRefArr.length;
            let actualTypeRef = typeRefArr.join('').split(')').join('');
            const typeNamespace = getNamespaceFromTypeRef(actualTypeRef);
            if (aliasNamespaceMap.has(typeNamespace)) {
                const alias = aliasNamespaceMap.get(typeNamespace);
                actualTypeRef = actualTypeRef.replace(typeNamespace, alias);
            }
            const actualTypeRefArr = actualTypeRef.split('.');
            const typeName = multipleSchemas
                ? pascalCase(actualTypeRefArr.join('_'))
                : actualTypeRefArr[actualTypeRefArr.length - 1];
            let realTypeName = typeName;
            if (SCALARS.has(actualTypeRef)) {
                realTypeName = SCALARS.get(actualTypeRef);
            }
            else if (schemaComposer.isEnumType(typeName)) {
                realTypeName = typeName;
            }
            else if (isInput) {
                realTypeName += 'Input';
            }
            const fakeEmptyArr = new Array(arrayDepth);
            realTypeName = fakeEmptyArr.join('[') + realTypeName + fakeEmptyArr.join(']');
            if (isRequired) {
                realTypeName += '!';
            }
            return realTypeName;
        }
        function getUrlString(url) {
            return decodeURIComponent(url.toString()).split('+').join(' ');
        }
        function handleResponseText(responseText, urlString, info) {
            let responseJson;
            try {
                responseJson = JSON.parse(responseText);
            }
            catch (error) {
                const actualError = new Error(responseText);
                Object.assign(actualError, {
                    extensions: {
                        url: urlString,
                    },
                });
                throw actualError;
            }
            if (responseJson.error) {
                const actualError = new Error(responseJson.error.message || responseJson.error);
                actualError.extensions = responseJson.error;
                throw actualError;
            }
            const urlStringWithoutSearchParams = urlString.split('?')[0];
            if (isListType(info.returnType)) {
                const actualReturnType = getNamedType(info.returnType);
                const entityTypeExtensions = actualReturnType.extensions;
                if ('Message' in responseJson && !('value' in responseJson)) {
                    const error = new Error(responseJson.Message);
                    Object.assign(error, { extensions: responseJson });
                    throw error;
                }
                const returnList = responseJson.value;
                return returnList.map(element => {
                    if (!(entityTypeExtensions === null || entityTypeExtensions === void 0 ? void 0 : entityTypeExtensions.entityInfo)) {
                        return element;
                    }
                    const urlOfElement = new URL(urlStringWithoutSearchParams);
                    addIdentifierToUrl(urlOfElement, entityTypeExtensions.entityInfo.identifierFieldName, entityTypeExtensions.entityInfo.identifierFieldTypeRef, element);
                    const identifierUrl = element['@odata.id'] || getUrlString(urlOfElement);
                    const fieldMap = actualReturnType.getFields();
                    for (const fieldName in element) {
                        if (entityTypeExtensions.entityInfo.navigationFields.includes(fieldName)) {
                            const field = element[fieldName];
                            let fieldType = fieldMap[fieldName].type;
                            if ('ofType' in fieldType) {
                                fieldType = fieldType.ofType;
                            }
                            const { entityInfo: fieldEntityInfo } = fieldType
                                .extensions;
                            if (field instanceof Array) {
                                for (const fieldElement of field) {
                                    const urlOfField = new URL(urljoin(identifierUrl, fieldName));
                                    addIdentifierToUrl(urlOfField, fieldEntityInfo.identifierFieldName, fieldEntityInfo.identifierFieldTypeRef, fieldElement);
                                    fieldElement['@odata.id'] = fieldElement['@odata.id'] || getUrlString(urlOfField);
                                }
                            }
                            else {
                                const urlOfField = new URL(urljoin(identifierUrl, fieldName));
                                addIdentifierToUrl(urlOfField, fieldEntityInfo.identifierFieldName, fieldEntityInfo.identifierFieldTypeRef, field);
                                field['@odata.id'] = field['@odata.id'] || getUrlString(urlOfField);
                            }
                        }
                    }
                    return {
                        '@odata.id': identifierUrl,
                        ...element,
                    };
                });
            }
            else {
                const actualReturnType = info.returnType;
                const entityTypeExtensions = actualReturnType.extensions;
                if (!(entityTypeExtensions === null || entityTypeExtensions === void 0 ? void 0 : entityTypeExtensions.entityInfo)) {
                    return responseJson;
                }
                const identifierUrl = responseJson['@odata.id'] || urlStringWithoutSearchParams;
                const fieldMap = actualReturnType.getFields();
                for (const fieldName in responseJson) {
                    if (entityTypeExtensions === null || entityTypeExtensions === void 0 ? void 0 : entityTypeExtensions.entityInfo.navigationFields.includes(fieldName)) {
                        const field = responseJson[fieldName];
                        let fieldType = fieldMap[fieldName].type;
                        if ('ofType' in fieldType) {
                            fieldType = fieldType.ofType;
                        }
                        const { entityInfo: fieldEntityInfo } = fieldType
                            .extensions;
                        if (field instanceof Array) {
                            for (const fieldElement of field) {
                                const urlOfField = new URL(urljoin(identifierUrl, fieldName));
                                addIdentifierToUrl(urlOfField, fieldEntityInfo.identifierFieldName, fieldEntityInfo.identifierFieldTypeRef, fieldElement);
                                fieldElement['@odata.id'] = fieldElement['@odata.id'] || getUrlString(urlOfField);
                            }
                        }
                        else {
                            const urlOfField = new URL(urljoin(identifierUrl, fieldName));
                            addIdentifierToUrl(urlOfField, fieldEntityInfo.identifierFieldName, fieldEntityInfo.identifierFieldTypeRef, field);
                            field['@odata.id'] = field['@odata.id'] || getUrlString(urlOfField);
                        }
                    }
                }
                return {
                    '@odata.id': responseJson['@odata.id'] || urlStringWithoutSearchParams,
                    ...responseJson,
                };
            }
        }
        schemaComposer.createEnumTC({
            name: 'InlineCount',
            values: {
                allpages: {
                    value: 'allpages',
                    description: 'The OData MUST include a count of the number of entities in the collection identified by the URI (after applying any $filter System Query Options present on the URI)',
                },
                none: {
                    value: 'none',
                    description: 'The OData service MUST NOT include a count in the response. This is equivalence to a URI that does not include a $inlinecount query string parameter.',
                },
            },
        });
        schemaComposer.createInputTC({
            name: 'QueryOptions',
            fields: queryOptionsFields,
        });
        const origHeadersFactory = getInterpolatedHeadersFactory(operationHeaders);
        const headersFactory = (resolverData, method) => {
            const headers = origHeadersFactory(resolverData);
            if (headers.accept == null) {
                headers.accept = 'application/json';
            }
            if (headers['content-type'] == null && method !== 'GET') {
                headers['content-type'] = 'application/json';
            }
            return headers;
        };
        const { args: commonArgs, contextVariables } = parseInterpolationStrings([
            ...Object.values(operationHeaders || {}),
            endpoint,
        ]);
        function getTCByTypeNames(...typeNames) {
            for (const typeName of typeNames) {
                try {
                    return schemaComposer.getAnyTC(typeName);
                }
                catch (_a) { }
            }
            return null;
        }
        function addIdentifierToUrl(url, identifierFieldName, identifierFieldTypeRef, args) {
            url.href += `/${args[identifierFieldName]}/`;
        }
        function rebuildOpenInputObjects(input) {
            if (typeof input === 'object') {
                if ('rest' in input) {
                    Object.assign(input, input.rest);
                    delete input.rest;
                }
                for (const fieldName in input) {
                    rebuildOpenInputObjects(input[fieldName]);
                }
            }
        }
        function handleBatchJsonResults(batchResponseJson, requests) {
            if ('error' in batchResponseJson) {
                const error = new Error(batchResponseJson.error.message);
                Object.assign(error, {
                    extensions: batchResponseJson.error,
                });
                throw error;
            }
            if (!('responses' in batchResponseJson)) {
                const error = new Error(batchResponseJson.ExceptionMessage ||
                    batchResponseJson.Message ||
                    `Batch Request didn't return a valid response.`);
                Object.assign(error, {
                    extensions: batchResponseJson,
                });
                throw error;
            }
            return requests.map((_req, index) => {
                const responseObj = batchResponseJson.responses.find((res) => res.id === index.toString());
                return new Response(JSON.stringify(responseObj.body), {
                    status: responseObj.status,
                    headers: responseObj.headers,
                });
            });
        }
        const DATALOADER_FACTORIES = {
            multipart: (context) => new DataLoader(async (requests) => {
                var _a;
                let requestBody = '';
                const requestBoundary = 'batch_' + Date.now();
                for (const requestIndex in requests) {
                    requestBody += `--${requestBoundary}\n`;
                    const request = requests[requestIndex];
                    requestBody += `Content-Type: application/http\n`;
                    requestBody += `Content-Transfer-Encoding:binary\n`;
                    requestBody += `Content-ID: ${requestIndex}\n\n`;
                    requestBody += `${request.method} ${request.url} HTTP/1.1\n`;
                    (_a = request.headers) === null || _a === void 0 ? void 0 : _a.forEach((value, key) => {
                        requestBody += `${key}: ${value}\n`;
                    });
                    if (request.body) {
                        const bodyAsStr = await request.text();
                        requestBody += `Content-Length: ${bodyAsStr.length}`;
                        requestBody += `\n`;
                        requestBody += bodyAsStr;
                    }
                    requestBody += `\n`;
                }
                requestBody += `--${requestBoundary}--\n`;
                const batchHeaders = headersFactory({
                    context,
                    env: process.env,
                }, 'POST');
                batchHeaders['content-type'] = `multipart/mixed;boundary=${requestBoundary}`;
                const batchResponse = await this.fetchFn(urljoin(endpoint, '$batch'), {
                    method: 'POST',
                    body: requestBody,
                    headers: batchHeaders,
                });
                if (batchResponse.headers.get('content-type').includes('json')) {
                    const batchResponseJson = await batchResponse.json();
                    return handleBatchJsonResults(batchResponseJson, requests);
                }
                const batchResponseText = await batchResponse.text();
                const responseLines = batchResponseText.split('\n');
                const responseBoundary = responseLines[0];
                const actualResponse = responseLines.slice(1, responseLines.length - 2).join('\n');
                const responseTextArr = actualResponse.split(responseBoundary);
                return responseTextArr.map(responseTextWithContentHeader => {
                    const responseText = responseTextWithContentHeader.split('\n').slice(4).join('\n');
                    const { body, headers, statusCode, statusMessage } = parseResponse(responseText);
                    return new Response(body, {
                        headers,
                        status: parseInt(statusCode),
                        statusText: statusMessage,
                    });
                });
            }),
            json: (context) => new DataLoader(async (requests) => {
                const batchHeaders = headersFactory({
                    context,
                    env: process.env,
                }, 'POST');
                batchHeaders['content-type'] = 'application/json';
                const batchResponse = await this.fetchFn(urljoin(endpoint, '$batch'), {
                    method: 'POST',
                    body: JSON.stringify({
                        requests: await Promise.all(requests.map(async (request, index) => {
                            var _a;
                            const id = index.toString();
                            const url = request.url.replace(endpoint, '');
                            const method = request.method;
                            const headers = {};
                            (_a = request.headers) === null || _a === void 0 ? void 0 : _a.forEach((value, key) => {
                                headers[key] = value;
                            });
                            return {
                                id,
                                url,
                                method,
                                body: request.body && (await request.json()),
                                headers,
                            };
                        })),
                    }),
                    headers: batchHeaders,
                });
                const batchResponseJson = await batchResponse.json();
                return handleBatchJsonResults(batchResponseJson, requests);
            }),
            none: () => 
            // We should refactor here
            new DataLoader((requests) => Promise.all(requests.map(async (request) => this.fetchFn(request.url, {
                method: request.method,
                body: request.body && (await request.text()),
                headers: request.headers,
            })))),
        };
        const dataLoaderFactory = memoize1(DATALOADER_FACTORIES[this.config.batch || 'none']);
        function buildName({ schemaNamespace, name }) {
            const alias = aliasNamespaceMap.get(schemaNamespace) || schemaNamespace;
            const ref = alias + '.' + name;
            return multipleSchemas ? pascalCase(ref.split('.').join('_')) : name;
        }
        schemas === null || schemas === void 0 ? void 0 : schemas.forEach((schemaObj) => {
            const schemaNamespace = schemaObj.attributes.Namespace;
            namespaces.add(schemaNamespace);
            const schemaAlias = schemaObj.attributes.Alias;
            if (schemaAlias) {
                aliasNamespaceMap.set(schemaNamespace, schemaAlias);
            }
        });
        schemas === null || schemas === void 0 ? void 0 : schemas.forEach((schemaObj) => {
            var _a, _b, _c;
            const schemaNamespace = schemaObj.attributes.Namespace;
            (_a = schemaObj.EnumType) === null || _a === void 0 ? void 0 : _a.forEach((enumObj) => {
                var _a;
                const values = {};
                (_a = enumObj.Member) === null || _a === void 0 ? void 0 : _a.forEach((memberObj) => {
                    const key = memberObj.attributes.Name;
                    // This doesn't work.
                    // const value = memberElement.getAttribute('Value')!;
                    values[key] = {
                        value: key,
                        extensions: { memberObj },
                    };
                });
                const enumTypeName = buildName({ schemaNamespace, name: enumObj.attributes.Name });
                schemaComposer.createEnumTC({
                    name: enumTypeName,
                    values,
                    extensions: { enumObj },
                });
            });
            const allTypes = (schemaObj.EntityType || []).concat(schemaObj.ComplexType || []);
            const typesWithBaseType = allTypes.filter((typeObj) => typeObj.attributes.BaseType);
            allTypes === null || allTypes === void 0 ? void 0 : allTypes.forEach((typeObj) => {
                var _a, _b, _c;
                const entityTypeName = buildName({ schemaNamespace, name: typeObj.attributes.Name });
                const isOpenType = typeObj.attributes.OpenType === 'true';
                const isAbstract = typeObj.attributes.Abstract === 'true';
                const eventEmitter = new EventEmitter();
                eventEmitter.setMaxListeners(Infinity);
                this.eventEmitterSet.add(eventEmitter);
                const extensions = {
                    entityInfo: {
                        actualFields: [],
                        navigationFields: [],
                        isOpenType,
                    },
                    typeObj,
                    eventEmitter,
                };
                const inputType = schemaComposer.createInputTC({
                    name: entityTypeName + 'Input',
                    fields: {},
                    extensions: () => extensions,
                });
                let abstractType;
                if (typesWithBaseType.some((typeObj) => typeObj.attributes.BaseType.includes(`.${entityTypeName}`)) ||
                    isAbstract) {
                    abstractType = schemaComposer.createInterfaceTC({
                        name: isAbstract ? entityTypeName : `I${entityTypeName}`,
                        extensions,
                        resolveType: (root) => {
                            var _a;
                            const typeRef = (_a = root['@odata.type']) === null || _a === void 0 ? void 0 : _a.replace('#', '');
                            if (typeRef) {
                                const typeName = getTypeNameFromRef({
                                    typeRef: root['@odata.type'].replace('#', ''),
                                    isInput: false,
                                    isRequired: false,
                                });
                                return typeName;
                            }
                            return isAbstract ? `T${entityTypeName}` : entityTypeName;
                        },
                    });
                }
                const outputType = schemaComposer.createObjectTC({
                    name: isAbstract ? `T${entityTypeName}` : entityTypeName,
                    extensions,
                    interfaces: abstractType ? [abstractType] : [],
                });
                abstractType === null || abstractType === void 0 ? void 0 : abstractType.setInputTypeComposer(inputType);
                outputType.setInputTypeComposer(inputType);
                const propertyRefObj = typeObj.Key && typeObj.Key[0].PropertyRef[0];
                if (propertyRefObj) {
                    extensions.entityInfo.identifierFieldName = propertyRefObj.attributes.Name;
                }
                (_a = typeObj.Property) === null || _a === void 0 ? void 0 : _a.forEach((propertyObj) => {
                    const propertyName = propertyObj.attributes.Name;
                    extensions.entityInfo.actualFields.push(propertyName);
                    const propertyTypeRef = propertyObj.attributes.Type;
                    if (propertyName === extensions.entityInfo.identifierFieldName) {
                        extensions.entityInfo.identifierFieldTypeRef = propertyTypeRef;
                    }
                    const isRequired = propertyObj.attributes.Nullable === 'false';
                    inputType.addFields({
                        [propertyName]: {
                            type: getTypeNameFromRef({
                                typeRef: propertyTypeRef,
                                isInput: true,
                                isRequired,
                            }),
                            extensions: { propertyObj },
                        },
                    });
                    const field = {
                        type: getTypeNameFromRef({
                            typeRef: propertyTypeRef,
                            isInput: false,
                            isRequired,
                        }),
                        extensions: { propertyObj },
                    };
                    abstractType === null || abstractType === void 0 ? void 0 : abstractType.addFields({
                        [propertyName]: field,
                    });
                    outputType.addFields({
                        [propertyName]: field,
                    });
                });
                (_b = typeObj.NavigationProperty) === null || _b === void 0 ? void 0 : _b.forEach((navigationPropertyObj) => {
                    const navigationPropertyName = navigationPropertyObj.attributes.Name;
                    extensions.entityInfo.navigationFields.push(navigationPropertyName);
                    const navigationPropertyTypeRef = navigationPropertyObj.attributes.Type;
                    const isRequired = navigationPropertyObj.attributes.Nullable === 'false';
                    const isList = navigationPropertyTypeRef.startsWith('Collection(');
                    if (isList) {
                        const singularField = {
                            type: getTypeNameFromRef({
                                typeRef: navigationPropertyTypeRef,
                                isInput: false,
                                isRequired,
                            })
                                .replace('[', '')
                                .replace(']', ''),
                            args: {
                                ...commonArgs,
                                id: {
                                    type: 'ID',
                                },
                            },
                            extensions: { navigationPropertyObj },
                            resolve: async (root, args, context, info) => {
                                if (navigationPropertyName in root) {
                                    return root[navigationPropertyName];
                                }
                                const url = new URL(root['@odata.id']);
                                url.href = urljoin(url.href, '/' + navigationPropertyName);
                                const returnType = info.returnType;
                                const { entityInfo } = returnType.extensions;
                                addIdentifierToUrl(url, entityInfo.identifierFieldName, entityInfo.identifierFieldTypeRef, args);
                                const parsedInfoFragment = parseResolveInfo(info);
                                const searchParams = this.prepareSearchParams(parsedInfoFragment, info.schema);
                                searchParams === null || searchParams === void 0 ? void 0 : searchParams.forEach((value, key) => {
                                    url.searchParams.set(key, value);
                                });
                                const urlString = getUrlString(url);
                                const method = 'GET';
                                const request = new Request(urlString, {
                                    method,
                                    headers: headersFactory({
                                        root,
                                        args,
                                        context,
                                        info,
                                        env: process.env,
                                    }, method),
                                });
                                const response = await context[contextDataloaderName].load(request);
                                const responseText = await response.text();
                                return handleResponseText(responseText, urlString, info);
                            },
                        };
                        const pluralField = {
                            type: getTypeNameFromRef({
                                typeRef: navigationPropertyTypeRef,
                                isInput: false,
                                isRequired,
                            }),
                            args: {
                                ...commonArgs,
                                queryOptions: { type: 'QueryOptions' },
                            },
                            extensions: { navigationPropertyObj },
                            resolve: async (root, args, context, info) => {
                                if (navigationPropertyName in root) {
                                    return root[navigationPropertyName];
                                }
                                const url = new URL(root['@odata.id']);
                                url.href = urljoin(url.href, '/' + navigationPropertyName);
                                const parsedInfoFragment = parseResolveInfo(info);
                                const searchParams = this.prepareSearchParams(parsedInfoFragment, info.schema);
                                searchParams === null || searchParams === void 0 ? void 0 : searchParams.forEach((value, key) => {
                                    url.searchParams.set(key, value);
                                });
                                const urlString = getUrlString(url);
                                const method = 'GET';
                                const request = new Request(urlString, {
                                    method,
                                    headers: headersFactory({
                                        root,
                                        args,
                                        context,
                                        info,
                                        env: process.env,
                                    }, method),
                                });
                                const response = await context[contextDataloaderName].load(request);
                                const responseText = await response.text();
                                return handleResponseText(responseText, urlString, info);
                            },
                        };
                        abstractType === null || abstractType === void 0 ? void 0 : abstractType.addFields({
                            [navigationPropertyName]: pluralField,
                            [`${navigationPropertyName}ById`]: singularField,
                        });
                        outputType.addFields({
                            [navigationPropertyName]: pluralField,
                            [`${navigationPropertyName}ById`]: singularField,
                        });
                    }
                    else {
                        const field = {
                            type: getTypeNameFromRef({
                                typeRef: navigationPropertyTypeRef,
                                isInput: false,
                                isRequired,
                            }),
                            args: {
                                ...commonArgs,
                            },
                            extensions: { navigationPropertyObj },
                            resolve: async (root, args, context, info) => {
                                if (navigationPropertyName in root) {
                                    return root[navigationPropertyName];
                                }
                                const url = new URL(root['@odata.id']);
                                url.href = urljoin(url.href, '/' + navigationPropertyName);
                                const parsedInfoFragment = parseResolveInfo(info);
                                const searchParams = this.prepareSearchParams(parsedInfoFragment, info.schema);
                                searchParams === null || searchParams === void 0 ? void 0 : searchParams.forEach((value, key) => {
                                    url.searchParams.set(key, value);
                                });
                                const urlString = getUrlString(url);
                                const method = 'GET';
                                const request = new Request(urlString, {
                                    method,
                                    headers: headersFactory({
                                        root,
                                        args,
                                        context,
                                        info,
                                        env: process.env,
                                    }, method),
                                });
                                const response = await context[contextDataloaderName].load(request);
                                const responseText = await response.text();
                                return handleResponseText(responseText, urlString, info);
                            },
                        };
                        abstractType === null || abstractType === void 0 ? void 0 : abstractType.addFields({
                            [navigationPropertyName]: field,
                        });
                        outputType.addFields({
                            [navigationPropertyName]: field,
                        });
                    }
                });
                if (isOpenType || outputType.getFieldNames().length === 0) {
                    extensions.entityInfo.isOpenType = true;
                    inputType.addFields({
                        rest: {
                            type: 'JSON',
                        },
                    });
                    abstractType === null || abstractType === void 0 ? void 0 : abstractType.addFields({
                        rest: {
                            type: 'JSON',
                            resolve: (root) => root,
                        },
                    });
                    outputType.addFields({
                        rest: {
                            type: 'JSON',
                            resolve: (root) => root,
                        },
                    });
                }
                const updateInputType = inputType.clone(`${entityTypeName}UpdateInput`);
                (_c = updateInputType
                    .getFieldNames()) === null || _c === void 0 ? void 0 : _c.forEach(fieldName => updateInputType.makeOptional(fieldName));
                // Types might be considered as unused implementations of interfaces so we must prevent that
                schemaComposer.addSchemaMustHaveType(outputType);
            });
            const handleUnboundFunctionObj = (unboundFunctionObj) => {
                var _a;
                const functionName = unboundFunctionObj.attributes.Name;
                const returnTypeRef = unboundFunctionObj.ReturnType[0].attributes.Type;
                const returnType = getTypeNameFromRef({
                    typeRef: returnTypeRef,
                    isInput: false,
                    isRequired: false,
                });
                schemaComposer.Query.addFields({
                    [functionName]: {
                        type: returnType,
                        args: {
                            ...commonArgs,
                        },
                        resolve: async (root, args, context, info) => {
                            const url = new URL(endpoint);
                            url.href = urljoin(url.href, '/' + functionName);
                            url.href += `(${Object.entries(args)
                                .filter(argEntry => argEntry[0] !== 'queryOptions')
                                .map(argEntry => argEntry.join(' = '))
                                .join(', ')})`;
                            const parsedInfoFragment = parseResolveInfo(info);
                            const searchParams = this.prepareSearchParams(parsedInfoFragment, info.schema);
                            searchParams === null || searchParams === void 0 ? void 0 : searchParams.forEach((value, key) => {
                                url.searchParams.set(key, value);
                            });
                            const urlString = getUrlString(url);
                            const method = 'GET';
                            const request = new Request(urlString, {
                                method,
                                headers: headersFactory({
                                    root,
                                    args,
                                    context,
                                    info,
                                    env: process.env,
                                }, method),
                            });
                            const response = await context[contextDataloaderName].load(request);
                            const responseText = await response.text();
                            return handleResponseText(responseText, urlString, info);
                        },
                    },
                });
                (_a = unboundFunctionObj.Parameter) === null || _a === void 0 ? void 0 : _a.forEach((parameterObj) => {
                    const parameterName = parameterObj.attributes.Name;
                    const parameterTypeRef = parameterObj.attributes.Type;
                    const isRequired = parameterObj.attributes.Nullable === 'false';
                    const parameterType = getTypeNameFromRef({
                        typeRef: parameterTypeRef,
                        isInput: true,
                        isRequired,
                    });
                    schemaComposer.Query.addFieldArgs(functionName, {
                        [parameterName]: {
                            type: parameterType,
                        },
                    });
                });
            };
            const handleBoundFunctionObj = (boundFunctionObj) => {
                var _a, _b;
                const functionName = boundFunctionObj.attributes.Name;
                const functionRef = schemaNamespace + '.' + functionName;
                const returnTypeRef = boundFunctionObj.ReturnType[0].attributes.Type;
                const returnType = getTypeNameFromRef({
                    typeRef: returnTypeRef,
                    isInput: false,
                    isRequired: false,
                });
                const args = {
                    ...commonArgs,
                };
                // eslint-disable-next-line prefer-const
                let entitySetPath = (_a = boundFunctionObj.attributes.EntitySetPath) === null || _a === void 0 ? void 0 : _a.split('/')[0];
                let field;
                let boundEntityTypeName;
                (_b = boundFunctionObj.Parameter) === null || _b === void 0 ? void 0 : _b.forEach((parameterObj) => {
                    const parameterName = parameterObj.attributes.Name;
                    const parameterTypeRef = parameterObj.attributes.Type;
                    const isRequired = parameterObj.attributes.Nullable === 'false';
                    const parameterTypeName = getTypeNameFromRef({
                        typeRef: parameterTypeRef,
                        isInput: true,
                        isRequired,
                    });
                    // If entitySetPath is not available, take first parameter as entity
                    // The first segment of the entity set path must match the binding parameter name
                    // (see: http://docs.oasis-open.org/odata/odata-csdl-xml/v4.01/odata-csdl-xml-v4.01.html#_Toc38530388)
                    entitySetPath = (entitySetPath && entitySetPath.split('/')[0]) || parameterName;
                    if (entitySetPath === parameterName) {
                        boundEntityTypeName = getTypeNameFromRef({
                            typeRef: parameterTypeRef,
                            isInput: false,
                            isRequired: false,
                        })
                            .replace('[', '')
                            .replace(']', '');
                        field = {
                            type: returnType,
                            args,
                            resolve: async (root, args, context, info) => {
                                const url = new URL(root['@odata.id']);
                                url.href = urljoin(url.href, '/' + functionRef);
                                const argsEntries = Object.entries(args);
                                if (argsEntries.length) {
                                    url.href += `(${argsEntries
                                        .filter(argEntry => argEntry[0] !== 'queryOptions')
                                        .map(([argName, value]) => [
                                        argName,
                                        typeof value === 'string' ? `'${value}'` : value,
                                    ])
                                        .map(argEntry => argEntry.join('='))
                                        .join(',')})`;
                                }
                                const parsedInfoFragment = parseResolveInfo(info);
                                const searchParams = this.prepareSearchParams(parsedInfoFragment, info.schema);
                                searchParams === null || searchParams === void 0 ? void 0 : searchParams.forEach((value, key) => {
                                    url.searchParams.set(key, value);
                                });
                                const urlString = getUrlString(url);
                                const method = 'GET';
                                const request = new Request(urlString, {
                                    method,
                                    headers: headersFactory({
                                        root,
                                        args,
                                        context,
                                        info,
                                        env: process.env,
                                    }, method),
                                });
                                const response = await context[contextDataloaderName].load(request);
                                const responseText = await response.text();
                                return handleResponseText(responseText, urlString, info);
                            },
                        };
                    }
                    args[parameterName] = {
                        type: parameterTypeName,
                    };
                });
                const boundEntityType = schemaComposer.getAnyTC(boundEntityTypeName);
                const boundEntityOtherType = getTCByTypeNames('I' + boundEntityTypeName, 'T' + boundEntityTypeName);
                boundEntityType.addFields({
                    [functionName]: field,
                });
                boundEntityOtherType === null || boundEntityOtherType === void 0 ? void 0 : boundEntityOtherType.addFields({
                    [functionName]: field,
                });
            };
            (_b = schemaObj.Function) === null || _b === void 0 ? void 0 : _b.forEach((functionObj) => {
                var _a;
                if (((_a = functionObj.attributes) === null || _a === void 0 ? void 0 : _a.IsBound) === 'true') {
                    handleBoundFunctionObj(functionObj);
                }
                else {
                    handleUnboundFunctionObj(functionObj);
                }
            });
            const handleUnboundActionObj = (unboundActionObj) => {
                var _a;
                const actionName = unboundActionObj.attributes.Name;
                schemaComposer.Mutation.addFields({
                    [actionName]: {
                        type: 'JSON',
                        args: {
                            ...commonArgs,
                        },
                        resolve: async (root, args, context, info) => {
                            const url = new URL(endpoint);
                            url.href = urljoin(url.href, '/' + actionName);
                            const urlString = getUrlString(url);
                            const method = 'POST';
                            const request = new Request(urlString, {
                                method,
                                headers: headersFactory({
                                    root,
                                    args,
                                    context,
                                    info,
                                    env: process.env,
                                }, method),
                                body: JSON.stringify(args),
                            });
                            const response = await context[contextDataloaderName].load(request);
                            const responseText = await response.text();
                            return handleResponseText(responseText, urlString, info);
                        },
                    },
                });
                (_a = unboundActionObj.Parameter) === null || _a === void 0 ? void 0 : _a.forEach((parameterObj) => {
                    const parameterName = parameterObj.attributes.Name;
                    const parameterTypeRef = parameterObj.attributes.Type;
                    const isRequired = parameterObj.attributes.Nullable === 'false';
                    const parameterType = getTypeNameFromRef({
                        typeRef: parameterTypeRef,
                        isInput: true,
                        isRequired,
                    });
                    schemaComposer.Mutation.addFieldArgs(actionName, {
                        [parameterName]: {
                            type: parameterType,
                        },
                    });
                });
            };
            const handleBoundActionObj = (boundActionObj) => {
                var _a;
                const actionName = boundActionObj.attributes.Name;
                const actionRef = schemaNamespace + '.' + actionName;
                const args = {
                    ...commonArgs,
                };
                let entitySetPath = boundActionObj.attributes.EntitySetPath;
                let boundField;
                let boundEntityTypeName;
                (_a = boundActionObj.Parameter) === null || _a === void 0 ? void 0 : _a.forEach((parameterObj) => {
                    const parameterName = parameterObj.attributes.Name;
                    const parameterTypeRef = parameterObj.attributes.Type;
                    const isRequired = parameterObj.attributes.Nullable === 'false';
                    const parameterTypeName = getTypeNameFromRef({
                        typeRef: parameterTypeRef,
                        isInput: true,
                        isRequired,
                    });
                    // If entitySetPath is not available, take first parameter as entity
                    entitySetPath = entitySetPath || parameterName;
                    if (entitySetPath === parameterName) {
                        boundEntityTypeName = getTypeNameFromRef({
                            typeRef: parameterTypeRef,
                            isInput: false,
                            isRequired: false,
                        })
                            .replace('[', '')
                            .replace(']', ''); // Todo temp workaround
                        boundField = {
                            type: 'JSON',
                            args,
                            resolve: async (root, args, context, info) => {
                                const url = new URL(root['@odata.id']);
                                url.href = urljoin(url.href, '/' + actionRef);
                                const urlString = getUrlString(url);
                                const method = 'POST';
                                const request = new Request(urlString, {
                                    method,
                                    headers: headersFactory({
                                        root,
                                        args,
                                        context,
                                        info,
                                        env: process.env,
                                    }, method),
                                    body: JSON.stringify(args),
                                });
                                const response = await context[contextDataloaderName].load(request);
                                const responseText = await response.text();
                                return handleResponseText(responseText, urlString, info);
                            },
                        };
                    }
                    args[parameterName] = {
                        type: parameterTypeName,
                    };
                });
                const boundEntityType = schemaComposer.getAnyTC(boundEntityTypeName);
                boundEntityType.addFields({
                    [actionName]: boundField,
                });
                const otherType = getTCByTypeNames(`I${boundEntityTypeName}`, `T${boundEntityTypeName}`);
                otherType === null || otherType === void 0 ? void 0 : otherType.addFields({
                    [actionName]: boundField,
                });
            };
            (_c = schemaObj.Action) === null || _c === void 0 ? void 0 : _c.forEach((actionObj) => {
                var _a;
                if (((_a = actionObj.attributes) === null || _a === void 0 ? void 0 : _a.IsBound) === 'true') {
                    handleBoundActionObj(actionObj);
                }
                else {
                    handleUnboundActionObj(actionObj);
                }
            });
            // Rearrange fields for base types and implementations
            typesWithBaseType === null || typesWithBaseType === void 0 ? void 0 : typesWithBaseType.forEach((typeObj) => {
                const typeName = buildName({
                    schemaNamespace,
                    name: typeObj.attributes.Name,
                });
                const inputType = schemaComposer.getITC(typeName + 'Input');
                const abstractType = getTCByTypeNames('I' + typeName, typeName);
                const outputType = getTCByTypeNames('T' + typeName, typeName);
                const baseTypeRef = typeObj.attributes.BaseType;
                const { entityInfo, eventEmitter } = outputType.getExtensions();
                const baseTypeName = getTypeNameFromRef({
                    typeRef: baseTypeRef,
                    isInput: false,
                    isRequired: false,
                });
                const baseInputType = schemaComposer.getAnyTC(baseTypeName + 'Input');
                const baseAbstractType = getTCByTypeNames('I' + baseTypeName, baseTypeName);
                const baseOutputType = getTCByTypeNames('T' + baseTypeName, baseTypeName);
                const { entityInfo: baseEntityInfo, eventEmitter: baseEventEmitter } = baseOutputType.getExtensions();
                const baseEventEmitterListener = () => {
                    inputType.addFields(baseInputType.getFields());
                    entityInfo.identifierFieldName =
                        baseEntityInfo.identifierFieldName || entityInfo.identifierFieldName;
                    entityInfo.identifierFieldTypeRef =
                        baseEntityInfo.identifierFieldTypeRef || entityInfo.identifierFieldTypeRef;
                    entityInfo.actualFields.unshift(...baseEntityInfo.actualFields);
                    abstractType === null || abstractType === void 0 ? void 0 : abstractType.addFields(baseAbstractType === null || baseAbstractType === void 0 ? void 0 : baseAbstractType.getFields());
                    outputType.addFields(baseOutputType.getFields());
                    if (baseAbstractType instanceof InterfaceTypeComposer) {
                        // abstractType.addInterface(baseAbstractType.getTypeName());
                        outputType.addInterface(baseAbstractType.getTypeName());
                    }
                    eventEmitter.emit('onFieldChange');
                };
                baseEventEmitter.on('onFieldChange', baseEventEmitterListener);
                baseEventEmitterListener();
            });
        });
        schemas === null || schemas === void 0 ? void 0 : schemas.forEach((schemaObj) => {
            var _a;
            (_a = schemaObj.EntityContainer) === null || _a === void 0 ? void 0 : _a.forEach((entityContainerObj) => {
                var _a, _b;
                (_a = entityContainerObj.Singleton) === null || _a === void 0 ? void 0 : _a.forEach((singletonObj) => {
                    const singletonName = singletonObj.attributes.Name;
                    const singletonTypeRef = singletonObj.attributes.Type;
                    const singletonTypeName = getTypeNameFromRef({
                        typeRef: singletonTypeRef,
                        isInput: false,
                        isRequired: false,
                    });
                    schemaComposer.Query.addFields({
                        [singletonName]: {
                            type: singletonTypeName,
                            args: {
                                ...commonArgs,
                            },
                            resolve: async (root, args, context, info) => {
                                const url = new URL(endpoint);
                                url.href = urljoin(url.href, '/' + singletonName);
                                const parsedInfoFragment = parseResolveInfo(info);
                                const searchParams = this.prepareSearchParams(parsedInfoFragment, info.schema);
                                searchParams === null || searchParams === void 0 ? void 0 : searchParams.forEach((value, key) => {
                                    url.searchParams.set(key, value);
                                });
                                const urlString = getUrlString(url);
                                const method = 'GET';
                                const request = new Request(urlString, {
                                    method,
                                    headers: headersFactory({
                                        root,
                                        args,
                                        context,
                                        info,
                                        env: process.env,
                                    }, method),
                                });
                                const response = await context[contextDataloaderName].load(request);
                                const responseText = await response.text();
                                return handleResponseText(responseText, urlString, info);
                            },
                        },
                    });
                });
                (_b = entityContainerObj === null || entityContainerObj === void 0 ? void 0 : entityContainerObj.EntitySet) === null || _b === void 0 ? void 0 : _b.forEach((entitySetObj) => {
                    const entitySetName = entitySetObj.attributes.Name;
                    const entitySetTypeRef = entitySetObj.attributes.EntityType;
                    const entityTypeName = getTypeNameFromRef({
                        typeRef: entitySetTypeRef,
                        isInput: false,
                        isRequired: false,
                    });
                    const entityOutputTC = getTCByTypeNames('I' + entityTypeName, entityTypeName);
                    const { entityInfo } = entityOutputTC.getExtensions();
                    const identifierFieldName = entityInfo.identifierFieldName;
                    const identifierFieldTypeRef = entityInfo.identifierFieldTypeRef;
                    const identifierFieldTypeName = entityOutputTC.getFieldTypeName(identifierFieldName);
                    const typeName = entityOutputTC.getTypeName();
                    const commonFields = {
                        [entitySetName]: {
                            type: `[${typeName}]`,
                            args: {
                                ...commonArgs,
                                queryOptions: { type: 'QueryOptions' },
                            },
                            resolve: async (root, args, context, info) => {
                                const url = new URL(endpoint);
                                url.href = urljoin(url.href, '/' + entitySetName);
                                const parsedInfoFragment = parseResolveInfo(info);
                                const searchParams = this.prepareSearchParams(parsedInfoFragment, info.schema);
                                searchParams === null || searchParams === void 0 ? void 0 : searchParams.forEach((value, key) => {
                                    url.searchParams.set(key, value);
                                });
                                const urlString = getUrlString(url);
                                const method = 'GET';
                                const request = new Request(urlString, {
                                    method,
                                    headers: headersFactory({
                                        root,
                                        args,
                                        context,
                                        info,
                                        env: process.env,
                                    }, method),
                                });
                                const response = await context[contextDataloaderName].load(request);
                                const responseText = await response.text();
                                return handleResponseText(responseText, urlString, info);
                            },
                        },
                        [`${entitySetName}By${identifierFieldName}`]: {
                            type: typeName,
                            args: {
                                ...commonArgs,
                                [identifierFieldName]: {
                                    type: identifierFieldTypeName,
                                },
                            },
                            resolve: async (root, args, context, info) => {
                                const url = new URL(endpoint);
                                url.href = urljoin(url.href, '/' + entitySetName);
                                addIdentifierToUrl(url, identifierFieldName, identifierFieldTypeRef, args);
                                const parsedInfoFragment = parseResolveInfo(info);
                                const searchParams = this.prepareSearchParams(parsedInfoFragment, info.schema);
                                searchParams === null || searchParams === void 0 ? void 0 : searchParams.forEach((value, key) => {
                                    url.searchParams.set(key, value);
                                });
                                const urlString = getUrlString(url);
                                const method = 'GET';
                                const request = new Request(urlString, {
                                    method,
                                    headers: headersFactory({
                                        root,
                                        args,
                                        context,
                                        info,
                                        env: process.env,
                                    }, method),
                                });
                                const response = await context[contextDataloaderName].load(request);
                                const responseText = await response.text();
                                return handleResponseText(responseText, urlString, info);
                            },
                        },
                    };
                    schemaComposer.Query.addFields({
                        ...commonFields,
                        [`${entitySetName}Count`]: {
                            type: 'Int',
                            args: {
                                ...commonArgs,
                                queryOptions: { type: 'QueryOptions' },
                            },
                            resolve: async (root, args, context, info) => {
                                const url = new URL(endpoint);
                                url.href = urljoin(url.href, `/${entitySetName}/$count`);
                                const urlString = getUrlString(url);
                                const method = 'GET';
                                const request = new Request(urlString, {
                                    method,
                                    headers: headersFactory({
                                        root,
                                        args,
                                        context,
                                        info,
                                        env: process.env,
                                    }, method),
                                });
                                const response = await context[contextDataloaderName].load(request);
                                const responseText = await response.text();
                                return responseText;
                            },
                        },
                    });
                    schemaComposer.Mutation.addFields({
                        ...commonFields,
                        [`create${entitySetName}`]: {
                            type: typeName,
                            args: {
                                ...commonArgs,
                                input: {
                                    type: entityTypeName + 'Input',
                                },
                            },
                            resolve: async (root, args, context, info) => {
                                const url = new URL(endpoint);
                                url.href = urljoin(url.href, '/' + entitySetName);
                                const urlString = getUrlString(url);
                                rebuildOpenInputObjects(args.input);
                                const method = 'POST';
                                const request = new Request(urlString, {
                                    method,
                                    headers: headersFactory({
                                        root,
                                        args,
                                        context,
                                        info,
                                        env: process.env,
                                    }, method),
                                    body: JSON.stringify(args.input),
                                });
                                const response = await context[contextDataloaderName].load(request);
                                const responseText = await response.text();
                                return handleResponseText(responseText, urlString, info);
                            },
                        },
                        [`delete${entitySetName}By${identifierFieldName}`]: {
                            type: 'JSON',
                            args: {
                                ...commonArgs,
                                [identifierFieldName]: {
                                    type: identifierFieldTypeName,
                                },
                            },
                            resolve: async (root, args, context, info) => {
                                const url = new URL(endpoint);
                                url.href = urljoin(url.href, '/' + entitySetName);
                                addIdentifierToUrl(url, identifierFieldName, identifierFieldTypeRef, args);
                                const urlString = getUrlString(url);
                                const method = 'DELETE';
                                const request = new Request(urlString, {
                                    method,
                                    headers: headersFactory({
                                        root,
                                        args,
                                        context,
                                        info,
                                        env: process.env,
                                    }, method),
                                });
                                const response = await context[contextDataloaderName].load(request);
                                const responseText = await response.text();
                                return handleResponseText(responseText, urlString, info);
                            },
                        },
                        [`update${entitySetName}By${identifierFieldName}`]: {
                            type: typeName,
                            args: {
                                ...commonArgs,
                                [identifierFieldName]: {
                                    type: identifierFieldTypeName,
                                },
                                input: {
                                    type: entityTypeName + 'UpdateInput',
                                },
                            },
                            resolve: async (root, args, context, info) => {
                                const url = new URL(endpoint);
                                url.href = urljoin(url.href, '/' + entitySetName);
                                addIdentifierToUrl(url, identifierFieldName, identifierFieldTypeRef, args);
                                const urlString = getUrlString(url);
                                rebuildOpenInputObjects(args.input);
                                const method = 'PATCH';
                                const request = new Request(urlString, {
                                    method,
                                    headers: headersFactory({
                                        root,
                                        args,
                                        context,
                                        info,
                                        env: process.env,
                                    }, method),
                                    body: JSON.stringify(args.input),
                                });
                                const response = await context[contextDataloaderName].load(request);
                                const responseText = await response.text();
                                return handleResponseText(responseText, urlString, info);
                            },
                        },
                    });
                });
            });
        });
        // graphql-compose doesn't add @defer and @stream to the schema
        specifiedDirectives.forEach(directive => schemaComposer.addDirective(directive));
        const schema = schemaComposer.buildSchema();
        this.eventEmitterSet.forEach(ee => ee.removeAllListeners());
        this.eventEmitterSet.clear();
        const executor = createDefaultExecutor(schema);
        return {
            schema,
            executor: (executionRequest) => {
                const odataContext = {
                    [contextDataloaderName]: dataLoaderFactory(executionRequest.context),
                };
                return executor({
                    ...executionRequest,
                    context: {
                        ...executionRequest.context,
                        ...odataContext,
                    },
                });
            },
            contextVariables,
            batch: true,
        };
    }
    prepareSearchParams(fragment, schema) {
        const fragmentTypeNames = Object.keys(fragment.fieldsByTypeName);
        const returnType = schema.getType(fragmentTypeNames[0]);
        const { args, fields } = simplifyParsedResolveInfoFragmentWithType(fragment, returnType);
        const searchParams = new URLSearchParams();
        if ('queryOptions' in args) {
            const { queryOptions } = args;
            for (const param in queryOptionsFields) {
                if (param in queryOptions) {
                    searchParams.set('$' + param, queryOptions[param]);
                }
            }
        }
        // $select doesn't work with inherited types' fields. So if there is an inline fragment for
        // implemented types, we cannot use $select
        const isSelectable = !isAbstractType(returnType);
        if (isSelectable) {
            const { entityInfo } = returnType.extensions;
            const selectionFields = [];
            const expandedFields = [];
            for (const fieldName in fields) {
                if (entityInfo.actualFields.includes(fieldName)) {
                    selectionFields.push(fieldName);
                }
                if (this.config.expandNavProps && entityInfo.navigationFields.includes(fieldName)) {
                    const searchParams = this.prepareSearchParams(fields[fieldName], schema);
                    const searchParamsStr = decodeURIComponent(searchParams.toString());
                    expandedFields.push(`${fieldName}(${searchParamsStr.split('&').join(';')})`);
                    selectionFields.push(fieldName);
                }
            }
            if (!selectionFields.includes(entityInfo.identifierFieldName)) {
                selectionFields.push(entityInfo.identifierFieldName);
            }
            if (selectionFields.length) {
                searchParams.set('$select', selectionFields.join(','));
            }
            if (expandedFields.length) {
                searchParams.set('$expand', expandedFields.join(','));
            }
        }
        return searchParams;
    }
}
