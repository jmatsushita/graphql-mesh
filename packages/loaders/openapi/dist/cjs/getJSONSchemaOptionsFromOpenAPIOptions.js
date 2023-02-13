"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getJSONSchemaOptionsFromOpenAPIOptions = void 0;
const utils_1 = require("@graphql-mesh/utils");
const json_machete_1 = require("json-machete");
const utils_js_1 = require("./utils.js");
const graphql_1 = require("graphql");
const string_interpolation_1 = require("@graphql-mesh/string-interpolation");
const cross_helpers_1 = require("@graphql-mesh/cross-helpers");
async function getJSONSchemaOptionsFromOpenAPIOptions(name, { source, fallbackFormat, cwd, fetch: fetchFn, endpoint, schemaHeaders, operationHeaders, queryParams = {}, selectQueryOrMutationField = [], logger = new utils_1.DefaultLogger('getJSONSchemaOptionsFromOpenAPIOptions'), }) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m;
    const fieldTypeMap = {};
    for (const { fieldName, type } of selectQueryOrMutationField) {
        fieldTypeMap[fieldName] = type;
    }
    const schemaHeadersFactory = (0, string_interpolation_1.getInterpolatedHeadersFactory)(schemaHeaders);
    logger === null || logger === void 0 ? void 0 : logger.debug(`Fetching OpenAPI Document from ${source}`);
    let oasOrSwagger = typeof source === 'string'
        ? await (0, utils_1.readFileOrUrl)(source, {
            cwd,
            fallbackFormat,
            headers: schemaHeadersFactory({ env: cross_helpers_1.process.env }),
            fetch: fetchFn,
            importFn: utils_1.defaultImportFn,
            logger,
        })
        : source;
    (0, json_machete_1.handleUntitledDefinitions)(oasOrSwagger);
    oasOrSwagger = (await (0, json_machete_1.dereferenceObject)(oasOrSwagger));
    const operations = [];
    let baseOperationArgTypeMap;
    if (!endpoint) {
        if ('servers' in oasOrSwagger) {
            const serverObj = oasOrSwagger.servers[0];
            endpoint = serverObj.url.split('{').join('{args.');
            if (serverObj.variables) {
                for (const variableName in serverObj.variables) {
                    const variable = serverObj.variables[variableName];
                    if (!variable.type) {
                        variable.type = 'string';
                    }
                    baseOperationArgTypeMap = baseOperationArgTypeMap || {};
                    baseOperationArgTypeMap[variableName] = variable;
                    if (variable.default) {
                        endpoint = endpoint.replace(`{args.${variableName}}`, `{args.${variableName}:${variable.default}}`);
                    }
                }
            }
        }
        if ('schemes' in oasOrSwagger && oasOrSwagger.schemes.length > 0 && oasOrSwagger.host) {
            endpoint = oasOrSwagger.schemes[0] + '://' + oasOrSwagger.host;
            if ('basePath' in oasOrSwagger) {
                endpoint += oasOrSwagger.basePath;
            }
        }
    }
    const methodObjFieldMap = new WeakMap();
    for (const relativePath in oasOrSwagger.paths) {
        const pathObj = oasOrSwagger.paths[relativePath];
        const pathParameters = pathObj.parameters;
        for (const method in pathObj) {
            if (method === 'parameters') {
                continue;
            }
            const methodObj = pathObj[method];
            const operationConfig = {
                method: method.toUpperCase(),
                path: relativePath,
                type: method.toUpperCase() === 'GET' ? 'query' : 'mutation',
                field: methodObj.operationId && (0, utils_1.sanitizeNameForGraphQL)(methodObj.operationId),
                description: methodObj.description || methodObj.summary,
                schemaHeaders,
                operationHeaders,
                responseByStatusCode: {},
                ...(baseOperationArgTypeMap
                    ? {
                        argTypeMap: {
                            ...baseOperationArgTypeMap,
                        },
                    }
                    : {}),
            };
            operations.push(operationConfig);
            methodObjFieldMap.set(methodObj, operationConfig);
            let allParams;
            if (methodObj.parameters && Array.isArray(methodObj.parameters)) {
                allParams = [...(pathParameters || []), ...methodObj.parameters];
            }
            else {
                allParams = {
                    ...(pathParameters || {}),
                    ...(methodObj.parameters || {}),
                };
            }
            for (const paramObjIndex in allParams) {
                const paramObj = allParams[paramObjIndex];
                const argName = (0, utils_1.sanitizeNameForGraphQL)(paramObj.name);
                const operationArgTypeMap = (operationConfig.argTypeMap =
                    operationConfig.argTypeMap || {});
                switch (paramObj.in) {
                    case 'query':
                        operationConfig.queryParamArgMap = operationConfig.queryParamArgMap || {};
                        operationConfig.queryParamArgMap[paramObj.name] = argName;
                        if (paramObj.name in queryParams) {
                            paramObj.required = false;
                            if (!((_a = paramObj.schema) === null || _a === void 0 ? void 0 : _a.default)) {
                                paramObj.schema = paramObj.schema || {
                                    type: 'string',
                                };
                                paramObj.schema.default = queryParams[paramObj.name];
                            }
                        }
                        if ('explode' in paramObj) {
                            operationConfig.queryStringOptionsByParam =
                                operationConfig.queryStringOptionsByParam || {};
                            operationConfig.queryStringOptionsByParam[paramObj.name] =
                                operationConfig.queryStringOptionsByParam[paramObj.name] || {};
                            if (paramObj.explode) {
                                operationConfig.queryStringOptionsByParam[paramObj.name].arrayFormat = 'repeat';
                                operationConfig.queryStringOptionsByParam[paramObj.name].destructObject = true;
                            }
                            else {
                                if (paramObj.style === 'form') {
                                    operationConfig.queryStringOptionsByParam[paramObj.name].arrayFormat = 'comma';
                                }
                                else {
                                    logger.warn(`Other styles including ${paramObj.style} of query parameters are not supported yet.`);
                                }
                            }
                        }
                        break;
                    case 'path': {
                        // If it is in the path, let JSON Schema handler put it
                        operationConfig.path = operationConfig.path.replace(`{${paramObj.name}}`, `{args.${argName}}`);
                        break;
                    }
                    case 'header': {
                        operationConfig.headers = operationConfig.headers || {};
                        if (typeof operationHeaders === 'object' && operationHeaders[paramObj.name]) {
                            paramObj.required = false;
                            const valueFromGlobal = operationHeaders[paramObj.name];
                            if (!valueFromGlobal.includes('{')) {
                                if (paramObj.schema) {
                                    paramObj.schema.default = valueFromGlobal;
                                }
                            }
                            else {
                                if ((_b = paramObj.schema) === null || _b === void 0 ? void 0 : _b.default) {
                                    delete paramObj.schema.default;
                                }
                            }
                        }
                        if (typeof operationHeaders === 'function') {
                            paramObj.required = false;
                            if ((_c = paramObj.schema) === null || _c === void 0 ? void 0 : _c.default) {
                                delete paramObj.schema.default;
                            }
                        }
                        let defaultValueSuffix = '';
                        if ((_d = paramObj.schema) === null || _d === void 0 ? void 0 : _d.default) {
                            defaultValueSuffix = `:${paramObj.schema.default}`;
                        }
                        operationConfig.headers[paramObj.name] = `{args.${argName}${defaultValueSuffix}}`;
                        break;
                    }
                    case 'cookie': {
                        operationConfig.headers = operationConfig.headers || {};
                        operationConfig.headers.cookie = operationConfig.headers.cookie || '';
                        const cookieParams = operationConfig.headers.cookie.split(' ').filter(c => !!c);
                        cookieParams.push(`${paramObj.name}={args.${argName}};`);
                        operationConfig.headers.cookie = `${cookieParams.join(' ')}`;
                        break;
                    }
                    case 'body':
                        if (paramObj.schema && Object.keys(paramObj.schema).length > 0) {
                            operationConfig.requestSchema = paramObj.schema;
                        }
                        if (paramObj.example) {
                            operationConfig.requestSample = paramObj.example;
                        }
                        if (paramObj.examples) {
                            operationConfig.requestSample = Object.values(paramObj.examples)[0];
                        }
                        break;
                }
                operationArgTypeMap[argName] =
                    paramObj.schema || ((_f = (_e = paramObj.content) === null || _e === void 0 ? void 0 : _e['application/json']) === null || _f === void 0 ? void 0 : _f.schema) || paramObj;
                if (!operationArgTypeMap[argName].title) {
                    operationArgTypeMap[argName].name = paramObj.name;
                }
                if (!operationArgTypeMap[argName].description) {
                    operationArgTypeMap[argName].description = paramObj.description;
                }
                if (paramObj.required) {
                    operationArgTypeMap[argName].nullable = false;
                }
                if (!('type' in paramObj) &&
                    !paramObj.schema &&
                    !paramObj.content &&
                    !paramObj.example &&
                    !paramObj.examples) {
                    operationArgTypeMap[argName].type = 'string';
                }
            }
            if ('requestBody' in methodObj) {
                const requestBodyObj = methodObj.requestBody;
                if ('content' in requestBodyObj) {
                    const contentKey = Object.keys(requestBodyObj.content)[0];
                    const contentSchema = (_g = requestBodyObj.content[contentKey]) === null || _g === void 0 ? void 0 : _g.schema;
                    if (contentSchema && Object.keys(contentSchema).length > 0) {
                        operationConfig.requestSchema = contentSchema;
                    }
                    const examplesObj = (_h = requestBodyObj.content[contentKey]) === null || _h === void 0 ? void 0 : _h.examples;
                    if (examplesObj) {
                        operationConfig.requestSample = Object.values(examplesObj)[0];
                    }
                    if (!((_j = operationConfig.headers) === null || _j === void 0 ? void 0 : _j['Content-Type']) && typeof contentKey === 'string') {
                        operationConfig.headers = operationConfig.headers || {};
                        operationConfig.headers['Content-Type'] = contentKey;
                    }
                }
            }
            const responseByStatusCode = operationConfig.responseByStatusCode;
            // Handling multiple response types
            for (const responseKey in methodObj.responses) {
                const responseObj = methodObj.responses[responseKey];
                let schemaObj;
                if ('consumes' in methodObj) {
                    operationConfig.headers = operationConfig.headers || {};
                    operationConfig.headers['Content-Type'] = methodObj.consumes.join(', ');
                }
                if ('produces' in methodObj) {
                    operationConfig.headers = operationConfig.headers || {};
                    operationConfig.headers.Accept = methodObj.produces.join(', ');
                }
                if ('content' in responseObj) {
                    const responseObjForStatusCode = {
                        oneOf: [],
                    };
                    let allMimeTypes = [];
                    if (typeof operationHeaders === 'object') {
                        const acceptFromOperationHeader = operationHeaders.accept || operationHeaders.Accept;
                        if (acceptFromOperationHeader) {
                            allMimeTypes = [acceptFromOperationHeader];
                        }
                    }
                    if (allMimeTypes.length === 0) {
                        allMimeTypes = Object.keys(responseObj.content);
                    }
                    const jsonLikeMimeTypes = allMimeTypes.filter(c => c !== '*/*' && c.toString().includes('json'));
                    const mimeTypes = jsonLikeMimeTypes.length > 0 ? jsonLikeMimeTypes : allMimeTypes;
                    // If we have a better accept header, overwrite User's choice
                    if ((!((_k = operationConfig.headers) === null || _k === void 0 ? void 0 : _k.accept) && !((_l = operationConfig.headers) === null || _l === void 0 ? void 0 : _l.Accept)) ||
                        mimeTypes.length === 1) {
                        operationConfig.headers = operationConfig.headers || {};
                        if (operationConfig.headers.Accept) {
                            delete operationConfig.headers.Accept;
                        }
                        operationConfig.headers.accept =
                            jsonLikeMimeTypes.length > 0
                                ? jsonLikeMimeTypes.join(',')
                                : allMimeTypes[0].toString();
                    }
                    for (const contentKey in responseObj.content) {
                        if (!mimeTypes.includes(contentKey)) {
                            continue;
                        }
                        schemaObj = responseObj.content[contentKey].schema;
                        if (schemaObj && Object.keys(schemaObj).length > 0) {
                            responseObjForStatusCode.oneOf.push(schemaObj);
                        }
                        else if (contentKey.toString().startsWith('text')) {
                            responseObjForStatusCode.oneOf.push({ type: 'string' });
                        }
                        else {
                            const examplesObj = responseObj.content[contentKey].examples;
                            if (examplesObj) {
                                let examples = Object.values(examplesObj);
                                if (contentKey.includes('json')) {
                                    examples = examples.map(example => {
                                        if (typeof example === 'string') {
                                            return JSON.parse(example);
                                        }
                                        return example;
                                    });
                                }
                                responseObjForStatusCode.oneOf.push({
                                    examples,
                                });
                            }
                            let example = responseObj.content[contentKey].example;
                            if (example) {
                                if (typeof example === 'string' && contentKey.includes('json')) {
                                    example = JSON.parse(example);
                                }
                                responseObjForStatusCode.oneOf.push({
                                    examples: [example],
                                });
                            }
                        }
                    }
                    if (responseObjForStatusCode.oneOf.length === 1) {
                        responseByStatusCode[responseKey] = responseByStatusCode[responseKey] || {};
                        responseByStatusCode[responseKey].responseSchema = responseObjForStatusCode.oneOf[0];
                    }
                    else if (responseObjForStatusCode.oneOf.length > 1) {
                        responseByStatusCode[responseKey] = responseByStatusCode[responseKey] || {};
                        responseByStatusCode[responseKey].responseSchema = responseObjForStatusCode;
                    }
                }
                else if ('schema' in responseObj) {
                    schemaObj = responseObj.schema;
                    if (schemaObj && Object.keys(schemaObj).length > 0) {
                        responseByStatusCode[responseKey] = responseByStatusCode[responseKey] || {};
                        responseByStatusCode[responseKey].responseSchema = schemaObj;
                    }
                }
                else if ('examples' in responseObj) {
                    const examples = Object.values(responseObj.examples);
                    responseByStatusCode[responseKey] = responseByStatusCode[responseKey] || {};
                    let example = examples[0];
                    if (typeof example === 'string') {
                        try {
                            // Parse if possible
                            example = JSON.parse(example);
                        }
                        catch (e) {
                            // Do nothing
                        }
                    }
                    responseByStatusCode[responseKey].responseSample = example;
                }
                else if (responseKey.toString() === '204') {
                    responseByStatusCode[responseKey] = responseByStatusCode[responseKey] || {};
                    responseByStatusCode[responseKey].responseSchema = {
                        type: 'null',
                        description: responseObj.description,
                    };
                }
                if ('links' in responseObj) {
                    const dereferencedLinkObj = await (0, json_machete_1.dereferenceObject)({
                        links: responseObj.links,
                    }, {
                        cwd,
                        root: oasOrSwagger,
                        fetchFn,
                        logger,
                        headers: schemaHeaders,
                    });
                    responseByStatusCode[responseKey].links = responseByStatusCode[responseKey].links || {};
                    for (const linkName in dereferencedLinkObj.links) {
                        const linkObj = responseObj.links[linkName];
                        let args;
                        if (linkObj.parameters) {
                            args = {};
                            for (const parameterName in linkObj.parameters) {
                                const parameterExp = linkObj.parameters[parameterName];
                                const sanitizedParamName = (0, utils_1.sanitizeNameForGraphQL)(parameterName);
                                if (typeof parameterExp === 'string') {
                                    args[sanitizedParamName] = parameterExp.startsWith('$')
                                        ? `{root.${parameterExp}}`
                                        : parameterExp.split('$').join('root.$');
                                }
                                else {
                                    args[sanitizedParamName] = parameterExp;
                                }
                            }
                        }
                        const sanitizedLinkName = (0, utils_1.sanitizeNameForGraphQL)(linkName);
                        if ('operationRef' in linkObj) {
                            const [externalPath, ref] = linkObj.operationRef.split('#');
                            if (externalPath) {
                                logger.debug(`Skipping external operation reference ${linkObj.operationRef}\n Use additionalTypeDefs and additionalResolvers instead.`);
                            }
                            else {
                                const actualOperation = (0, json_machete_1.resolvePath)(ref, oasOrSwagger);
                                responseByStatusCode[responseKey].links[sanitizedLinkName] = {
                                    get fieldName() {
                                        const linkOperationConfig = methodObjFieldMap.get(actualOperation);
                                        return linkOperationConfig.field;
                                    },
                                    args,
                                    description: linkObj.description,
                                };
                            }
                        }
                        else if ('operationId' in linkObj) {
                            responseByStatusCode[responseKey].links[sanitizedLinkName] = {
                                fieldName: (0, utils_1.sanitizeNameForGraphQL)(linkObj.operationId),
                                args,
                                description: linkObj.description,
                            };
                        }
                    }
                }
                if (!operationConfig.field) {
                    methodObj.operationId = (0, utils_js_1.getFieldNameFromPath)(relativePath, method, schemaObj === null || schemaObj === void 0 ? void 0 : schemaObj.$resolvedRef);
                    // Operation ID might not be avaiable so let's generate field name from path and response type schema
                    operationConfig.field = (0, utils_1.sanitizeNameForGraphQL)(methodObj.operationId);
                }
                // Give a better name to the request input object
                if (typeof operationConfig.requestSchema === 'object' &&
                    !operationConfig.requestSchema.title) {
                    operationConfig.requestSchema.title = operationConfig.field + '_request';
                }
            }
            if ('callbacks' in methodObj) {
                for (const callbackKey in methodObj.callbacks) {
                    const callbackObj = methodObj.callbacks[callbackKey];
                    for (const callbackUrlRefKey in callbackObj) {
                        if (callbackUrlRefKey.startsWith('$')) {
                            continue;
                        }
                        const pubsubTopicSuffix = callbackUrlRefKey
                            .split('$request.query')
                            .join('args')
                            .split('$request.body#/')
                            .join('args.')
                            .split('$response.body#/')
                            .join('args.');
                        const callbackOperationConfig = {
                            type: graphql_1.OperationTypeNode.SUBSCRIPTION,
                            field: '',
                            pubsubTopic: '',
                        };
                        const callbackUrlObj = callbackObj[callbackUrlRefKey];
                        for (const method in callbackUrlObj) {
                            const callbackOperation = callbackUrlObj[method];
                            callbackOperationConfig.pubsubTopic = `webhook:${method}:${pubsubTopicSuffix}`;
                            callbackOperationConfig.field = callbackOperation.operationId;
                            callbackOperationConfig.description =
                                callbackOperation.description || callbackOperation.summary;
                            const requestBodyContents = (_m = callbackOperation.requestBody) === null || _m === void 0 ? void 0 : _m.content;
                            if (requestBodyContents) {
                                callbackOperationConfig.responseSchema = requestBodyContents[Object.keys(requestBodyContents)[0]].schema;
                            }
                            const responses = callbackOperation.responses;
                            if (responses) {
                                const response = responses[Object.keys(responses)[0]];
                                if (response) {
                                    const responseContents = response.content;
                                    if (responseContents) {
                                        callbackOperationConfig.requestSchema = responseContents[Object.keys(responseContents)[0]].schema;
                                    }
                                }
                            }
                        }
                        callbackOperationConfig.field =
                            callbackOperationConfig.field || (0, utils_1.sanitizeNameForGraphQL)(callbackKey);
                        operations.push(callbackOperationConfig);
                    }
                }
            }
            if (fieldTypeMap[operationConfig.field]) {
                operationConfig.type = fieldTypeMap[operationConfig.field];
            }
        }
    }
    return {
        operations,
        endpoint,
        cwd,
        fetch: fetchFn,
        schemaHeaders,
        operationHeaders,
    };
}
exports.getJSONSchemaOptionsFromOpenAPIOptions = getJSONSchemaOptionsFromOpenAPIOptions;
