"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.processConfig = void 0;
const camel_case_1 = require("camel-case");
const graphql_1 = require("graphql");
const pascal_case_1 = require("pascal-case");
const core_1 = require("@envelop/core");
const cross_helpers_1 = require("@graphql-mesh/cross-helpers");
const store_1 = require("@graphql-mesh/store");
const utils_1 = require("@graphql-mesh/utils");
const getAdditionalResolversFromTypeDefs_js_1 = require("./getAdditionalResolversFromTypeDefs.js");
const utils_js_1 = require("./utils.js");
const ENVELOP_CORE_PLUGINS_MAP = {
    maskedErrors: {
        moduleName: '@envelop/core',
        importName: 'useMaskedErrors',
        pluginFactory: core_1.useMaskedErrors,
    },
};
function getDefaultMeshStore(dir, importFn, artifactsDir) {
    var _a;
    const isProd = ((_a = cross_helpers_1.process.env.NODE_ENV) === null || _a === void 0 ? void 0 : _a.toLowerCase()) === 'production';
    const storeStorageAdapter = isProd
        ? new store_1.FsStoreStorageAdapter({
            cwd: dir,
            importFn,
            fileType: 'ts',
        })
        : new store_1.InMemoryStoreStorageAdapter();
    return new store_1.MeshStore(cross_helpers_1.path.resolve(dir, artifactsDir), storeStorageAdapter, {
        /**
         * TODO:
         * `mesh start` => { readonly: true, validate: false }
         * `mesh dev` => { readonly: false, validate: true } => validation error should show a prompt for confirmation
         * `mesh validate` => { readonly: true, validate: true } => should fetch from remote and try to update
         * readonly
         */
        readonly: isProd,
        validate: false,
    });
}
async function processConfig(config, options) {
    var _a, _b, _c;
    if (config.skipSSLValidation) {
        cross_helpers_1.process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
    }
    const importCodes = new Set([
        `import type { GetMeshOptions } from '@graphql-mesh/runtime';`,
        `import type { YamlConfig } from '@graphql-mesh/types';`,
    ]);
    const codes = new Set([
        `export const rawServeConfig: YamlConfig.Config['serve'] = ${JSON.stringify(config.serve)} as any`,
        `export async function getMeshOptions(): Promise<GetMeshOptions> {`,
    ]);
    const { dir, importFn = utils_1.defaultImportFn, store: providedStore, artifactsDir, additionalPackagePrefixes = [], } = options || {};
    if (config.require) {
        await Promise.all(config.require.map(mod => importFn(mod)));
        for (const mod of config.require) {
            importCodes.add(`import '${mod}';`);
        }
    }
    const rootStore = providedStore || getDefaultMeshStore(dir, importFn, artifactsDir || '.mesh');
    const { pubsub, importCode: pubsubImportCode, code: pubsubCode, } = await (0, utils_js_1.resolvePubSub)(config.pubsub, importFn, dir, additionalPackagePrefixes);
    importCodes.add(pubsubImportCode);
    codes.add(pubsubCode);
    const sourcesStore = rootStore.child('sources');
    codes.add(`const sourcesStore = rootStore.child('sources');`);
    const { logger, importCode: loggerImportCode, code: loggerCode, } = await (0, utils_js_1.resolveLogger)(config.logger, importFn, dir, additionalPackagePrefixes, options === null || options === void 0 ? void 0 : options.initialLoggerPrefix);
    importCodes.add(loggerImportCode);
    codes.add(loggerCode);
    const { cache, importCode: cacheImportCode, code: cacheCode, } = await (0, utils_js_1.resolveCache)(config.cache, importFn, rootStore, dir, pubsub, logger, additionalPackagePrefixes);
    importCodes.add(cacheImportCode);
    codes.add(cacheCode);
    const { fetchFn, importCode: fetchFnImportCode, code: fetchFnCode, } = await (0, utils_js_1.resolveCustomFetch)({
        fetchConfig: config.customFetch,
        cache,
        importFn,
        cwd: dir,
        additionalPackagePrefixes,
    });
    importCodes.add(fetchFnImportCode);
    codes.add(fetchFnCode);
    importCodes.add(`import { MeshResolvedSource } from '@graphql-mesh/runtime';`);
    codes.add(`const sources: MeshResolvedSource[] = [];`);
    importCodes.add(`import { MeshTransform, MeshPlugin } from '@graphql-mesh/types';`);
    codes.add(`const transforms: MeshTransform[] = [];`);
    codes.add(`const additionalEnvelopPlugins: MeshPlugin<any>[] = [];`);
    const [sources, transforms, additionalEnvelopPlugins, additionalTypeDefs, additionalResolvers, documents,] = await Promise.all([
        Promise.all(config.sources.map(async (source, sourceIndex) => {
            const handlerName = Object.keys(source.handler)[0].toString();
            const handlerConfig = source.handler[handlerName];
            const handlerVariableName = (0, camel_case_1.camelCase)(`${source.name}_Handler`);
            const transformsVariableName = (0, camel_case_1.camelCase)(`${source.name}_Transforms`);
            codes.add(`const ${transformsVariableName} = [];`);
            const [handler, transforms] = await Promise.all([
                await (0, utils_js_1.getPackage)({
                    name: handlerName,
                    type: 'handler',
                    importFn,
                    cwd: dir,
                    additionalPrefixes: additionalPackagePrefixes,
                }).then(({ resolved: HandlerCtor, moduleName }) => {
                    if (options.generateCode) {
                        const handlerImportName = (0, pascal_case_1.pascalCase)(handlerName + '_Handler');
                        importCodes.add(`import ${handlerImportName} from ${JSON.stringify(moduleName)}`);
                        codes.add(`const ${handlerVariableName} = new ${handlerImportName}({
              name: ${JSON.stringify(source.name)},
              config: ${JSON.stringify(handlerConfig)},
              baseDir,
              cache,
              pubsub,
              store: sourcesStore.child(${JSON.stringify(source.name)}),
              logger: logger.child(${JSON.stringify(source.name)}),
              importFn,
            });`);
                    }
                    return new HandlerCtor({
                        name: source.name,
                        config: handlerConfig,
                        baseDir: dir,
                        cache,
                        pubsub,
                        store: sourcesStore.child(source.name),
                        logger: logger.child(source.name),
                        importFn,
                    });
                }),
                Promise.all((source.transforms || []).map(async (t, transformIndex) => {
                    const transformName = Object.keys(t)[0].toString();
                    const transformConfig = t[transformName];
                    const { resolved: TransformCtor, moduleName } = await (0, utils_js_1.getPackage)({
                        name: transformName,
                        type: 'transform',
                        importFn,
                        cwd: dir,
                        additionalPrefixes: additionalPackagePrefixes,
                    });
                    if (options.generateCode) {
                        const transformImportName = (0, pascal_case_1.pascalCase)(transformName + '_Transform');
                        importCodes.add(`import ${transformImportName} from ${JSON.stringify(moduleName)};`);
                        codes.add(`${transformsVariableName}[${transformIndex}] = new ${transformImportName}({
                  apiName: ${JSON.stringify(source.name)},
                  config: ${JSON.stringify(transformConfig)},
                  baseDir,
                  cache,
                  pubsub,
                  importFn,
                  logger,
                });`);
                    }
                    return new TransformCtor({
                        apiName: source.name,
                        config: transformConfig,
                        baseDir: dir,
                        cache,
                        pubsub,
                        importFn,
                        logger,
                    });
                })),
            ]);
            if (options.generateCode) {
                codes.add(`sources[${sourceIndex}] = {
          name: '${source.name}',
          handler: ${handlerVariableName},
          transforms: ${transformsVariableName}
        }`);
            }
            return {
                name: source.name,
                handler,
                transforms,
            };
        })),
        Promise.all(((_a = config.transforms) === null || _a === void 0 ? void 0 : _a.map(async (t, transformIndex) => {
            const transformName = Object.keys(t)[0].toString();
            const transformConfig = t[transformName];
            const { resolved: TransformLibrary, moduleName } = await (0, utils_js_1.getPackage)({
                name: transformName,
                type: 'transform',
                importFn,
                cwd: dir,
                additionalPrefixes: additionalPackagePrefixes,
            });
            if (options.generateCode) {
                const transformImportName = (0, pascal_case_1.pascalCase)(transformName + '_Transform');
                importCodes.add(`import ${transformImportName} from ${JSON.stringify(moduleName)};`);
                codes.add(`transforms[${transformIndex}] = new (${transformImportName} as any)({
            apiName: '',
            config: ${JSON.stringify(transformConfig)},
            baseDir,
            cache,
            pubsub,
            importFn,
            logger,
          })`);
            }
            return new TransformLibrary({
                apiName: '',
                config: transformConfig,
                baseDir: dir,
                cache,
                pubsub,
                importFn,
                logger,
            });
        })) || []),
        Promise.all(((_b = config.plugins) === null || _b === void 0 ? void 0 : _b.map(async (p, pluginIndex) => {
            const pluginName = Object.keys(p)[0].toString();
            const pluginConfig = p[pluginName];
            if (ENVELOP_CORE_PLUGINS_MAP[pluginName] != null) {
                const { importName, moduleName, pluginFactory } = ENVELOP_CORE_PLUGINS_MAP[pluginName];
                if (options.generateCode) {
                    importCodes.add(`import { ${importName} } from ${JSON.stringify(moduleName)};`);
                    codes.add(`additionalEnvelopPlugins[${pluginIndex}] = await ${importName}(${JSON.stringify(pluginConfig, null, 2)});`);
                }
                return pluginFactory(pluginConfig);
            }
            const { resolved: possiblePluginFactory, moduleName } = await (0, utils_js_1.getPackage)({
                name: pluginName,
                type: 'plugin',
                importFn,
                cwd: dir,
                additionalPrefixes: [
                    ...additionalPackagePrefixes,
                    '@envelop/',
                    '@graphql-yoga/plugin-',
                    '@escape.tech/graphql-armor-',
                ],
            });
            let pluginFactory;
            if (typeof possiblePluginFactory === 'function') {
                pluginFactory = possiblePluginFactory;
                if (options.generateCode) {
                    const importName = (0, pascal_case_1.pascalCase)('use_' + pluginName);
                    importCodes.add(`import ${importName} from ${JSON.stringify(moduleName)};`);
                    codes.add(`additionalEnvelopPlugins[${pluginIndex}] = await ${importName}({
          ...(${JSON.stringify(pluginConfig, null, 2)}),
          logger: logger.child(${JSON.stringify(pluginName)}),
          cache,
          pubsub,
          baseDir,
          importFn,
        })`);
                }
            }
            else {
                Object.keys(possiblePluginFactory).forEach(importName => {
                    if ((importName.toString().startsWith('use') ||
                        importName.toString().endsWith('Plugin')) &&
                        typeof possiblePluginFactory[importName] === 'function') {
                        pluginFactory = possiblePluginFactory[importName];
                        importName = importName.toString();
                        if (options.generateCode) {
                            importCodes.add(`import { ${importName} } from ${JSON.stringify(moduleName)};`);
                            codes.add(`additionalEnvelopPlugins[${pluginIndex}] = await ${importName}(${JSON.stringify(pluginConfig, null, 2)});`);
                        }
                    }
                });
            }
            return pluginFactory({
                ...pluginConfig,
                logger: logger.child(pluginName),
                cache,
                pubsub,
                baseDir: dir,
                importFn,
            });
        })) || []),
        (0, utils_js_1.resolveAdditionalTypeDefs)(dir, config.additionalTypeDefs).then(additionalTypeDefs => {
            if (options.generateCode) {
                codes.add(`const additionalTypeDefs = [${(additionalTypeDefs || []).map(parsedTypeDefs => `parse(${JSON.stringify((0, graphql_1.print)(parsedTypeDefs))}),`)}] as any[];`);
                if (additionalTypeDefs === null || additionalTypeDefs === void 0 ? void 0 : additionalTypeDefs.length) {
                    importCodes.add(`import { parse } from 'graphql';`);
                }
            }
            return additionalTypeDefs;
        }),
        (options === null || options === void 0 ? void 0 : options.ignoreAdditionalResolvers)
            ? []
            : (0, utils_1.resolveAdditionalResolvers)(dir, config.additionalResolvers, importFn, pubsub),
        (0, utils_js_1.resolveDocuments)(config.documents, dir),
    ]);
    if (options.generateCode) {
        if ((_c = config.additionalResolvers) === null || _c === void 0 ? void 0 : _c.length) {
            codes.add(`const additionalResolvers = await Promise.all([
        ${config.additionalResolvers
                .map(additionalResolverDefinition => {
                if (typeof additionalResolverDefinition === 'string') {
                    return `import(${JSON.stringify(cross_helpers_1.path.join('..', additionalResolverDefinition).split('\\').join('/'))})
            .then(m => m.resolvers || m.default || m)`;
                }
                else {
                    importCodes.add(`import { resolveAdditionalResolversWithoutImport } from '@graphql-mesh/utils';`);
                    return `resolveAdditionalResolversWithoutImport(
            ${JSON.stringify(additionalResolverDefinition, null, 2)}
          )`;
                }
            })
                .join(',\n')}
      ]);`);
        }
        else {
            codes.add(`const additionalResolvers = [] as any[]`);
        }
    }
    if (additionalTypeDefs === null || additionalTypeDefs === void 0 ? void 0 : additionalTypeDefs.length) {
        const additionalResolversConfigFromTypeDefs = (0, getAdditionalResolversFromTypeDefs_js_1.getAdditionalResolversFromTypeDefs)(additionalTypeDefs);
        if (additionalResolversConfigFromTypeDefs === null || additionalResolversConfigFromTypeDefs === void 0 ? void 0 : additionalResolversConfigFromTypeDefs.length) {
            const resolveToDirectiveDefinition = /* GraphQL */ `
        scalar ResolveToSourceArgs
        directive @resolveTo(
          requiredSelectionSet: String
          sourceName: String!
          sourceTypeName: String!
          sourceFieldName: String!
          sourceSelectionSet: String
          sourceArgs: ResolveToSourceArgs
          keyField: String
          keysArg: String
          pubsubTopic: String
          filterBy: String
          additionalArgs: ResolveToSourceArgs
          result: String
          resultType: String
        ) on FIELD_DEFINITION
      `;
            const resolvedAdditionalResolvers = await (0, utils_1.resolveAdditionalResolvers)(dir, additionalResolversConfigFromTypeDefs, importFn, pubsub);
            additionalTypeDefs.unshift((0, graphql_1.parse)(resolveToDirectiveDefinition));
            additionalResolvers.push(...resolvedAdditionalResolvers);
            if (options.generateCode && resolvedAdditionalResolvers.length) {
                importCodes.add(`import { resolveAdditionalResolvers } from '@graphql-mesh/utils';`);
                codes.add(`additionalTypeDefs.unshift(parse(/* GraphQL */\`${resolveToDirectiveDefinition}\`))`);
                codes.add(`const additionalResolversFromTypeDefs = await resolveAdditionalResolvers(
          baseDir,
          ${JSON.stringify(additionalResolversConfigFromTypeDefs)},
          importFn,
          pubsub
        );`);
                codes.add(`additionalResolvers.push(...additionalResolversFromTypeDefs)`);
            }
        }
    }
    let mergerName = config.merger;
    // Decide what is the default merger
    if (!mergerName) {
        if (config.sources.length > 1) {
            mergerName = 'stitching';
        }
        else {
            // eslint-disable-next-line no-labels
            resolversLoop: for (const resolversObj of additionalResolvers || []) {
                for (const typeName in resolversObj || {}) {
                    const fieldResolvers = resolversObj[typeName];
                    if (typeof fieldResolvers === 'object') {
                        for (const fieldName in fieldResolvers) {
                            const fieldResolveObj = fieldResolvers[fieldName];
                            if (typeof fieldResolveObj === 'object') {
                                // selectionSet needs stitching merger even if there is a single source
                                if (fieldResolveObj.selectionSet != null) {
                                    mergerName = 'stitching';
                                    // eslint-disable-next-line no-labels
                                    break resolversLoop;
                                }
                            }
                        }
                    }
                }
            }
            if (!mergerName) {
                mergerName = 'bare';
            }
        }
    }
    const { resolved: Merger, moduleName: mergerModuleName } = await (0, utils_js_1.getPackage)({
        name: mergerName,
        type: 'merger',
        importFn,
        cwd: dir,
        additionalPrefixes: additionalPackagePrefixes,
    });
    if (options.generateCode) {
        const mergerImportName = (0, pascal_case_1.pascalCase)(`${mergerName}Merger`);
        importCodes.add(`import ${mergerImportName} from ${JSON.stringify(mergerModuleName)};`);
        codes.add(`const merger = new(${mergerImportName} as any)({
        cache,
        pubsub,
        logger: logger.child('${mergerName}Merger'),
        store: rootStore.child('${mergerName}Merger')
      })`);
    }
    const merger = new Merger({
        cache,
        pubsub,
        logger: logger.child(`${mergerName}Merger`),
        store: rootStore.child(`${mergerName}Merger`),
    });
    if (config.additionalEnvelopPlugins) {
        codes.add(`const importedAdditionalEnvelopPlugins = await import(${JSON.stringify(cross_helpers_1.path.join('..', config.additionalEnvelopPlugins).split('\\').join('/'))}).then(m => m.default || m);`);
        const importedAdditionalEnvelopPlugins = await importFn(cross_helpers_1.path.isAbsolute(config.additionalEnvelopPlugins)
            ? config.additionalEnvelopPlugins
            : cross_helpers_1.path.join(dir, config.additionalEnvelopPlugins));
        if (typeof importedAdditionalEnvelopPlugins === 'function') {
            const factoryResult = await importedAdditionalEnvelopPlugins(config);
            if (Array.isArray(factoryResult)) {
                if (options.generateCode) {
                    codes.add(`additionalEnvelopPlugins.push(...(await importedAdditionalEnvelopPlugins()));`);
                }
                additionalEnvelopPlugins.push(...factoryResult);
            }
            else {
                if (options.generateCode) {
                    codes.add(`additionalEnvelopPlugins.push(await importedAdditionalEnvelopPlugins());`);
                }
                additionalEnvelopPlugins.push(factoryResult);
            }
        }
        else {
            if (Array.isArray(importedAdditionalEnvelopPlugins)) {
                if (options.generateCode) {
                    codes.add(`additionalEnvelopPlugins.push(...importedAdditionalEnvelopPlugins)`);
                }
                additionalEnvelopPlugins.push(...importedAdditionalEnvelopPlugins);
            }
            else {
                if (options.generateCode) {
                    codes.add(`additionalEnvelopPlugins.push(importedAdditionalEnvelopPlugins)`);
                }
                additionalEnvelopPlugins.push(importedAdditionalEnvelopPlugins);
            }
        }
    }
    if (options.generateCode) {
        const documentVariableNames = [];
        if (documents === null || documents === void 0 ? void 0 : documents.length) {
            importCodes.add(`import { printWithCache } from '@graphql-mesh/utils';`);
            const allDocumentNodes = (0, graphql_1.concatAST)(documents.map(document => document.document || (0, utils_1.parseWithCache)(document.rawSDL)));
            (0, graphql_1.visit)(allDocumentNodes, {
                OperationDefinition(node) {
                    documentVariableNames.push((0, pascal_case_1.pascalCase)(node.name.value + '_Document'));
                },
            });
        }
        codes.add(`
  return {
    sources,
    transforms,
    additionalTypeDefs,
    additionalResolvers,
    cache,
    pubsub,
    merger,
    logger,
    additionalEnvelopPlugins,
    get documents() {
      return [
      ${documentVariableNames
            .map(documentVarName => `{
        document: ${documentVarName},
        get rawSDL() {
          return printWithCache(${documentVarName});
        },
        location: '${documentVarName}.graphql'
      }`)
            .join(',')}
    ];
    },
    fetchFn,
  };
}`);
    }
    return {
        sources,
        transforms,
        additionalTypeDefs,
        additionalResolvers,
        cache,
        merger,
        pubsub,
        config,
        documents,
        logger,
        store: rootStore,
        additionalEnvelopPlugins,
        importCodes,
        codes,
        fetchFn,
    };
}
exports.processConfig = processConfig;
