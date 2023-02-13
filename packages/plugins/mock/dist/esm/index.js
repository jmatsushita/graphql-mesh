import faker from 'faker';
import { mocks as graphqlScalarsMocks } from 'graphql-scalars';
import { addMocksToSchema, createMockStore } from '@graphql-tools/mock';
import { loadFromModuleExportExpression } from '@graphql-mesh/utils';
import { getInterpolatedStringFactory } from '@graphql-mesh/string-interpolation';
import { execute } from 'graphql';
const mockedSchemas = new WeakSet();
export default function useMock(config) {
    const configIf = config != null && 'if' in config ? config.if : true;
    if (configIf) {
        return {
            onSchemaChange({ schema, replaceSchema }) {
                var _a;
                if (mockedSchemas.has(schema)) {
                    return;
                }
                const mocks = {
                    ...graphqlScalarsMocks,
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
                                    if (service in faker) {
                                        fakerFn = () => faker[service][method]();
                                    }
                                    else {
                                        fakerFn = () => faker.fake(fieldConfig.faker || '');
                                    }
                                    resolvers[typeName] = resolvers[typeName] || {};
                                    resolvers[typeName][fieldName] = fakerFn;
                                }
                                else if (fieldConfig.custom) {
                                    const exportedVal$ = loadFromModuleExportExpression(fieldConfig.custom, {
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
                                    const getFromStoreKeyFactory = getInterpolatedStringFactory(fieldConfig.store.key);
                                    const updateStoreFactories = fieldConfig.updateStore.map(updateStoreConfig => ({
                                        updateStoreConfig,
                                        keyFactory: getInterpolatedStringFactory(updateStoreConfig.key),
                                        valueFactory: getInterpolatedStringFactory(updateStoreConfig.value),
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
                                    const keyFactory = getInterpolatedStringFactory(fieldConfig.store.key);
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
                                    if (service in faker) {
                                        fakerFn = () => faker[service][method]();
                                    }
                                    else {
                                        fakerFn = () => faker.fake(fieldConfig.faker || '');
                                    }
                                    mocks[typeName] = fakerFn;
                                }
                                else if (fieldConfig.custom) {
                                    const exportedVal$ = loadFromModuleExportExpression(fieldConfig.custom, {
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
                const store = createMockStore({ schema, mocks });
                if (config === null || config === void 0 ? void 0 : config.initializeStore) {
                    const initializeStoreFn$ = loadFromModuleExportExpression(config.initializeStore, {
                        cwd: config.baseDir,
                        defaultExportName: 'default',
                        importFn: config.importFn,
                    });
                    // eslint-disable-next-line no-void
                    void initializeStoreFn$.then(fn => fn(store));
                }
                const mockedSchema = addMocksToSchema({
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
                setExecuteFn(execute);
            },
        };
    }
    return {};
}
