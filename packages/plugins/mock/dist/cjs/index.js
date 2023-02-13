"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const faker_1 = tslib_1.__importDefault(require("faker"));
const graphql_scalars_1 = require("graphql-scalars");
const mock_1 = require("@graphql-tools/mock");
const utils_1 = require("@graphql-mesh/utils");
const string_interpolation_1 = require("@graphql-mesh/string-interpolation");
const graphql_1 = require("graphql");
const mockedSchemas = new WeakSet();
function useMock(config) {
    const configIf = config != null && 'if' in config ? config.if : true;
    if (configIf) {
        return {
            onSchemaChange({ schema, replaceSchema }) {
                var _a;
                if (mockedSchemas.has(schema)) {
                    return;
                }
                const mocks = {
                    ...graphql_scalars_1.mocks,
                };
                const resolvers = {};
                const typeMap = schema.getTypeMap();
                for (const typeName in typeMap) {
                    const type = typeMap[typeName];
                    const examples = type.extensions.examples;
                    if (examples === null || examples === void 0 ? void 0 : examples.length) {
                        mocks[typeName] = () => examples[Math.floor(Math.random() * examples.length)];
                    }
                }
                if ((_a = config === null || config === void 0 ? void 0 : config.mocks) === null || _a === void 0 ? void 0 : _a.length) {
                    for (const fieldConfig of config.mocks) {
                        const fieldConfigIf = 'if' in fieldConfig ? fieldConfig.if : true;
                        if (fieldConfigIf) {
                            const [typeName, fieldName] = fieldConfig.apply.split('.');
                            if (fieldName) {
                                if (fieldConfig.faker) {
                                    let fakerFn; // eslint-disable-line
                                    const [service, method] = fieldConfig.faker.split('.');
                                    if (service in faker_1.default) {
                                        fakerFn = () => faker_1.default[service][method]();
                                    }
                                    else {
                                        fakerFn = () => faker_1.default.fake(fieldConfig.faker || '');
                                    }
                                    resolvers[typeName] = resolvers[typeName] || {};
                                    resolvers[typeName][fieldName] = fakerFn;
                                }
                                else if (fieldConfig.custom) {
                                    const exportedVal$ = (0, utils_1.loadFromModuleExportExpression)(fieldConfig.custom, {
                                        cwd: config.baseDir,
                                        defaultExportName: 'default',
                                        importFn: config.importFn,
                                    });
                                    resolvers[typeName] = resolvers[typeName] || {};
                                    resolvers[typeName][fieldName] = (root, args, context, info) => {
                                        context = context || {};
                                        context.mockStore = store;
                                        return exportedVal$.then(exportedVal => typeof exportedVal === 'function'
                                            ? exportedVal(root, args, context, info)
                                            : exportedVal);
                                    };
                                }
                                else if ('length' in fieldConfig) {
                                    resolvers[typeName] = resolvers[typeName] || {};
                                    resolvers[typeName][fieldName] = () => new Array(fieldConfig.length).fill({});
                                }
                                else if ('updateStore' in fieldConfig) {
                                    const getFromStoreKeyFactory = (0, string_interpolation_1.getInterpolatedStringFactory)(fieldConfig.store.key);
                                    const updateStoreFactories = fieldConfig.updateStore.map(updateStoreConfig => ({
                                        updateStoreConfig,
                                        keyFactory: (0, string_interpolation_1.getInterpolatedStringFactory)(updateStoreConfig.key),
                                        valueFactory: (0, string_interpolation_1.getInterpolatedStringFactory)(updateStoreConfig.value),
                                    }));
                                    resolvers[typeName] = resolvers[typeName] || {};
                                    resolvers[typeName][fieldName] = (root, args, context, info) => {
                                        const resolverData = {
                                            root,
                                            args,
                                            context,
                                            info,
                                            random: Date.now().toString(),
                                            env: process.env,
                                        };
                                        updateStoreFactories.forEach(({ updateStoreConfig, keyFactory, valueFactory }) => {
                                            const key = keyFactory(resolverData);
                                            const value = valueFactory(resolverData);
                                            store.set(updateStoreConfig.type, key, updateStoreConfig.fieldName, value);
                                        });
                                        const key = getFromStoreKeyFactory(resolverData);
                                        return store.get(fieldConfig.store.type, key, fieldConfig.store.fieldName);
                                    };
                                }
                                else if ('store' in fieldConfig) {
                                    const keyFactory = (0, string_interpolation_1.getInterpolatedStringFactory)(fieldConfig.store.key);
                                    resolvers[typeName] = resolvers[typeName] || {};
                                    resolvers[typeName][fieldName] = (root, args, context, info) => {
                                        const key = keyFactory({ root, args, context, info, env: process.env });
                                        return store.get(fieldConfig.store.type, key, fieldConfig.store.fieldName);
                                    };
                                }
                            }
                            else {
                                if (fieldConfig.faker) {
                                    let fakerFn;
                                    const [service, method] = fieldConfig.faker.split('.');
                                    if (service in faker_1.default) {
                                        fakerFn = () => faker_1.default[service][method]();
                                    }
                                    else {
                                        fakerFn = () => faker_1.default.fake(fieldConfig.faker || '');
                                    }
                                    mocks[typeName] = fakerFn;
                                }
                                else if (fieldConfig.custom) {
                                    const exportedVal$ = (0, utils_1.loadFromModuleExportExpression)(fieldConfig.custom, {
                                        cwd: config.baseDir,
                                        defaultExportName: 'default',
                                        importFn: config.importFn,
                                    });
                                    mocks[typeName] = () => {
                                        return exportedVal$.then(exportedVal => typeof exportedVal === 'function' ? exportedVal(store) : exportedVal);
                                    };
                                }
                            }
                        }
                    }
                }
                const store = (0, mock_1.createMockStore)({ schema, mocks });
                if (config === null || config === void 0 ? void 0 : config.initializeStore) {
                    const initializeStoreFn$ = (0, utils_1.loadFromModuleExportExpression)(config.initializeStore, {
                        cwd: config.baseDir,
                        defaultExportName: 'default',
                        importFn: config.importFn,
                    });
                    // eslint-disable-next-line no-void
                    void initializeStoreFn$.then(fn => fn(store));
                }
                const mockedSchema = (0, mock_1.addMocksToSchema)({
                    schema,
                    store,
                    mocks,
                    resolvers,
                    preserveResolvers: config === null || config === void 0 ? void 0 : config.preserveResolvers,
                });
                mockedSchemas.add(mockedSchema);
                replaceSchema(mockedSchema);
            },
            onExecute({ setExecuteFn }) {
                setExecuteFn(graphql_1.execute);
            },
        };
    }
    return {};
}
exports.default = useMock;
