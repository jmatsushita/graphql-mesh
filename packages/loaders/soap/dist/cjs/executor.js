"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createExecutorFromSchemaAST = void 0;
const graphql_1 = require("graphql");
const fast_xml_parser_1 = require("fast-xml-parser");
const utils_js_1 = require("./utils.js");
const utils_1 = require("@graphql-tools/utils");
function isOriginallyListType(type) {
    if ((0, graphql_1.isNonNullType)(type)) {
        return isOriginallyListType(type.ofType);
    }
    return (0, graphql_1.isListType)(type);
}
const defaultFieldResolver = function soapDefaultResolver(root, args, context, info) {
    const rootField = root[info.fieldName];
    if (typeof rootField === 'function') {
        return rootField(args, context, info);
    }
    const fieldValue = rootField;
    const isArray = Array.isArray(fieldValue);
    const isPlural = isOriginallyListType(info.returnType);
    if (isPlural && !isArray) {
        return [fieldValue];
    }
    if (!isPlural && isArray) {
        return fieldValue[0];
    }
    return fieldValue;
};
function normalizeArgsForConverter(args) {
    if (args != null) {
        if (typeof args === 'object') {
            for (const key in args) {
                args[key] = normalizeArgsForConverter(args[key]);
            }
        }
        else {
            return {
                innerText: args,
            };
        }
    }
    return args;
}
function normalizeResult(result) {
    if (result != null && typeof result === 'object') {
        for (const key in result) {
            if (key === 'innerText') {
                return result.innerText;
            }
            result[key] = normalizeResult(result[key]);
        }
        if (Array.isArray(result) && result.length === 1) {
            return result[0];
        }
    }
    return result;
}
function createRootValueMethod(soapAnnotations, fetchFn) {
    const jsonToXMLConverter = new fast_xml_parser_1.XMLBuilder({
        attributeNamePrefix: '',
        attributesGroupName: 'attributes',
        textNodeName: 'innerText',
    });
    const xmlToJSONConverter = new fast_xml_parser_1.XMLParser(utils_js_1.PARSE_XML_OPTIONS);
    return async function rootValueMethod(args, context, info) {
        const requestJson = {
            'soap:Envelope': {
                attributes: {
                    'xmlns:soap': 'http://www.w3.org/2003/05/soap-envelope',
                },
                'soap:Body': {
                    attributes: {
                        xmlns: soapAnnotations.bindingNamespace,
                    },
                    ...normalizeArgsForConverter(args),
                },
            },
        };
        const requestXML = jsonToXMLConverter.build(requestJson);
        const response = await fetchFn(soapAnnotations.endpoint, {
            method: 'POST',
            body: requestXML,
            headers: {
                'Content-Type': 'application/soap+xml; charset=utf-8',
            },
        }, context, info);
        const responseXML = await response.text();
        const responseJSON = xmlToJSONConverter.parse(responseXML, utils_js_1.PARSE_XML_OPTIONS);
        return normalizeResult(responseJSON.Envelope[0].Body[0][soapAnnotations.elementName]);
    };
}
function createRootValue(schema, fetchFn) {
    const rootValue = {};
    const rootTypes = (0, utils_1.getRootTypes)(schema);
    for (const rootType of rootTypes) {
        const rootFieldMap = rootType.getFields();
        for (const fieldName in rootFieldMap) {
            const annotations = (0, utils_1.getDirective)(schema, rootFieldMap[fieldName], 'soap');
            const soapAnnotations = Object.assign({}, ...annotations);
            rootValue[fieldName] = createRootValueMethod(soapAnnotations, fetchFn);
        }
    }
    return rootValue;
}
function createExecutorFromSchemaAST(schema, fetchFn) {
    let rootValue;
    return function soapExecutor({ document, variables, context }) {
        if (!rootValue) {
            rootValue = createRootValue(schema, fetchFn);
        }
        return (0, graphql_1.execute)({
            schema,
            document,
            rootValue,
            contextValue: context,
            variableValues: variables,
            fieldResolver: defaultFieldResolver,
        });
    };
}
exports.createExecutorFromSchemaAST = createExecutorFromSchemaAST;
