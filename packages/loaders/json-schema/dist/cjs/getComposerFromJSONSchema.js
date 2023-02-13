"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getComposerFromJSONSchema = void 0;
/* eslint-disable no-case-declarations */
const graphql_1 = require("graphql");
const graphql_compose_1 = require("graphql-compose");
const graphql_scalars_1 = require("graphql-scalars");
const json_machete_1 = require("json-machete");
const utils_1 = require("@graphql-mesh/utils");
const directives_js_1 = require("./directives.js");
const getJSONSchemaStringFormatScalarMap_js_1 = require("./getJSONSchemaStringFormatScalarMap.js");
const getUnionTypeComposers_js_1 = require("./getUnionTypeComposers.js");
const getValidTypeName_js_1 = require("./getValidTypeName.js");
const scalars_js_1 = require("./scalars.js");
function getComposerFromJSONSchema(schema, logger) {
    const schemaComposer = new graphql_compose_1.SchemaComposer();
    const formatScalarMap = (0, getJSONSchemaStringFormatScalarMap_js_1.getJSONSchemaStringFormatScalarMap)();
    const rootInputTypeNameComposerMap = {
        QueryInput: () => schemaComposer.Query,
        MutationInput: () => schemaComposer.Mutation,
        SubscriptionInput: () => schemaComposer.Subscription,
    };
    return (0, json_machete_1.visitJSONSchema)(schema, {
        enter(subSchema, { path, visitedSubschemaResultMap }) {
            var _a, _b, _c, _d, _e, _f;
            if (typeof subSchema === 'boolean' || subSchema.title === 'Any') {
                const typeComposer = schemaComposer.getAnyTC(graphql_scalars_1.GraphQLJSON);
                return subSchema
                    ? {
                        input: typeComposer,
                        output: typeComposer,
                    }
                    : undefined;
            }
            if (!subSchema) {
                throw new Error(`Something is wrong with ${path}`);
            }
            if (subSchema.type === 'array') {
                if (subSchema.items != null &&
                    typeof subSchema.items === 'object' &&
                    Object.keys(subSchema.items).length > 0) {
                    return {
                        // These are filled after enter
                        get input() {
                            const typeComposers = visitedSubschemaResultMap.get(subSchema.items);
                            return typeComposers.input.getTypePlural();
                        },
                        get output() {
                            const typeComposers = visitedSubschemaResultMap.get(subSchema.items);
                            return typeComposers.output.getTypePlural();
                        },
                        ...subSchema,
                    };
                }
                if (subSchema.contains) {
                    // Scalars cannot be in union type
                    const typeComposer = schemaComposer.getAnyTC(graphql_scalars_1.GraphQLJSON).getTypePlural();
                    return {
                        input: typeComposer,
                        output: typeComposer,
                        nullable: subSchema.nullable,
                        readOnly: subSchema.readOnly,
                        writeOnly: subSchema.writeOnly,
                        default: subSchema.default,
                    };
                }
                // If it doesn't have any clue
                {
                    // const typeComposer = getGenericJSONScalar({
                    //   schemaComposer,
                    //   isInput: false,
                    //   subSchema,
                    //   validateWithJSONSchema,
                    // }).getTypePlural();
                    const typeComposer = schemaComposer.getAnyTC(graphql_scalars_1.GraphQLJSON).getTypePlural();
                    return {
                        input: typeComposer,
                        output: typeComposer,
                        description: subSchema.description,
                        nullable: subSchema.nullable,
                        readOnly: subSchema.readOnly,
                        writeOnly: subSchema.writeOnly,
                        default: subSchema.default,
                    };
                }
            }
            if (subSchema.pattern) {
                let typeScriptType;
                switch (subSchema.type) {
                    case 'number':
                        typeScriptType = 'number';
                        break;
                    case 'integer':
                        if (subSchema.format === 'int64') {
                            typeScriptType = 'bigint';
                        }
                        else {
                            typeScriptType = 'number';
                        }
                        break;
                    default:
                        typeScriptType = 'string';
                        break;
                }
                schemaComposer.addDirective(directives_js_1.RegExpDirective);
                schemaComposer.addDirective(directives_js_1.TypeScriptDirective);
                const typeComposer = schemaComposer.createScalarTC({
                    name: (0, getValidTypeName_js_1.getValidTypeName)({
                        schemaComposer,
                        isInput: false,
                        subSchema,
                    }),
                    directives: [
                        {
                            name: 'regexp',
                            args: {
                                pattern: subSchema.pattern,
                            },
                        },
                        {
                            name: 'typescript',
                            args: {
                                type: typeScriptType,
                            },
                        },
                    ],
                });
                return {
                    input: typeComposer,
                    output: typeComposer,
                    nullable: subSchema.nullable,
                    readOnly: subSchema.readOnly,
                    writeOnly: subSchema.writeOnly,
                };
            }
            if (subSchema.const) {
                const scalarTypeName = (0, getValidTypeName_js_1.getValidTypeName)({
                    schemaComposer,
                    isInput: false,
                    subSchema,
                });
                schemaComposer.addDirective(directives_js_1.EnumDirective);
                schemaComposer.addDirective(directives_js_1.TypeScriptDirective);
                schemaComposer.addDirective(directives_js_1.ExampleDirective);
                const typeComposer = schemaComposer.createEnumTC({
                    name: scalarTypeName,
                    values: {
                        [(0, utils_1.sanitizeNameForGraphQL)(subSchema.const.toString())]: {
                            directives: [
                                {
                                    name: 'enum',
                                    args: {
                                        value: JSON.stringify(subSchema.const),
                                    },
                                },
                            ],
                        },
                    },
                    directives: [
                        {
                            name: 'typescript',
                            args: {
                                type: JSON.stringify(subSchema.const),
                            },
                        },
                        {
                            name: 'example',
                            args: {
                                value: subSchema.const,
                            },
                        },
                    ],
                    extensions: {
                        default: subSchema.const,
                    },
                });
                return {
                    input: typeComposer,
                    output: typeComposer,
                    nullable: subSchema.nullable,
                    readOnly: subSchema.readOnly,
                    writeOnly: subSchema.writeOnly,
                };
            }
            if (subSchema.enum && subSchema.type !== 'boolean') {
                const values = {};
                for (const value of subSchema.enum) {
                    let enumKey = (0, utils_1.sanitizeNameForGraphQL)(value.toString());
                    if (enumKey === 'false' || enumKey === 'true' || enumKey === 'null') {
                        enumKey = enumKey.toUpperCase();
                    }
                    if (typeof enumKey === 'string' && enumKey.length === 0) {
                        enumKey = '_';
                    }
                    schemaComposer.addDirective(directives_js_1.EnumDirective);
                    // Falsy values are ignored by GraphQL
                    // eslint-disable-next-line no-unneeded-ternary
                    const enumValue = value ? value : value === null || value === void 0 ? void 0 : value.toString();
                    const directives = [];
                    if (enumValue !== enumKey) {
                        directives.push({
                            name: 'enum',
                            args: {
                                value: JSON.stringify(enumValue),
                            },
                        });
                    }
                    values[enumKey] = {
                        directives,
                        value: enumValue,
                    };
                }
                const directives = [];
                if ((_a = subSchema.examples) === null || _a === void 0 ? void 0 : _a.length) {
                    schemaComposer.addDirective(directives_js_1.ExampleDirective);
                    for (const example of subSchema.examples) {
                        directives.push({
                            name: 'example',
                            args: {
                                value: example,
                            },
                        });
                    }
                }
                const typeComposer = schemaComposer.createEnumTC({
                    name: (0, getValidTypeName_js_1.getValidTypeName)({
                        schemaComposer,
                        isInput: false,
                        subSchema,
                    }),
                    values,
                    description: subSchema.description,
                    directives,
                    extensions: {
                        default: subSchema.default,
                    },
                });
                return {
                    input: typeComposer,
                    output: typeComposer,
                    nullable: subSchema.nullable,
                    readOnly: subSchema.readOnly,
                    writeOnly: subSchema.writeOnly,
                    default: subSchema.default,
                };
            }
            if (Array.isArray(subSchema.type)) {
                const validTypes = subSchema.type.filter((typeName) => typeName !== 'null');
                if (validTypes.length === 1) {
                    subSchema.type = validTypes[0];
                    // continue with the single type
                }
                else {
                    const typeComposer = schemaComposer.getAnyTC(graphql_scalars_1.GraphQLJSON);
                    return {
                        input: typeComposer,
                        output: typeComposer,
                        nullable: subSchema.nullable,
                        readOnly: subSchema.readOnly,
                        writeOnly: subSchema.writeOnly,
                        default: subSchema.default,
                    };
                }
            }
            if (subSchema.format) {
                switch (subSchema.format) {
                    case 'byte': {
                        const typeComposer = schemaComposer.getAnyTC(graphql_scalars_1.GraphQLByte);
                        return {
                            input: typeComposer,
                            output: typeComposer,
                            description: subSchema.description,
                            nullable: subSchema.nullable,
                            default: subSchema.default,
                        };
                    }
                    case 'binary': {
                        const typeComposer = schemaComposer.getAnyTC(scalars_js_1.GraphQLFile);
                        return {
                            input: typeComposer,
                            output: typeComposer,
                            description: subSchema.description,
                            nullable: subSchema.nullable,
                            default: subSchema.default,
                        };
                    }
                    case 'date-time': {
                        const typeComposer = schemaComposer.getAnyTC(graphql_scalars_1.GraphQLDateTime);
                        return {
                            input: typeComposer,
                            output: typeComposer,
                            description: subSchema.description,
                            nullable: subSchema.nullable,
                            readOnly: subSchema.readOnly,
                            writeOnly: subSchema.writeOnly,
                            default: subSchema.default,
                        };
                    }
                    case 'time': {
                        const typeComposer = schemaComposer.getAnyTC(graphql_scalars_1.GraphQLTime);
                        return {
                            input: typeComposer,
                            output: typeComposer,
                            description: subSchema.description,
                            nullable: subSchema.nullable,
                            readOnly: subSchema.readOnly,
                            writeOnly: subSchema.writeOnly,
                            default: subSchema.default,
                        };
                    }
                    case 'email': {
                        const typeComposer = schemaComposer.getAnyTC(graphql_scalars_1.GraphQLEmailAddress);
                        return {
                            input: typeComposer,
                            output: typeComposer,
                            description: subSchema.description,
                            nullable: subSchema.nullable,
                            readOnly: subSchema.readOnly,
                            writeOnly: subSchema.writeOnly,
                            default: subSchema.default,
                        };
                    }
                    case 'ipv4': {
                        const typeComposer = schemaComposer.getAnyTC(graphql_scalars_1.GraphQLIPv4);
                        return {
                            input: typeComposer,
                            output: typeComposer,
                            description: subSchema.description,
                            nullable: subSchema.nullable,
                            readOnly: subSchema.readOnly,
                            writeOnly: subSchema.writeOnly,
                            default: subSchema.default,
                        };
                    }
                    case 'ipv6': {
                        const typeComposer = schemaComposer.getAnyTC(graphql_scalars_1.GraphQLIPv6);
                        return {
                            input: typeComposer,
                            output: typeComposer,
                            description: subSchema.description,
                            nullable: subSchema.nullable,
                            readOnly: subSchema.readOnly,
                            writeOnly: subSchema.writeOnly,
                            default: subSchema.default,
                        };
                    }
                    case 'uri': {
                        const typeComposer = schemaComposer.getAnyTC(graphql_scalars_1.GraphQLURL);
                        return {
                            input: typeComposer,
                            output: typeComposer,
                            description: subSchema.description,
                            nullable: subSchema.nullable,
                            readOnly: subSchema.readOnly,
                            writeOnly: subSchema.writeOnly,
                            default: subSchema.default,
                        };
                    }
                    case 'uuid': {
                        const typeComposer = schemaComposer.getAnyTC(graphql_scalars_1.GraphQLUUID);
                        return {
                            input: typeComposer,
                            output: typeComposer,
                            description: subSchema.description,
                            nullable: subSchema.nullable,
                            readOnly: subSchema.readOnly,
                            writeOnly: subSchema.writeOnly,
                            default: subSchema.default,
                        };
                    }
                    case 'unix-time': {
                        const typeComposer = schemaComposer.createScalarTC(graphql_scalars_1.GraphQLTimestamp);
                        return {
                            input: typeComposer,
                            output: typeComposer,
                            description: subSchema.description,
                            nullable: subSchema.nullable,
                            readOnly: subSchema.readOnly,
                            writeOnly: subSchema.writeOnly,
                            default: subSchema.default,
                        };
                    }
                    case 'int64': {
                        const typeComposer = schemaComposer.createScalarTC(graphql_scalars_1.GraphQLBigInt);
                        return {
                            input: typeComposer,
                            output: typeComposer,
                            description: subSchema.description,
                            nullable: subSchema.nullable,
                            readOnly: subSchema.readOnly,
                            writeOnly: subSchema.writeOnly,
                            default: subSchema.default,
                        };
                    }
                    case 'int32': {
                        const typeComposer = schemaComposer.createScalarTC(graphql_1.GraphQLInt);
                        return {
                            input: typeComposer,
                            output: typeComposer,
                            description: subSchema.description,
                            nullable: subSchema.nullable,
                            readOnly: subSchema.readOnly,
                            writeOnly: subSchema.writeOnly,
                            default: subSchema.default,
                        };
                    }
                    case 'decimal':
                    case 'float': {
                        const typeComposer = schemaComposer.createScalarTC(graphql_1.GraphQLFloat);
                        return {
                            input: typeComposer,
                            output: typeComposer,
                            description: subSchema.description,
                            nullable: subSchema.nullable,
                            readOnly: subSchema.readOnly,
                            writeOnly: subSchema.writeOnly,
                            default: subSchema.default,
                        };
                    }
                    default: {
                        const formatScalar = formatScalarMap.get(subSchema.format);
                        if (formatScalar) {
                            const typeComposer = schemaComposer.getAnyTC(formatScalar);
                            return {
                                input: typeComposer,
                                output: typeComposer,
                                description: subSchema.description,
                                nullable: subSchema.nullable,
                                readOnly: subSchema.readOnly,
                                writeOnly: subSchema.writeOnly,
                                default: subSchema.default,
                            };
                        }
                    }
                }
            }
            if (subSchema.minimum === 0) {
                const typeComposer = schemaComposer.getAnyTC(subSchema.type === 'integer' ? graphql_scalars_1.GraphQLNonNegativeInt : graphql_scalars_1.GraphQLNonNegativeFloat);
                return {
                    input: typeComposer,
                    output: typeComposer,
                    description: subSchema.description,
                    nullable: subSchema.nullable,
                    readOnly: subSchema.readOnly,
                    writeOnly: subSchema.writeOnly,
                    default: subSchema.default,
                };
            }
            else if (subSchema.minimum > 0) {
                const typeComposer = schemaComposer.getAnyTC(subSchema.type === 'integer' ? graphql_scalars_1.GraphQLPositiveInt : graphql_scalars_1.GraphQLPositiveFloat);
                return {
                    input: typeComposer,
                    output: typeComposer,
                    description: subSchema.description,
                    nullable: subSchema.nullable,
                    readOnly: subSchema.readOnly,
                    writeOnly: subSchema.writeOnly,
                    default: subSchema.default,
                };
            }
            if (subSchema.maximum === 0) {
                const typeComposer = schemaComposer.getAnyTC(subSchema.type === 'integer' ? graphql_scalars_1.GraphQLNonPositiveInt : graphql_scalars_1.GraphQLNonPositiveFloat);
                return {
                    input: typeComposer,
                    output: typeComposer,
                    description: subSchema.description,
                    nullable: subSchema.nullable,
                    readOnly: subSchema.readOnly,
                    writeOnly: subSchema.writeOnly,
                    default: subSchema.default,
                };
            }
            else if (subSchema.maximum < 0) {
                const typeComposer = schemaComposer.getAnyTC(subSchema.type === 'integer' ? graphql_scalars_1.GraphQLNegativeInt : graphql_scalars_1.GraphQLNegativeFloat);
                return {
                    input: typeComposer,
                    output: typeComposer,
                    description: subSchema.description,
                    nullable: subSchema.nullable,
                    readOnly: subSchema.readOnly,
                    writeOnly: subSchema.writeOnly,
                    default: subSchema.default,
                };
            }
            if (subSchema.maximum > Number.MAX_SAFE_INTEGER ||
                subSchema.minimum < Number.MIN_SAFE_INTEGER) {
                const typeComposer = schemaComposer.getAnyTC(graphql_scalars_1.GraphQLBigInt);
                return {
                    input: typeComposer,
                    output: typeComposer,
                    description: subSchema.description,
                    nullable: subSchema.nullable,
                    readOnly: subSchema.readOnly,
                    writeOnly: subSchema.writeOnly,
                    default: subSchema.default,
                };
            }
            switch (subSchema.type) {
                case 'boolean': {
                    const typeComposer = schemaComposer.getAnyTC(graphql_1.GraphQLBoolean);
                    return {
                        input: typeComposer,
                        output: typeComposer,
                        description: subSchema.description,
                        nullable: subSchema.nullable,
                        readOnly: subSchema.readOnly,
                        writeOnly: subSchema.writeOnly,
                        default: subSchema.default,
                    };
                }
                case 'null': {
                    const typeComposer = schemaComposer.getAnyTC(scalars_js_1.GraphQLVoid);
                    return {
                        input: typeComposer,
                        output: typeComposer,
                        description: subSchema.description,
                        nullable: subSchema.nullable,
                        readOnly: subSchema.readOnly,
                        writeOnly: subSchema.writeOnly,
                        default: subSchema.default,
                    };
                }
                case 'integer': {
                    const typeComposer = schemaComposer.getAnyTC(graphql_1.GraphQLInt);
                    return {
                        input: typeComposer,
                        output: typeComposer,
                        description: subSchema.description,
                        nullable: subSchema.nullable,
                        readOnly: subSchema.readOnly,
                        writeOnly: subSchema.writeOnly,
                        default: subSchema.default,
                    };
                }
                case 'number': {
                    const typeComposer = schemaComposer.getAnyTC(graphql_1.GraphQLFloat);
                    return {
                        input: typeComposer,
                        output: typeComposer,
                        description: subSchema.description,
                        nullable: subSchema.nullable,
                        readOnly: subSchema.readOnly,
                        writeOnly: subSchema.writeOnly,
                        default: subSchema.default,
                    };
                }
                case 'string': {
                    if (subSchema.minLength === 1 && subSchema.maxLength == null) {
                        const tc = schemaComposer.getAnyTC(graphql_scalars_1.GraphQLNonEmptyString);
                        return {
                            input: tc,
                            output: tc,
                            description: subSchema.description,
                            nullable: subSchema.nullable,
                            readOnly: subSchema.readOnly,
                            writeOnly: subSchema.writeOnly,
                            default: subSchema.default,
                        };
                    }
                    if (subSchema.minLength || subSchema.maxLength) {
                        schemaComposer.addDirective(directives_js_1.LengthDirective);
                        const typeComposer = schemaComposer.createScalarTC({
                            name: (0, getValidTypeName_js_1.getValidTypeName)({
                                schemaComposer,
                                isInput: false,
                                subSchema,
                            }),
                            description: subSchema.description,
                            directives: [
                                {
                                    name: 'length',
                                    args: {
                                        min: subSchema.minLength,
                                        max: subSchema.maxLength,
                                    },
                                },
                            ],
                        });
                        return {
                            input: typeComposer,
                            output: typeComposer,
                            description: subSchema.description,
                            nullable: subSchema.nullable,
                            readOnly: subSchema.readOnly,
                            writeOnly: subSchema.writeOnly,
                            default: subSchema.default,
                        };
                    }
                    const typeComposer = schemaComposer.getAnyTC(graphql_1.GraphQLString);
                    return {
                        input: typeComposer,
                        output: typeComposer,
                        description: subSchema.description,
                        nullable: subSchema.nullable,
                        readOnly: subSchema.readOnly,
                        writeOnly: subSchema.writeOnly,
                        default: subSchema.default,
                    };
                }
                case 'object': {
                    switch (subSchema.title) {
                        case '_schema':
                            return {
                                output: schemaComposer,
                                ...subSchema,
                            };
                        case 'Query':
                            return {
                                output: schemaComposer.Query,
                                ...subSchema,
                            };
                        case 'Mutation':
                            return {
                                output: schemaComposer.Mutation,
                                ...subSchema,
                            };
                        case 'Subscription':
                            if (path === '/properties/subscription') {
                                return {
                                    output: schemaComposer.Subscription,
                                    ...subSchema,
                                };
                            }
                            subSchema.title = 'Subscription_';
                            break;
                    }
                }
            }
            if (subSchema.oneOf && !subSchema.properties) {
                schemaComposer.addDirective(directives_js_1.OneOfDirective);
                const input = schemaComposer.createInputTC({
                    name: (0, getValidTypeName_js_1.getValidTypeName)({
                        schemaComposer,
                        isInput: true,
                        subSchema,
                    }),
                    fields: {},
                    directives: [
                        {
                            name: 'oneOf',
                        },
                    ],
                });
                const extensions = {};
                const directives = [];
                if ((_b = subSchema.$comment) === null || _b === void 0 ? void 0 : _b.startsWith('statusCodeOneOfIndexMap:')) {
                    const statusCodeOneOfIndexMapStr = subSchema.$comment.replace('statusCodeOneOfIndexMap:', '');
                    const statusCodeOneOfIndexMap = JSON.parse(statusCodeOneOfIndexMapStr);
                    if (statusCodeOneOfIndexMap) {
                        extensions.statusCodeOneOfIndexMap = statusCodeOneOfIndexMap;
                    }
                }
                if ((_c = subSchema.discriminator) === null || _c === void 0 ? void 0 : _c.propertyName) {
                    schemaComposer.addDirective(directives_js_1.DiscriminatorDirective);
                    directives.push({
                        name: 'discriminator',
                        args: {
                            field: subSchema.discriminator.propertyName,
                        },
                    });
                }
                const output = schemaComposer.createUnionTC({
                    name: (0, getValidTypeName_js_1.getValidTypeName)({
                        schemaComposer,
                        isInput: false,
                        subSchema,
                    }),
                    description: subSchema.description,
                    types: [],
                    directives,
                    extensions,
                });
                return {
                    input,
                    output,
                    ...subSchema,
                };
            }
            if (subSchema.properties ||
                subSchema.allOf ||
                subSchema.anyOf ||
                subSchema.additionalProperties) {
                if (subSchema.title === 'Any') {
                    const typeComposer = schemaComposer.getAnyTC(graphql_scalars_1.GraphQLJSON);
                    return {
                        input: typeComposer,
                        output: typeComposer,
                        description: subSchema.description,
                        nullable: subSchema.nullable,
                        readOnly: subSchema.readOnly,
                        writeOnly: subSchema.writeOnly,
                        default: subSchema.default,
                    };
                }
                const config = {
                    name: (0, getValidTypeName_js_1.getValidTypeName)({
                        schemaComposer,
                        isInput: false,
                        subSchema,
                    }),
                    description: subSchema.description,
                    fields: {},
                    directives: [],
                    extensions: {
                        default: subSchema.default,
                    },
                };
                if ((_d = subSchema.examples) === null || _d === void 0 ? void 0 : _d.length) {
                    schemaComposer.addDirective(directives_js_1.ExampleDirective);
                    for (const example of subSchema.examples) {
                        config.directives.push({
                            name: 'example',
                            args: {
                                value: example,
                            },
                        });
                    }
                }
                if ((_e = subSchema.discriminator) === null || _e === void 0 ? void 0 : _e.propertyName) {
                    schemaComposer.addDirective(directives_js_1.DiscriminatorDirective);
                }
                const directives = [];
                if ((_f = subSchema.examples) === null || _f === void 0 ? void 0 : _f.length) {
                    schemaComposer.addDirective(directives_js_1.ExampleDirective);
                    for (const example of subSchema.examples) {
                        directives.push({
                            name: 'example',
                            args: {
                                value: example,
                            },
                        });
                    }
                }
                return {
                    input: schemaComposer.createInputTC({
                        name: (0, getValidTypeName_js_1.getValidTypeName)({
                            schemaComposer,
                            isInput: true,
                            subSchema,
                        }),
                        description: subSchema.description,
                        fields: {},
                        directives,
                        extensions: {
                            default: subSchema.default,
                        },
                    }),
                    output: subSchema.discriminator
                        ? schemaComposer.createInterfaceTC({
                            ...config,
                            resolveType(root) {
                                return root[subSchema.discriminator.propertyName];
                            },
                            directives: [
                                {
                                    name: 'discriminator',
                                    args: {
                                        propertyName: subSchema.discriminator.propertyName,
                                    },
                                },
                            ],
                        })
                        : schemaComposer.createObjectTC(config),
                    ...subSchema,
                    ...(subSchema.properties ? { properties: { ...subSchema.properties } } : {}),
                    ...(subSchema.allOf ? { allOf: [...subSchema.allOf] } : {}),
                    ...(subSchema.additionalProperties
                        ? {
                            additionalProperties: subSchema.additionalProperties === true
                                ? true
                                : { ...subSchema.additionalProperties },
                        }
                        : {}),
                };
            }
            return subSchema;
        },
        leave(subSchemaAndTypeComposers, { path }) {
            var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s;
            // const validateWithJSONSchema = getValidateFnForSchemaPath(ajv, path, schema);
            const subSchemaOnly = {
                ...subSchemaAndTypeComposers,
                input: undefined,
                output: undefined,
            };
            if (subSchemaAndTypeComposers.oneOf && !subSchemaAndTypeComposers.properties) {
                const isPlural = subSchemaAndTypeComposers.oneOf.some(({ output }) => 'ofType' in output);
                if (isPlural) {
                    const { input, output } = (0, getUnionTypeComposers_js_1.getUnionTypeComposers)({
                        schemaComposer,
                        typeComposersList: subSchemaAndTypeComposers.oneOf.map(({ input, output }) => ({
                            input: input.ofType || input,
                            output: output.ofType || output,
                        })),
                        subSchemaAndTypeComposers,
                        logger,
                    });
                    return {
                        input: input.getTypePlural(),
                        output: output.getTypePlural(),
                        nullable: subSchemaAndTypeComposers.nullable,
                        default: subSchemaAndTypeComposers.default,
                        readOnly: subSchemaAndTypeComposers.readOnly,
                        writeOnly: subSchemaAndTypeComposers.writeOnly,
                    };
                }
                return (0, getUnionTypeComposers_js_1.getUnionTypeComposers)({
                    schemaComposer,
                    typeComposersList: subSchemaAndTypeComposers.oneOf,
                    subSchemaAndTypeComposers,
                    logger,
                });
            }
            const fieldMap = {};
            const inputFieldMap = {};
            let isList = false;
            if (subSchemaAndTypeComposers.allOf) {
                let ableToUseGraphQLInputObjectType = true;
                for (const maybeTypeComposers of subSchemaAndTypeComposers.allOf) {
                    let { input: inputTypeComposer, output: outputTypeComposer } = maybeTypeComposers;
                    if (inputTypeComposer instanceof graphql_compose_1.ListComposer) {
                        isList = true;
                        inputTypeComposer = inputTypeComposer.ofType;
                    }
                    if (outputTypeComposer instanceof graphql_compose_1.ListComposer) {
                        isList = true;
                        outputTypeComposer = outputTypeComposer.ofType;
                    }
                    if (inputTypeComposer instanceof graphql_compose_1.ScalarTypeComposer ||
                        inputTypeComposer instanceof graphql_compose_1.EnumTypeComposer) {
                        ableToUseGraphQLInputObjectType = false;
                    }
                    else {
                        const inputTypeElemFieldMap = inputTypeComposer.getFields();
                        for (const fieldName in inputTypeElemFieldMap) {
                            const field = inputTypeElemFieldMap[fieldName];
                            inputFieldMap[fieldName] = field;
                        }
                    }
                    if ((0, graphql_compose_1.isSomeInputTypeComposer)(outputTypeComposer)) {
                        schemaComposer.addDirective(directives_js_1.ResolveRootDirective);
                        fieldMap[outputTypeComposer.getTypeName()] = {
                            type: outputTypeComposer,
                            directives: [
                                {
                                    name: 'resolveRoot',
                                },
                            ],
                        };
                    }
                    else if (outputTypeComposer instanceof graphql_compose_1.UnionTypeComposer) {
                        const outputTCElems = outputTypeComposer.getTypes();
                        for (const outputTCElem of outputTCElems) {
                            const outputTypeElemFieldMap = outputTCElem.getFields();
                            for (const fieldName in outputTypeElemFieldMap) {
                                const field = outputTypeElemFieldMap[fieldName];
                                fieldMap[fieldName] = field;
                            }
                        }
                    }
                    else {
                        if (outputTypeComposer instanceof graphql_compose_1.InterfaceTypeComposer) {
                            subSchemaAndTypeComposers.output.addInterface(outputTypeComposer);
                        }
                        const typeElemFieldMap = outputTypeComposer.getFields();
                        for (const fieldName in typeElemFieldMap) {
                            const field = typeElemFieldMap[fieldName];
                            fieldMap[fieldName] = field;
                        }
                    }
                }
                if ((_a = subSchemaAndTypeComposers.examples) === null || _a === void 0 ? void 0 : _a.length) {
                    schemaComposer.addDirective(directives_js_1.ExampleDirective);
                    const directives = subSchemaAndTypeComposers.output.getDirectives() || [];
                    for (const example of subSchemaAndTypeComposers.examples) {
                        directives.push({
                            name: 'example',
                            args: {
                                value: example,
                            },
                        });
                    }
                    subSchemaAndTypeComposers.output.setDirectives(directives);
                }
                subSchemaAndTypeComposers.output.addFields(fieldMap);
                subSchemaAndTypeComposers.output.setExtensions({
                    // validateWithJSONSchema,
                    default: subSchemaAndTypeComposers.default,
                });
                if (ableToUseGraphQLInputObjectType) {
                    subSchemaAndTypeComposers.input.addFields(inputFieldMap);
                    if ((_b = subSchemaAndTypeComposers.examples) === null || _b === void 0 ? void 0 : _b.length) {
                        schemaComposer.addDirective(directives_js_1.ExampleDirective);
                        const directives = subSchemaAndTypeComposers.input.getDirectives() || [];
                        for (const example of subSchemaAndTypeComposers.examples) {
                            directives.push({
                                name: 'example',
                                args: {
                                    value: example,
                                },
                            });
                        }
                        subSchemaAndTypeComposers.input.setDirectives(directives);
                    }
                    subSchemaAndTypeComposers.input.setExtensions({
                        default: subSchemaAndTypeComposers.default,
                    });
                }
                else {
                    subSchemaAndTypeComposers.input = schemaComposer.getAnyTC(graphql_scalars_1.GraphQLJSON);
                }
            }
            if (subSchemaAndTypeComposers.anyOf) {
                // It should not have `required` because it is `anyOf` not `allOf`
                let ableToUseGraphQLInputObjectType = true;
                for (const typeComposers of subSchemaAndTypeComposers.anyOf) {
                    let { input: inputTypeComposer, output: outputTypeComposer } = typeComposers;
                    if (inputTypeComposer instanceof graphql_compose_1.ListComposer ||
                        outputTypeComposer instanceof graphql_compose_1.ListComposer) {
                        isList = true;
                        inputTypeComposer = inputTypeComposer.ofType;
                        outputTypeComposer = outputTypeComposer.ofType;
                    }
                    if (inputTypeComposer instanceof graphql_compose_1.ScalarTypeComposer ||
                        inputTypeComposer instanceof graphql_compose_1.EnumTypeComposer) {
                        ableToUseGraphQLInputObjectType = false;
                    }
                    else {
                        const inputTypeElemFieldMap = inputTypeComposer.getFields();
                        for (const fieldName in inputTypeElemFieldMap) {
                            // In case of conflict set it to JSON
                            // TODO: But instead we can convert that field into a oneOf of all possible types
                            if (inputFieldMap[fieldName]) {
                                let existingType = inputFieldMap[fieldName].type;
                                if (typeof existingType === 'function') {
                                    existingType = existingType();
                                }
                                let newType = inputTypeElemFieldMap[fieldName].type;
                                if (typeof newType === 'function') {
                                    newType = newType();
                                }
                                const newTypeName = newType.getTypeName().replace('!', '');
                                const existingTypeName = existingType.getTypeName().replace('!', '');
                                if (existingTypeName !== newTypeName) {
                                    if (newTypeName !== 'JSON') {
                                        inputFieldMap[fieldName] = {
                                            type: schemaComposer.getAnyTC(graphql_scalars_1.GraphQLJSON),
                                        };
                                    }
                                    if (existingTypeName === 'JSON') {
                                        const field = inputTypeElemFieldMap[fieldName];
                                        inputFieldMap[fieldName] = (0, graphql_1.isNonNullType)(field.type.getType())
                                            ? {
                                                ...field,
                                                type: () => field.type.ofType,
                                            }
                                            : field;
                                    }
                                }
                            }
                            else {
                                const field = inputTypeElemFieldMap[fieldName];
                                inputFieldMap[fieldName] = (0, graphql_1.isNonNullType)(field.type.getType())
                                    ? {
                                        ...field,
                                        type: () => field.type.ofType,
                                    }
                                    : field;
                            }
                        }
                    }
                    if (outputTypeComposer instanceof graphql_compose_1.ScalarTypeComposer) {
                        const typeName = outputTypeComposer.getTypeName();
                        // In case of conflict set it to JSON
                        // TODO: But instead we can convert that field into a union of all possible types
                        if (fieldMap[typeName]) {
                            const existingTypeName = (_d = (_c = fieldMap[typeName]) === null || _c === void 0 ? void 0 : _c.type) === null || _d === void 0 ? void 0 : _d.getTypeName();
                            if (existingTypeName === 'JSON') {
                                schemaComposer.addDirective(directives_js_1.ResolveRootDirective);
                                fieldMap[typeName] = {
                                    type: outputTypeComposer,
                                    directives: [
                                        {
                                            name: 'resolveRoot',
                                        },
                                    ],
                                };
                            }
                            if (typeName !== 'JSON' && existingTypeName !== typeName) {
                                fieldMap[typeName] = {
                                    type: schemaComposer.getAnyTC(graphql_scalars_1.GraphQLJSON),
                                };
                            }
                        }
                        else {
                            schemaComposer.addDirective(directives_js_1.ResolveRootDirective);
                            fieldMap[typeName] = {
                                type: outputTypeComposer,
                                directives: [
                                    {
                                        name: 'resolveRoot',
                                    },
                                ],
                            };
                        }
                    }
                    else {
                        const typeElemFieldMap = outputTypeComposer.getFields();
                        for (const fieldName in typeElemFieldMap) {
                            // In case of conflict set it to JSON
                            // TODO: But instead we can convert that field into a union of all possible types
                            const field = typeElemFieldMap[fieldName];
                            const existingField = fieldMap[fieldName];
                            fieldMap[fieldName] = {
                                ...field,
                                type: () => {
                                    const fieldType = field.type.getType();
                                    const namedType = (0, graphql_1.getNamedType)(fieldType);
                                    if (existingField) {
                                        const existingFieldType = existingField.type();
                                        const existingNamedType = (0, graphql_1.getNamedType)(existingFieldType);
                                        const existingTypeName = existingNamedType.name;
                                        const newTypeName = namedType.name;
                                        if (existingTypeName !== 'JSON' && existingNamedType.name !== namedType.name) {
                                            return schemaComposer.getAnyTC(graphql_scalars_1.GraphQLJSON);
                                        }
                                        if (newTypeName === 'JSON') {
                                            return existingFieldType;
                                        }
                                    }
                                    return field.type.getType();
                                },
                            };
                        }
                    }
                }
                let outputTypeComposer = subSchemaAndTypeComposers.output;
                if ('ofType' in outputTypeComposer) {
                    outputTypeComposer = outputTypeComposer.ofType;
                }
                outputTypeComposer.addFields(fieldMap);
                if ((_e = subSchemaAndTypeComposers.examples) === null || _e === void 0 ? void 0 : _e.length) {
                    schemaComposer.addDirective(directives_js_1.ExampleDirective);
                    const directives = outputTypeComposer.getDirectives() || [];
                    for (const example of subSchemaAndTypeComposers.examples) {
                        directives.push({
                            name: 'example',
                            args: {
                                value: example,
                            },
                        });
                    }
                    outputTypeComposer.setDirectives(directives);
                }
                outputTypeComposer.setExtensions({
                    // validateWithJSONSchema,
                    default: subSchemaAndTypeComposers.default,
                });
                let inputTypeComposer = subSchemaAndTypeComposers.input;
                if ('ofType' in inputTypeComposer) {
                    inputTypeComposer = inputTypeComposer.ofType;
                }
                if (ableToUseGraphQLInputObjectType) {
                    inputTypeComposer.addFields(inputFieldMap);
                    if ((_f = subSchemaAndTypeComposers.examples) === null || _f === void 0 ? void 0 : _f.length) {
                        schemaComposer.addDirective(directives_js_1.ExampleDirective);
                        const directives = inputTypeComposer.getDirectives() || [];
                        for (const example of subSchemaAndTypeComposers.examples) {
                            directives.push({
                                name: 'example',
                                args: {
                                    value: example,
                                },
                            });
                        }
                        inputTypeComposer.setDirectives(directives);
                    }
                    inputTypeComposer.setExtensions({
                        default: subSchemaAndTypeComposers.default,
                    });
                }
                else {
                    subSchemaAndTypeComposers.input = schemaComposer.getAnyTC(graphql_scalars_1.GraphQLJSON);
                }
            }
            switch (subSchemaAndTypeComposers.type) {
                case 'object':
                    if (subSchemaAndTypeComposers.properties) {
                        for (const propertyName in subSchemaAndTypeComposers.properties) {
                            // TODO: needs to be fixed
                            if (propertyName === 'additionalProperties') {
                                continue;
                            }
                            const fieldName = (0, utils_1.sanitizeNameForGraphQL)(propertyName);
                            const fieldDirectives = [];
                            if (propertyName !== fieldName) {
                                schemaComposer.addDirective(directives_js_1.ResolveRootFieldDirective);
                                fieldDirectives.push({
                                    name: 'resolveRootField',
                                    args: {
                                        field: propertyName,
                                    },
                                });
                            }
                            fieldMap[fieldName] = {
                                type: () => {
                                    var _a;
                                    const typeComposers = subSchemaAndTypeComposers.properties[propertyName];
                                    let nullable = true;
                                    if ((_a = subSchemaAndTypeComposers.required) === null || _a === void 0 ? void 0 : _a.includes(propertyName)) {
                                        nullable = false;
                                    }
                                    // Nullable has more priority
                                    if (typeComposers.nullable === false) {
                                        nullable = false;
                                    }
                                    if (typeComposers.nullable === true) {
                                        nullable = true;
                                    }
                                    if (subSchemaAndTypeComposers.properties[propertyName].writeOnly) {
                                        nullable = true;
                                    }
                                    return !nullable ? typeComposers.output.getTypeNonNull() : typeComposers.output;
                                },
                                // Make sure you get the right property
                                directives: fieldDirectives,
                                description: subSchemaAndTypeComposers.properties[propertyName].description ||
                                    ((_g = subSchemaAndTypeComposers.properties[propertyName].output) === null || _g === void 0 ? void 0 : _g.description),
                            };
                            const directives = [];
                            if (fieldName !== propertyName) {
                                schemaComposer.addDirective(directives_js_1.ResolveRootFieldDirective);
                                directives.push({
                                    name: 'resolveRootField',
                                    args: {
                                        field: propertyName,
                                    },
                                });
                            }
                            inputFieldMap[fieldName] = {
                                type: () => {
                                    var _a, _b;
                                    const typeComposers = subSchemaAndTypeComposers.properties[propertyName];
                                    let nullable = true;
                                    if ((_a = subSchemaAndTypeComposers.required) === null || _a === void 0 ? void 0 : _a.includes(propertyName)) {
                                        nullable = false;
                                    }
                                    // Nullable has more priority
                                    if (typeComposers.nullable === false) {
                                        nullable = false;
                                    }
                                    if (typeComposers.nullable === true) {
                                        nullable = true;
                                    }
                                    if (subSchemaAndTypeComposers.properties[propertyName].readOnly) {
                                        nullable = true;
                                    }
                                    return !nullable ? (_b = typeComposers.input) === null || _b === void 0 ? void 0 : _b.getTypeNonNull() : typeComposers.input;
                                },
                                directives,
                                description: subSchemaAndTypeComposers.properties[propertyName].description ||
                                    ((_h = subSchemaAndTypeComposers.properties[propertyName].input) === null || _h === void 0 ? void 0 : _h.description),
                                defaultValue: ((_j = subSchemaAndTypeComposers.properties[propertyName]) === null || _j === void 0 ? void 0 : _j.default) ||
                                    ((_l = (_k = subSchemaAndTypeComposers.properties[propertyName]) === null || _k === void 0 ? void 0 : _k.extensions) === null || _l === void 0 ? void 0 : _l.default) ||
                                    ((_o = (_m = subSchemaAndTypeComposers.properties[propertyName]) === null || _m === void 0 ? void 0 : _m.input) === null || _o === void 0 ? void 0 : _o.default),
                            };
                        }
                    }
                    if (subSchemaAndTypeComposers.additionalProperties) {
                        // Take a look later
                        if (typeof subSchemaAndTypeComposers.additionalProperties === 'object' &&
                            subSchemaAndTypeComposers.additionalProperties.output instanceof graphql_compose_1.ObjectTypeComposer) {
                            const containerOutputTC = schemaComposer.createObjectTC({
                                name: `${subSchemaAndTypeComposers.additionalProperties.output.getTypeName()}_entry`,
                                fields: {
                                    key: {
                                        type: 'ID!',
                                    },
                                    value: {
                                        type: subSchemaAndTypeComposers.additionalProperties.output,
                                    },
                                },
                            });
                            schemaComposer.addDirective(directives_js_1.DictionaryDirective);
                            fieldMap.additionalProperties = {
                                type: containerOutputTC.List,
                                directives: [
                                    {
                                        name: 'dictionary',
                                    },
                                ],
                            };
                        }
                        else if (Object.keys(fieldMap).length > 0) {
                            schemaComposer.addDirective(directives_js_1.ResolveRootDirective);
                            fieldMap.additionalProperties = {
                                type: graphql_scalars_1.GraphQLJSON,
                                directives: [
                                    {
                                        name: 'resolveRoot',
                                    },
                                ],
                            };
                        }
                        else {
                            const typeComposer = schemaComposer.getAnyTC(graphql_scalars_1.GraphQLJSON);
                            schemaComposer.delete((_q = (_p = subSchemaAndTypeComposers.input) === null || _p === void 0 ? void 0 : _p.getTypeName) === null || _q === void 0 ? void 0 : _q.call(_p));
                            schemaComposer.delete((_s = (_r = subSchemaAndTypeComposers.output) === null || _r === void 0 ? void 0 : _r.getTypeName) === null || _s === void 0 ? void 0 : _s.call(_r));
                            return {
                                input: typeComposer,
                                output: typeComposer,
                                description: subSchemaAndTypeComposers.description,
                                nullable: subSchemaAndTypeComposers.nullable,
                                default: subSchemaAndTypeComposers.default,
                                readOnly: subSchemaAndTypeComposers.readOnly,
                                writeOnly: subSchemaAndTypeComposers.writeOnly,
                            };
                        }
                    }
                    if (subSchemaAndTypeComposers.title in rootInputTypeNameComposerMap) {
                        const typeComposer = rootInputTypeNameComposerMap[subSchemaAndTypeComposers.title]();
                        for (const fieldName in inputFieldMap) {
                            let inputTC = inputFieldMap[fieldName].type();
                            if ('ofType' in inputTC) {
                                inputTC = inputTC.ofType;
                            }
                            typeComposer.addFieldArgs(fieldName, inputTC.getFields());
                        }
                        return {
                            output: typeComposer,
                        };
                    }
                    let output = subSchemaAndTypeComposers.output;
                    if (Object.keys(fieldMap).length === 0) {
                        output = schemaComposer.getAnyTC(graphql_scalars_1.GraphQLJSON);
                    }
                    else if ('addFields' in output) {
                        output.addFields(fieldMap);
                    }
                    let input = subSchemaAndTypeComposers.input;
                    if (Object.keys(inputFieldMap).length === 0) {
                        input = schemaComposer.getAnyTC(graphql_scalars_1.GraphQLJSON);
                    }
                    else if (input != null && 'addFields' in input) {
                        input.addFields(inputFieldMap);
                    }
                    if (isList) {
                        input = input.List;
                        output = output.List;
                    }
                    return {
                        input,
                        output,
                        nullable: subSchemaAndTypeComposers.nullable,
                        default: subSchemaAndTypeComposers.default,
                        readOnly: subSchemaAndTypeComposers.readOnly,
                        writeOnly: subSchemaAndTypeComposers.writeOnly,
                    };
            }
            if (subSchemaAndTypeComposers.input || subSchemaAndTypeComposers.output) {
                return {
                    input: subSchemaAndTypeComposers.input,
                    output: subSchemaAndTypeComposers.output,
                    description: subSchemaAndTypeComposers.description,
                    nullable: subSchemaAndTypeComposers.nullable,
                    default: subSchemaAndTypeComposers.default,
                    readOnly: subSchemaAndTypeComposers.readOnly,
                    writeOnly: subSchemaAndTypeComposers.writeOnly,
                };
            }
            else {
                logger.debug(`GraphQL Type cannot be created for this JSON Schema definition;`, {
                    subSchema: subSchemaOnly,
                    path,
                });
                const typeComposer = schemaComposer.getAnyTC(graphql_scalars_1.GraphQLJSON);
                return {
                    input: typeComposer,
                    output: typeComposer,
                    description: subSchemaAndTypeComposers.description,
                    nullable: subSchemaAndTypeComposers.nullable,
                    readOnly: subSchemaAndTypeComposers.readOnly,
                    writeOnly: subSchemaAndTypeComposers.writeOnly,
                    default: subSchemaAndTypeComposers.default,
                };
            }
        },
    });
}
exports.getComposerFromJSONSchema = getComposerFromJSONSchema;
