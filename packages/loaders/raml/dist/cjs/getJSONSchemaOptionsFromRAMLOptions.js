"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getJSONSchemaOptionsFromRAMLOptions = void 0;
const tslib_1 = require("tslib");
const utils_1 = require("@graphql-mesh/utils");
const json_machete_1 = require("json-machete");
const raml_1_parser_1 = require("@ardatan/raml-1-parser");
const fetch_1 = require("@whatwg-node/fetch");
const to_json_schema_1 = tslib_1.__importDefault(require("to-json-schema"));
const utils_2 = require("@graphql-tools/utils");
const utils_js_1 = require("./utils.js");
const string_interpolation_1 = require("@graphql-mesh/string-interpolation");
const cross_helpers_1 = require("@graphql-mesh/cross-helpers");
function resolveTraitsByIs(base) {
    const allTraits = [];
    for (const traitRef of base.is()) {
        const traitNode = traitRef.trait();
        if (traitNode) {
            allTraits.push(traitNode);
            allTraits.push(...resolveTraitsByIs(traitNode));
        }
    }
    return allTraits;
}
/**
 * Generates the options for JSON Schema Loader
 * from RAML Loader options by extracting the JSON Schema references
 * from RAML API Document
 */
async function getJSONSchemaOptionsFromRAMLOptions({ source, cwd: ramlFileCwd = cross_helpers_1.process.cwd(), operations: extraOperations, endpoint: forcedBaseUrl, fetch = fetch_1.fetch, schemaHeaders = {}, selectQueryOrMutationField = [], }) {
    var _a, _b, _c, _d, _e, _f;
    const fieldTypeMap = {};
    for (const { fieldName, type } of selectQueryOrMutationField) {
        fieldTypeMap[fieldName] = type;
    }
    const operations = extraOperations || [];
    const ramlAbsolutePath = (0, json_machete_1.getAbsolutePath)(source, ramlFileCwd);
    const schemaHeadersFactory = (0, string_interpolation_1.getInterpolatedHeadersFactory)(schemaHeaders);
    const ramlAPI = (await (0, raml_1_parser_1.loadApi)(ramlAbsolutePath, [], {
        httpResolver: {
            getResourceAsync: async (url) => {
                const fetchResponse = await fetch(url, {
                    headers: schemaHeadersFactory({ env: cross_helpers_1.process.env }),
                });
                const content = await fetchResponse.text();
                if (fetchResponse.status !== 200) {
                    return {
                        errorMessage: content,
                    };
                }
                return {
                    content,
                };
            },
            getResource: () => {
                throw new Error(`Sync fetching not available for URLs`);
            },
        },
    }));
    let endpoint = forcedBaseUrl;
    if (!endpoint) {
        endpoint = ramlAPI.baseUri().value();
        for (const endpointParamNode of ramlAPI.baseUriParameters()) {
            const paramName = endpointParamNode.name();
            endpoint = endpoint.split(`{${paramName}}`).join(`{context.${paramName}}`);
        }
    }
    const pathTypeMap = new Map();
    const typePathMap = new Map();
    for (const typeNode of ramlAPI.types()) {
        const typeNodeJson = typeNode.toJSON();
        for (const typeName in typeNodeJson) {
            const { schemaPath } = typeNodeJson[typeName];
            if (schemaPath) {
                pathTypeMap.set(schemaPath, typeName);
                typePathMap.set(typeName, schemaPath);
            }
        }
    }
    const cwd = (0, json_machete_1.getCwd)(ramlAbsolutePath);
    const apiQueryParameters = [];
    const apiBodyNodes = [];
    const apiResponses = [];
    for (const traitNode of ramlAPI.traits()) {
        apiQueryParameters.push(...traitNode.queryParameters());
        apiBodyNodes.push(...traitNode.body());
        apiResponses.push(...traitNode.responses());
        const nestedTraits = resolveTraitsByIs(traitNode);
        for (const nestedTrait of nestedTraits) {
            apiQueryParameters.push(...nestedTrait.queryParameters());
            apiBodyNodes.push(...nestedTrait.body());
            apiResponses.push(...nestedTrait.responses());
        }
    }
    for (const resourceNode of ramlAPI.allResources()) {
        const resourceQueryParameters = [...apiQueryParameters];
        const resourceBodyNodes = [...apiBodyNodes];
        const resourceResponses = [...apiResponses];
        const resourceTraits = resolveTraitsByIs(resourceNode);
        for (const traitNode of resourceTraits) {
            apiQueryParameters.push(...traitNode.queryParameters());
            apiBodyNodes.push(...traitNode.body());
            apiResponses.push(...traitNode.responses());
        }
        for (const methodNode of resourceNode.methods()) {
            const queryParameters = [...resourceQueryParameters];
            const bodyNodes = [...resourceBodyNodes];
            const responses = [...resourceResponses];
            const traits = resolveTraitsByIs(methodNode);
            for (const traitNode of traits) {
                queryParameters.push(...traitNode.queryParameters());
                bodyNodes.push(...traitNode.body());
                responses.push(...traitNode.responses());
            }
            queryParameters.push(...methodNode.queryParameters());
            bodyNodes.push(...methodNode.body());
            responses.push(...methodNode.responses());
            let requestSchema;
            let requestTypeName;
            const responseByStatusCode = {};
            const method = methodNode.method().toUpperCase();
            let fieldName = (_a = methodNode.displayName()) === null || _a === void 0 ? void 0 : _a.replace('GET_', '');
            const description = ((_b = methodNode.description()) === null || _b === void 0 ? void 0 : _b.value()) || ((_c = resourceNode.description()) === null || _c === void 0 ? void 0 : _c.value());
            const originalFullRelativeUrl = resourceNode.completeRelativeUri();
            let fullRelativeUrl = originalFullRelativeUrl;
            const argTypeMap = {};
            const queryParamArgMap = {};
            for (const uriParameterNode of resourceNode.uriParameters()) {
                const paramName = uriParameterNode.name();
                const argName = (0, utils_1.sanitizeNameForGraphQL)(paramName);
                fullRelativeUrl = fullRelativeUrl.replace(`{${paramName}}`, `{args.${argName}}`);
                const uriParameterNodeJson = uriParameterNode.toJSON();
                if (uriParameterNodeJson.displayName) {
                    uriParameterNodeJson.title = uriParameterNodeJson.displayName;
                }
                argTypeMap[argName] = uriParameterNodeJson;
            }
            for (const queryParameterNode of queryParameters) {
                const parameterName = queryParameterNode.name();
                const argName = (0, utils_1.sanitizeNameForGraphQL)(parameterName);
                const queryParameterNodeJson = queryParameterNode.toJSON();
                if (queryParameterNodeJson.displayName) {
                    queryParameterNodeJson.title = queryParameterNodeJson.displayName;
                }
                queryParamArgMap[parameterName] = argName;
                argTypeMap[argName] = queryParameterNodeJson;
            }
            for (const bodyNode of bodyNodes) {
                if (bodyNode.name().includes('application/json')) {
                    const bodyJson = bodyNode.toJSON();
                    if (bodyJson.schemaPath) {
                        const schemaPath = bodyJson.schemaPath;
                        requestSchema = schemaPath;
                        requestTypeName = pathTypeMap.get(schemaPath);
                    }
                    else if (bodyJson.type) {
                        const typeName = (0, utils_2.asArray)(bodyJson.type)[0];
                        requestTypeName = typeName;
                        const schemaPath = typePathMap.get(typeName);
                        requestSchema = schemaPath;
                    }
                }
            }
            for (const responseNode of responses) {
                const statusCode = responseNode.code().value();
                const responseNodeDescription = (_d = responseNode.description()) === null || _d === void 0 ? void 0 : _d.value();
                for (const bodyNode of responseNode.body()) {
                    if (bodyNode.name().includes('application/json')) {
                        const bodyJson = bodyNode.toJSON();
                        if (bodyJson.schemaPath) {
                            const schemaPath = bodyJson.schemaPath;
                            const typeName = pathTypeMap.get(schemaPath);
                            if (schemaPath) {
                                responseByStatusCode[statusCode] = {
                                    responseSchema: schemaPath,
                                    responseTypeName: typeName,
                                };
                            }
                        }
                        else if (bodyJson.type) {
                            const typeName = (0, utils_2.asArray)(bodyJson.type)[0];
                            const schemaPath = typePathMap.get(typeName);
                            if (schemaPath) {
                                responseByStatusCode[statusCode] = {
                                    responseSchema: schemaPath,
                                    responseTypeName: typeName,
                                };
                            }
                        }
                        if (!responseByStatusCode[statusCode] && bodyJson.example) {
                            const responseSchema = (0, to_json_schema_1.default)(bodyJson.example, {
                                required: false,
                            });
                            responseSchema.description = responseNodeDescription;
                            responseByStatusCode[statusCode] = {
                                responseSchema,
                            };
                        }
                    }
                }
            }
            fieldName =
                fieldName ||
                    (0, utils_js_1.getFieldNameFromPath)(originalFullRelativeUrl, method, (_e = responseByStatusCode['200']) === null || _e === void 0 ? void 0 : _e.responseTypeName);
            if (fieldName) {
                const graphQLFieldName = (0, utils_1.sanitizeNameForGraphQL)(fieldName);
                const operationType = ((_f = fieldTypeMap[graphQLFieldName]) !== null && _f !== void 0 ? _f : method === 'GET') ? 'query' : 'mutation';
                operations.push({
                    type: operationType,
                    field: graphQLFieldName,
                    description,
                    path: fullRelativeUrl,
                    method,
                    requestSchema,
                    requestTypeName,
                    responseByStatusCode,
                    argTypeMap,
                });
            }
        }
    }
    return {
        operations,
        endpoint,
        cwd,
        fetch,
    };
}
exports.getJSONSchemaOptionsFromRAMLOptions = getJSONSchemaOptionsFromRAMLOptions;
