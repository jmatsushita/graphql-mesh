import { execute, isListType, isNonNullType, } from 'graphql';
import { XMLParser, XMLBuilder as JSONToXMLConverter } from 'fast-xml-parser';
import { PARSE_XML_OPTIONS } from './utils.js';
import { getDirective, getRootTypes } from '@graphql-tools/utils';
function isOriginallyListType(type) {
    if (isNonNullType(type)) {
        return isOriginallyListType(type.ofType);
    }
    return isListType(type);
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
    const jsonToXMLConverter = new JSONToXMLConverter({
        attributeNamePrefix: '',
        attributesGroupName: 'attributes',
        textNodeName: 'innerText',
    });
    const xmlToJSONConverter = new XMLParser(PARSE_XML_OPTIONS);
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
        const responseJSON = xmlToJSONConverter.parse(responseXML, PARSE_XML_OPTIONS);
        return normalizeResult(responseJSON.Envelope[0].Body[0][soapAnnotations.elementName]);
    };
}
function createRootValue(schema, fetchFn) {
    const rootValue = {};
    const rootTypes = getRootTypes(schema);
    for (const rootType of rootTypes) {
        const rootFieldMap = rootType.getFields();
        for (const fieldName in rootFieldMap) {
            const annotations = getDirective(schema, rootFieldMap[fieldName], 'soap');
            const soapAnnotations = Object.assign({}, ...annotations);
            rootValue[fieldName] = createRootValueMethod(soapAnnotations, fetchFn);
        }
    }
    return rootValue;
}
export function createExecutorFromSchemaAST(schema, fetchFn) {
    let rootValue;
    return function soapExecutor({ document, variables, context }) {
        if (!rootValue) {
            rootValue = createRootValue(schema, fetchFn);
        }
        return execute({
            schema,
            document,
            rootValue,
            contextValue: context,
            variableValues: variables,
            fieldResolver: defaultFieldResolver,
        });
    };
}
