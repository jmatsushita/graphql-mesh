"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const graphql_1 = require("graphql");
const lodash_set_1 = tslib_1.__importDefault(require("lodash.set"));
const types_js_1 = require("@apollo/subgraph/dist/types.js");
const string_interpolation_1 = require("@graphql-mesh/string-interpolation");
const utils_1 = require("@graphql-mesh/utils");
const utils_2 = require("@graphql-tools/utils");
const federationDirectives = [
    'extends',
    'external',
    'inaccessible',
    'key',
    'override',
    'provides',
    'requires',
    'shareable',
    'tag',
];
class FederationTransform {
    constructor({ apiName, baseDir, config, importFn, }) {
        this.noWrap = true;
        this.apiName = apiName;
        this.config = config;
        this.baseDir = baseDir;
        this.importFn = importFn;
    }
    transformSchema(schema, rawSource) {
        var _a, _b, _c, _d, _e, _f, _g;
        rawSource.merge = {};
        if ((_a = this.config) === null || _a === void 0 ? void 0 : _a.types) {
            const queryType = schema.getQueryType();
            const queryTypeFields = queryType.getFields();
            for (const type of this.config.types) {
                rawSource.merge[type.name] = {};
                const typeObj = schema.getType(type.name);
                typeObj.extensions = typeObj.extensions || {};
                const typeDirectivesObj = (typeObj.extensions.directives =
                    typeObj.extensions.directives || {});
                if ((_b = type.config) === null || _b === void 0 ? void 0 : _b.key) {
                    typeDirectivesObj.key = type.config.key;
                }
                if ((_c = type.config) === null || _c === void 0 ? void 0 : _c.shareable) {
                    typeDirectivesObj.shareable = type.config.shareable;
                }
                if ((_d = type.config) === null || _d === void 0 ? void 0 : _d.extends) {
                    typeDirectivesObj.extends = type.config.extends;
                }
                const typeFieldObjs = typeObj.getFields();
                if ((_e = type.config) === null || _e === void 0 ? void 0 : _e.fields) {
                    for (const field of type.config.fields) {
                        const typeField = typeFieldObjs[field.name];
                        if (typeField) {
                            typeField.extensions = typeField.extensions || {};
                            const directivesObj = (typeField.extensions.directives =
                                typeField.extensions.directives || {});
                            Object.assign(directivesObj, field.config);
                        }
                        rawSource.merge[type.name].fields = rawSource.merge[type.name].fields || {};
                        rawSource.merge[type.name].fields[field.name] =
                            rawSource.merge[type.name].fields[field.name] || {};
                        if (field.config.requires) {
                            rawSource.merge[type.name].fields[field.name].computed = true;
                            rawSource.merge[type.name].fields[field.name].selectionSet = `{ ${field.config.requires} }`;
                        }
                    }
                }
                // If a field is a key field, it should be GraphQLID
                if ((_f = type.config) === null || _f === void 0 ? void 0 : _f.key) {
                    let selectionSetContent = '';
                    for (const keyField of type.config.key) {
                        selectionSetContent += '\n';
                        selectionSetContent += keyField.fields || '';
                    }
                    if (selectionSetContent) {
                        rawSource.merge[type.name].selectionSet = `{ ${selectionSetContent} }`;
                    }
                }
                let resolveReference;
                if ((_g = type.config) === null || _g === void 0 ? void 0 : _g.resolveReference) {
                    const resolveReferenceConfig = type.config.resolveReference;
                    if (typeof resolveReferenceConfig === 'string') {
                        const fn$ = (0, utils_1.loadFromModuleExportExpression)(resolveReferenceConfig, {
                            cwd: this.baseDir,
                            defaultExportName: 'default',
                            importFn: this.importFn,
                        });
                        resolveReference = (...args) => fn$.then(fn => fn(...args));
                    }
                    else if (typeof resolveReferenceConfig === 'function') {
                        resolveReference = resolveReferenceConfig;
                    }
                    else {
                        const queryField = queryTypeFields[resolveReferenceConfig.queryFieldName];
                        resolveReference = async (root, context, info) => {
                            const args = {};
                            for (const argName in resolveReferenceConfig.args) {
                                const argVal = string_interpolation_1.stringInterpolator.parse(resolveReferenceConfig.args[argName], {
                                    root,
                                    args,
                                    context,
                                    info,
                                    env: process.env,
                                });
                                if (argVal) {
                                    (0, lodash_set_1.default)(args, argName, argVal);
                                }
                            }
                            const result = await context[this.apiName].Query[queryField.name]({
                                root,
                                args,
                                context,
                                info,
                            });
                            return {
                                ...root,
                                ...result,
                            };
                        };
                    }
                    rawSource.merge[type.name].resolve = resolveReference;
                }
            }
        }
        const entityTypes = [];
        for (const typeName in rawSource.merge || {}) {
            const type = schema.getType(typeName);
            if ((0, graphql_1.isObjectType)(type)) {
                entityTypes.push(type);
            }
            (0, lodash_set_1.default)(type, 'extensions.apollo.subgraph.resolveReference', rawSource.merge[typeName].resolve);
        }
        const schemaWithFederationQueryType = (0, utils_2.mapSchema)(schema, {
            [utils_2.MapperKind.QUERY]: type => {
                const config = type.toConfig();
                return new graphql_1.GraphQLObjectType({
                    ...config,
                    fields: {
                        ...config.fields,
                        _entities: types_js_1.entitiesField,
                        _service: {
                            ...types_js_1.serviceField,
                            resolve: (root, args, context, info) => ({
                                sdl: (0, utils_2.printSchemaWithDirectives)(info.schema),
                            }),
                        },
                    },
                });
            },
        });
        const schemaWithUnionType = (0, utils_2.mapSchema)(schemaWithFederationQueryType, {
            [utils_2.MapperKind.UNION_TYPE]: type => {
                if (type.name === types_js_1.EntityType.name) {
                    return new graphql_1.GraphQLUnionType({
                        ...types_js_1.EntityType.toConfig(),
                        types: entityTypes,
                    });
                }
                return type;
            },
        });
        schemaWithUnionType.extensions = schemaWithUnionType.extensions || {};
        const directivesObj = (schemaWithUnionType.extensions.directives =
            schemaWithUnionType.extensions.directives || {});
        directivesObj.link = {
            url: 'https://specs.apollo.dev/federation/' + (this.config.version || 'v2.0'),
            import: federationDirectives.map(dirName => `@${dirName}`),
        };
        const existingDirectives = schemaWithUnionType.getDirectives();
        const filteredDirectives = existingDirectives.filter(directive => federationDirectives.includes(directive.name));
        if (existingDirectives.length === filteredDirectives.length) {
            return schemaWithUnionType;
        }
        const filteredSchema = (0, utils_2.mapSchema)(schemaWithUnionType, {
            [utils_2.MapperKind.OBJECT_TYPE]: type => {
                var _a, _b;
                return new graphql_1.GraphQLObjectType({
                    ...type.toConfig(),
                    astNode: type.astNode && {
                        ...type.astNode,
                        directives: (_a = type.astNode.directives) === null || _a === void 0 ? void 0 : _a.filter(directive => federationDirectives.includes(directive.name.value)),
                    },
                    extensions: {
                        ...type.extensions,
                        directives: Object.fromEntries(Object.entries(((_b = type.extensions) === null || _b === void 0 ? void 0 : _b.directives) || {}).filter(([key]) => federationDirectives.includes(key))),
                    },
                });
            },
            [utils_2.MapperKind.INTERFACE_TYPE]: type => {
                var _a, _b;
                return new graphql_1.GraphQLInterfaceType({
                    ...type.toConfig(),
                    astNode: type.astNode && {
                        ...type.astNode,
                        directives: (_a = type.astNode.directives) === null || _a === void 0 ? void 0 : _a.filter(directive => federationDirectives.includes(directive.name.value)),
                    },
                    extensions: {
                        ...type.extensions,
                        directives: Object.fromEntries(Object.entries(((_b = type.extensions) === null || _b === void 0 ? void 0 : _b.directives) || {}).filter(([key]) => federationDirectives.includes(key))),
                    },
                });
            },
            [utils_2.MapperKind.COMPOSITE_FIELD]: fieldConfig => {
                var _a, _b;
                return {
                    ...fieldConfig,
                    astNode: fieldConfig.astNode && {
                        ...fieldConfig.astNode,
                        directives: (_a = fieldConfig.astNode.directives) === null || _a === void 0 ? void 0 : _a.filter(directive => federationDirectives.includes(directive.name.value)),
                    },
                    extensions: {
                        ...fieldConfig.extensions,
                        directives: Object.fromEntries(Object.entries(((_b = fieldConfig.extensions) === null || _b === void 0 ? void 0 : _b.directives) || {}).filter(([key]) => federationDirectives.includes(key))),
                    },
                };
            },
        });
        return new graphql_1.GraphQLSchema({
            ...filteredSchema.toConfig(),
            directives: filteredDirectives,
        });
    }
}
exports.default = FederationTransform;
