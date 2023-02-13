"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ExampleDirective = exports.OneOfDirective = exports.EnumDirective = exports.StatusCodeTypeNameDirective = exports.processDirectives = exports.processDictionaryDirective = exports.DictionaryDirective = exports.processLinkFieldAnnotations = exports.LinkResolverDirective = exports.LinkDirective = exports.processResponseMetadataAnnotations = exports.ResponseMetadataDirective = exports.GlobalOptionsDirective = exports.HTTPOperationDirective = exports.processScalarType = exports.processTypeScriptAnnotations = exports.TypeScriptDirective = exports.processPubSubOperationAnnotations = exports.PubSubOperationDirective = exports.processRegExpAnnotations = exports.RegExpDirective = exports.processResolveRootFieldAnnotations = exports.ResolveRootFieldDirective = exports.processResolveRootAnnotations = exports.ResolveRootDirective = exports.processDiscriminatorAnnotations = exports.DiscriminatorDirective = exports.processLengthAnnotations = exports.LengthDirective = void 0;
const tslib_1 = require("tslib");
const string_interpolation_1 = require("@graphql-mesh/string-interpolation");
const utils_1 = require("@graphql-tools/utils");
const graphql_1 = require("graphql");
const lodash_set_1 = tslib_1.__importDefault(require("lodash.set"));
const addRootFieldResolver_js_1 = require("./addRootFieldResolver.js");
const getTypeResolverFromOutputTCs_js_1 = require("./getTypeResolverFromOutputTCs.js");
const scalars_js_1 = require("./scalars.js");
const graphql_scalars_1 = require("graphql-scalars");
exports.LengthDirective = new graphql_1.GraphQLDirective({
    name: 'length',
    locations: [graphql_1.DirectiveLocation.SCALAR],
    args: {
        min: {
            type: graphql_1.GraphQLInt,
        },
        max: {
            type: graphql_1.GraphQLInt,
        },
    },
});
function processLengthAnnotations(scalar, { min: minLength, max: maxLength, }) {
    function coerceString(value) {
        if (value != null) {
            const vStr = value.toString();
            if (typeof minLength !== 'undefined' && vStr.length < minLength) {
                throw new Error(`${scalar.name} cannot be less than ${minLength} but given ${vStr}`);
            }
            if (typeof maxLength !== 'undefined' && vStr.length > maxLength) {
                throw new Error(`${scalar.name} cannot be more than ${maxLength} but given ${vStr}`);
            }
            return vStr;
        }
    }
    scalar.serialize = coerceString;
    scalar.parseValue = coerceString;
    scalar.parseLiteral = ast => {
        if ('value' in ast) {
            return coerceString(ast.value);
        }
        return null;
    };
}
exports.processLengthAnnotations = processLengthAnnotations;
exports.DiscriminatorDirective = new graphql_1.GraphQLDirective({
    name: 'discriminator',
    locations: [graphql_1.DirectiveLocation.INTERFACE, graphql_1.DirectiveLocation.UNION],
    args: {
        field: {
            type: graphql_1.GraphQLString,
        },
    },
});
function processDiscriminatorAnnotations(interfaceType, fieldName) {
    interfaceType.resolveType = root => root[fieldName];
}
exports.processDiscriminatorAnnotations = processDiscriminatorAnnotations;
exports.ResolveRootDirective = new graphql_1.GraphQLDirective({
    name: 'resolveRoot',
    locations: [graphql_1.DirectiveLocation.FIELD_DEFINITION],
});
function processResolveRootAnnotations(field) {
    field.resolve = root => root;
}
exports.processResolveRootAnnotations = processResolveRootAnnotations;
exports.ResolveRootFieldDirective = new graphql_1.GraphQLDirective({
    name: 'resolveRootField',
    locations: [
        graphql_1.DirectiveLocation.FIELD_DEFINITION,
        graphql_1.DirectiveLocation.ARGUMENT_DEFINITION,
        graphql_1.DirectiveLocation.INPUT_FIELD_DEFINITION,
    ],
    args: {
        field: {
            type: graphql_1.GraphQLString,
        },
    },
});
function isOriginallyListType(type) {
    if ((0, graphql_1.isNonNullType)(type)) {
        return isOriginallyListType(type.ofType);
    }
    return (0, graphql_1.isListType)(type);
}
function processResolveRootFieldAnnotations(field, propertyName) {
    if (!field.resolve || field.resolve.name === 'defaultFieldResolver') {
        field.resolve = (root, args, context, info) => {
            const actualFieldObj = root[propertyName];
            if (actualFieldObj != null) {
                const isArray = Array.isArray(actualFieldObj);
                const isListType = isOriginallyListType(info.returnType);
                if (isListType && !isArray) {
                    return [actualFieldObj];
                }
                else if (!isListType && isArray) {
                    return actualFieldObj[0];
                }
            }
            return actualFieldObj;
        };
    }
}
exports.processResolveRootFieldAnnotations = processResolveRootFieldAnnotations;
exports.RegExpDirective = new graphql_1.GraphQLDirective({
    name: 'regexp',
    locations: [graphql_1.DirectiveLocation.SCALAR],
    args: {
        pattern: {
            type: graphql_1.GraphQLString,
        },
    },
});
function processRegExpAnnotations(scalar, pattern) {
    function coerceString(value) {
        if (value != null) {
            const vStr = value.toString();
            const regexp = new RegExp(pattern);
            if (!regexp.test(vStr)) {
                throw new Error(`${scalar.name} must match ${pattern} but given ${vStr}`);
            }
            return vStr;
        }
    }
    scalar.serialize = coerceString;
    scalar.parseValue = coerceString;
    scalar.parseLiteral = ast => {
        if ('value' in ast) {
            return coerceString(ast.value);
        }
        return null;
    };
}
exports.processRegExpAnnotations = processRegExpAnnotations;
exports.PubSubOperationDirective = new graphql_1.GraphQLDirective({
    name: 'pubsubOperation',
    locations: [graphql_1.DirectiveLocation.FIELD_DEFINITION],
    args: {
        pubsubTopic: {
            type: graphql_1.GraphQLString,
        },
    },
});
function processPubSubOperationAnnotations({ field, globalPubsub, pubsubTopic, logger, }) {
    field.subscribe = (root, args, context, info) => {
        const operationLogger = logger.child(`${info.parentType.name}.${field.name}`);
        const pubsub = (context === null || context === void 0 ? void 0 : context.pubsub) || globalPubsub;
        if (!pubsub) {
            return (0, utils_1.createGraphQLError)(`You should have PubSub defined in either the config or the context!`);
        }
        const interpolationData = { root, args, context, info, env: process.env };
        let interpolatedPubSubTopic = string_interpolation_1.stringInterpolator.parse(pubsubTopic, interpolationData);
        if (interpolatedPubSubTopic.startsWith('webhook:')) {
            const [, expectedMethod, expectedUrl] = interpolatedPubSubTopic.split(':');
            const expectedPath = new URL(expectedUrl, 'http://localhost').pathname;
            interpolatedPubSubTopic = `webhook:${expectedMethod}:${expectedPath}`;
        }
        operationLogger.debug(`=> Subscribing to pubSubTopic: ${interpolatedPubSubTopic}`);
        return pubsub.asyncIterator(interpolatedPubSubTopic);
    };
    field.resolve = (root, args, context, info) => {
        const operationLogger = logger.child(`${info.parentType.name}.${field.name}`);
        operationLogger.debug('Received ', root, ' from ', pubsubTopic);
        return root;
    };
}
exports.processPubSubOperationAnnotations = processPubSubOperationAnnotations;
exports.TypeScriptDirective = new graphql_1.GraphQLDirective({
    name: 'typescript',
    locations: [graphql_1.DirectiveLocation.SCALAR, graphql_1.DirectiveLocation.ENUM],
    args: {
        type: {
            type: graphql_1.GraphQLString,
        },
    },
});
function processTypeScriptAnnotations(type, typeDefinition) {
    type.extensions = type.extensions || {};
    type.extensions.codegenScalarType = typeDefinition;
}
exports.processTypeScriptAnnotations = processTypeScriptAnnotations;
function addExecutionLogicToScalar(nonExecutableScalar, actualScalar) {
    Object.defineProperties(nonExecutableScalar, {
        serialize: {
            value: actualScalar.serialize,
        },
        parseValue: {
            value: actualScalar.parseValue,
        },
        parseLiteral: {
            value: actualScalar.parseLiteral,
        },
        extensions: {
            value: {
                ...actualScalar.extensions,
                ...nonExecutableScalar.extensions,
            },
        },
    });
}
function processScalarType(schema, type) {
    if (type.name in graphql_scalars_1.resolvers) {
        const actualScalar = graphql_scalars_1.resolvers[type.name];
        addExecutionLogicToScalar(type, actualScalar);
    }
    if (type.name === 'ObjMap') {
        addExecutionLogicToScalar(type, scalars_js_1.ObjMapScalar);
    }
    const directiveAnnotations = (0, utils_1.getDirectives)(schema, type);
    for (const directiveAnnotation of directiveAnnotations) {
        switch (directiveAnnotation.name) {
            case 'length':
                processLengthAnnotations(type, directiveAnnotation.args);
                break;
            case 'regexp':
                processRegExpAnnotations(type, directiveAnnotation.args.pattern);
                break;
            case 'typescript':
                processTypeScriptAnnotations(type, directiveAnnotation.args.type);
                break;
        }
    }
}
exports.processScalarType = processScalarType;
exports.HTTPOperationDirective = new graphql_1.GraphQLDirective({
    name: 'httpOperation',
    locations: [graphql_1.DirectiveLocation.FIELD_DEFINITION],
    args: {
        path: {
            type: graphql_1.GraphQLString,
        },
        operationSpecificHeaders: {
            type: scalars_js_1.ObjMapScalar,
        },
        httpMethod: {
            type: new graphql_1.GraphQLEnumType({
                name: 'HTTPMethod',
                values: {
                    GET: { value: 'GET' },
                    HEAD: { value: 'HEAD' },
                    POST: { value: 'POST' },
                    PUT: { value: 'PUT' },
                    DELETE: { value: 'DELETE' },
                    CONNECT: { value: 'CONNECT' },
                    OPTIONS: { value: 'OPTIONS' },
                    TRACE: { value: 'TRACE' },
                    PATCH: { value: 'PATCH' },
                },
            }),
        },
        isBinary: {
            type: graphql_1.GraphQLBoolean,
        },
        requestBaseBody: {
            type: scalars_js_1.ObjMapScalar,
        },
        queryParamArgMap: {
            type: scalars_js_1.ObjMapScalar,
        },
        queryStringOptionsByParam: {
            type: scalars_js_1.ObjMapScalar,
        },
    },
});
exports.GlobalOptionsDirective = new graphql_1.GraphQLDirective({
    name: 'globalOptions',
    locations: [graphql_1.DirectiveLocation.OBJECT],
    args: {
        sourceName: {
            type: graphql_1.GraphQLString,
        },
        endpoint: {
            type: graphql_1.GraphQLString,
        },
        operationHeaders: {
            type: scalars_js_1.ObjMapScalar,
        },
        queryStringOptions: {
            type: scalars_js_1.ObjMapScalar,
        },
        queryParams: {
            type: scalars_js_1.ObjMapScalar,
        },
    },
});
exports.ResponseMetadataDirective = new graphql_1.GraphQLDirective({
    name: 'responseMetadata',
    locations: [graphql_1.DirectiveLocation.FIELD_DEFINITION],
});
function processResponseMetadataAnnotations(field) {
    field.resolve = function responseMetadataResolver(root) {
        return {
            url: root.$url,
            headers: root.$response.header,
            method: root.$method,
            status: root.$statusCode,
            statusText: root.$statusText,
            body: root.$response.body,
        };
    };
}
exports.processResponseMetadataAnnotations = processResponseMetadataAnnotations;
exports.LinkDirective = new graphql_1.GraphQLDirective({
    name: 'link',
    locations: [graphql_1.DirectiveLocation.FIELD_DEFINITION],
    args: {
        defaultRootType: {
            type: graphql_1.GraphQLString,
        },
        defaultField: {
            type: graphql_1.GraphQLString,
        },
    },
});
exports.LinkResolverDirective = new graphql_1.GraphQLDirective({
    name: 'linkResolver',
    locations: [graphql_1.DirectiveLocation.FIELD_DEFINITION],
    args: {
        linkResolverMap: {
            type: scalars_js_1.ObjMapScalar,
        },
    },
});
function linkResolver({ linkObjArgs, targetTypeName, targetFieldName }, { root, args, context, info, env }) {
    for (const argKey in linkObjArgs) {
        const argInterpolation = linkObjArgs[argKey];
        const actualValue = typeof argInterpolation === 'string'
            ? string_interpolation_1.stringInterpolator.parse(argInterpolation, {
                root,
                args,
                context,
                info,
                env,
            })
            : argInterpolation;
        (0, lodash_set_1.default)(args, argKey, actualValue);
    }
    const type = info.schema.getType(targetTypeName);
    const field = type.getFields()[targetFieldName];
    return field.resolve(root, args, context, info);
}
function getLinkResolverMap(schema, field) {
    const parentFieldLinkResolverDirectives = (0, utils_1.getDirective)(schema, field, 'linkResolver');
    if (parentFieldLinkResolverDirectives === null || parentFieldLinkResolverDirectives === void 0 ? void 0 : parentFieldLinkResolverDirectives.length) {
        const linkResolverMap = parentFieldLinkResolverDirectives[0].linkResolverMap;
        if (linkResolverMap) {
            return linkResolverMap;
        }
    }
}
function findLinkResolverMap({ schema, operationType, defaultRootTypeName, defaultFieldName, }) {
    const parentType = schema.getRootType(operationType);
    const parentField = parentType.getFields()[operationType];
    if (parentField) {
        const linkResolverMap = getLinkResolverMap(schema, parentField);
        if (linkResolverMap) {
            return linkResolverMap;
        }
    }
    const defaultRootType = schema.getType(defaultRootTypeName);
    if (defaultRootType) {
        const defaultField = defaultRootType.getFields()[defaultFieldName];
        if (defaultField) {
            const linkResolverMap = getLinkResolverMap(schema, defaultField);
            if (linkResolverMap) {
                return linkResolverMap;
            }
        }
    }
}
function processLinkFieldAnnotations(field, defaultRootTypeName, defaultFieldName) {
    field.resolve = (root, args, context, info) => {
        const linkResolverMap = findLinkResolverMap({
            schema: info.schema,
            defaultRootTypeName,
            defaultFieldName,
            parentFieldName: root.$field,
            operationType: info.operation.operation,
        });
        const linkResolverOpts = linkResolverMap[field.name];
        return linkResolver(linkResolverOpts, { root, args, context, info, env: process.env });
    };
}
exports.processLinkFieldAnnotations = processLinkFieldAnnotations;
exports.DictionaryDirective = new graphql_1.GraphQLDirective({
    name: 'dictionary',
    locations: [graphql_1.DirectiveLocation.FIELD_DEFINITION],
});
function processDictionaryDirective(fieldMap, field) {
    field.resolve = root => {
        const result = [];
        for (const key in root) {
            if (key in fieldMap) {
                continue;
            }
            result.push({
                key,
                value: root[key],
            });
        }
        return result;
    };
}
exports.processDictionaryDirective = processDictionaryDirective;
function processDirectives({ schema, globalFetch, logger, pubsub, ...extraGlobalOptions }) {
    const nonExecutableObjMapScalar = schema.getType('ObjMap');
    if (nonExecutableObjMapScalar && (0, graphql_1.isScalarType)(nonExecutableObjMapScalar)) {
        addExecutionLogicToScalar(nonExecutableObjMapScalar, scalars_js_1.ObjMapScalar);
    }
    let [globalOptions = {}] = ((0, utils_1.getDirective)(schema, schema.getQueryType(), 'globalOptions') ||
        []);
    globalOptions = {
        ...globalOptions,
        ...extraGlobalOptions,
    };
    const typeMap = schema.getTypeMap();
    for (const typeName in typeMap) {
        const type = typeMap[typeName];
        const exampleAnnotations = (0, utils_1.getDirective)(schema, type, 'example');
        if (exampleAnnotations === null || exampleAnnotations === void 0 ? void 0 : exampleAnnotations.length) {
            const examples = [];
            for (const exampleAnnotation of exampleAnnotations) {
                if (exampleAnnotation === null || exampleAnnotation === void 0 ? void 0 : exampleAnnotation.value) {
                    examples.push(exampleAnnotation.value);
                }
            }
            type.extensions = type.extensions || {};
            type.extensions.examples = examples;
        }
        if ((0, graphql_1.isScalarType)(type)) {
            processScalarType(schema, type);
        }
        if ((0, graphql_1.isInterfaceType)(type)) {
            const directiveAnnotations = (0, utils_1.getDirectives)(schema, type);
            for (const directiveAnnotation of directiveAnnotations) {
                switch (directiveAnnotation.name) {
                    case 'discriminator':
                        processDiscriminatorAnnotations(type, directiveAnnotation.args.field);
                        break;
                }
            }
        }
        if ((0, graphql_1.isUnionType)(type)) {
            const directiveAnnotations = (0, utils_1.getDirectives)(schema, type);
            let statusCodeTypeNameIndexMap;
            let discriminatorField;
            for (const directiveAnnotation of directiveAnnotations) {
                switch (directiveAnnotation.name) {
                    case 'statusCodeTypeName':
                        statusCodeTypeNameIndexMap = statusCodeTypeNameIndexMap || {};
                        statusCodeTypeNameIndexMap[directiveAnnotation.args.statusCode] =
                            directiveAnnotation.args.typeName;
                        break;
                    case 'discriminator':
                        discriminatorField = directiveAnnotation.args.field;
                        break;
                }
            }
            type.resolveType = (0, getTypeResolverFromOutputTCs_js_1.getTypeResolverFromOutputTCs)(type.getTypes(), discriminatorField, statusCodeTypeNameIndexMap);
        }
        if ((0, graphql_1.isEnumType)(type)) {
            const directiveAnnotations = (0, utils_1.getDirectives)(schema, type);
            for (const directiveAnnotation of directiveAnnotations) {
                switch (directiveAnnotation.name) {
                    case 'typescript':
                        processTypeScriptAnnotations(type, directiveAnnotation.args.type);
                        break;
                }
            }
            const enumValues = type.getValues();
            for (const enumValue of enumValues) {
                const directiveAnnotations = (0, utils_1.getDirectives)(schema, enumValue);
                for (const directiveAnnotation of directiveAnnotations) {
                    switch (directiveAnnotation.name) {
                        case 'enum': {
                            const realValue = JSON.parse(directiveAnnotation.args.value);
                            enumValue.value = realValue;
                            type._valueLookup.set(realValue, enumValue);
                            break;
                        }
                    }
                }
            }
        }
        if ('getFields' in type) {
            const fields = type.getFields();
            for (const fieldName in fields) {
                const field = fields[fieldName];
                const directiveAnnotations = (0, utils_1.getDirectives)(schema, field);
                for (const directiveAnnotation of directiveAnnotations) {
                    switch (directiveAnnotation.name) {
                        case 'resolveRoot':
                            processResolveRootAnnotations(field);
                            break;
                        case 'resolveRootField':
                            processResolveRootFieldAnnotations(field, directiveAnnotation.args.field);
                            break;
                        case 'pubsubOperation':
                            processPubSubOperationAnnotations({
                                field: field,
                                pubsubTopic: directiveAnnotation.args.pubsubTopic,
                                globalPubsub: pubsub,
                                logger,
                            });
                            break;
                        case 'httpOperation':
                            (0, addRootFieldResolver_js_1.addHTTPRootFieldResolver)(schema, field, logger, globalFetch, directiveAnnotation.args, globalOptions);
                            break;
                        case 'responseMetadata':
                            processResponseMetadataAnnotations(field);
                            break;
                        case 'link':
                            processLinkFieldAnnotations(field, directiveAnnotation.args.defaultRootType, directiveAnnotation.args.defaultField);
                            break;
                        case 'dictionary':
                            processDictionaryDirective(fields, field);
                    }
                }
            }
        }
    }
    return schema;
}
exports.processDirectives = processDirectives;
exports.StatusCodeTypeNameDirective = new graphql_1.GraphQLDirective({
    name: 'statusCodeTypeName',
    locations: [graphql_1.DirectiveLocation.UNION],
    isRepeatable: true,
    args: {
        typeName: {
            type: graphql_1.GraphQLString,
        },
        statusCode: {
            type: graphql_1.GraphQLID,
        },
    },
});
exports.EnumDirective = new graphql_1.GraphQLDirective({
    name: 'enum',
    locations: [graphql_1.DirectiveLocation.ENUM_VALUE],
    args: {
        value: {
            type: graphql_1.GraphQLString,
        },
    },
});
exports.OneOfDirective = new graphql_1.GraphQLDirective({
    name: 'oneOf',
    locations: [graphql_1.DirectiveLocation.OBJECT, graphql_1.DirectiveLocation.INTERFACE],
});
exports.ExampleDirective = new graphql_1.GraphQLDirective({
    name: 'example',
    locations: [
        graphql_1.DirectiveLocation.FIELD_DEFINITION,
        graphql_1.DirectiveLocation.OBJECT,
        graphql_1.DirectiveLocation.INPUT_OBJECT,
        graphql_1.DirectiveLocation.ENUM,
        graphql_1.DirectiveLocation.SCALAR,
    ],
    args: {
        value: {
            type: scalars_js_1.ObjMapScalar,
        },
    },
    isRepeatable: true,
});
