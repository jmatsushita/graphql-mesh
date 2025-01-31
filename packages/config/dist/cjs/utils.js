"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveLogger = exports.resolveDocuments = exports.resolvePubSub = exports.resolveCache = exports.resolveCustomFetch = exports.resolveAdditionalTypeDefs = exports.getPackage = void 0;
const cross_helpers_1 = require("@graphql-mesh/cross-helpers");
const utils_1 = require("@graphql-tools/utils");
const param_case_1 = require("param-case");
const load_1 = require("@graphql-tools/load");
const graphql_file_loader_1 = require("@graphql-tools/graphql-file-loader");
const utils_2 = require("@graphql-mesh/utils");
const fetch_1 = require("@whatwg-node/fetch");
const code_file_loader_1 = require("@graphql-tools/code-file-loader");
async function getPackage({ name, type, importFn, cwd, additionalPrefixes = [], }) {
    const casedName = (0, param_case_1.paramCase)(name);
    const casedType = (0, param_case_1.paramCase)(type);
    const prefixes = ['@graphql-mesh/', ...additionalPrefixes];
    const initialPossibleNames = [
        casedName,
        `${casedName}-${casedType}`,
        `${casedType}-${casedName}`,
        casedType,
    ];
    const possibleNames = [];
    for (const prefix of prefixes) {
        for (const possibleName of initialPossibleNames) {
            possibleNames.push(`${prefix}${possibleName}`);
        }
    }
    for (const possibleName of initialPossibleNames) {
        possibleNames.push(possibleName);
    }
    if (name.includes('-')) {
        possibleNames.push(name);
    }
    const possibleModules = possibleNames.concat(cross_helpers_1.path.resolve(cwd, name));
    for (const moduleName of possibleModules) {
        try {
            const exported = await importFn(moduleName, true);
            const resolved = exported.default || exported;
            return {
                moduleName,
                resolved,
            };
        }
        catch (err) {
            const error = err;
            if (!error.message.includes(`Cannot find module '${moduleName}'`) &&
                !error.message.includes(`Cannot find package '${moduleName}'`) &&
                !error.message.includes(`Could not locate module`)) {
                throw new Error(`Unable to load ${type} matching ${name} while resolving ${moduleName}: ${error.stack}`);
            }
        }
    }
    throw new Error(`Unable to find ${type} matching ${name}`);
}
exports.getPackage = getPackage;
async function resolveAdditionalTypeDefs(baseDir, additionalTypeDefs) {
    if (additionalTypeDefs) {
        const sources = await (0, load_1.loadTypedefs)(additionalTypeDefs, {
            cwd: baseDir,
            loaders: [new code_file_loader_1.CodeFileLoader(), new graphql_file_loader_1.GraphQLFileLoader()],
        });
        return sources.map(source => source.document ||
            (0, utils_2.parseWithCache)(source.rawSDL || (0, utils_1.printSchemaWithDirectives)(source.schema)));
    }
    return undefined;
}
exports.resolveAdditionalTypeDefs = resolveAdditionalTypeDefs;
async function resolveCustomFetch({ fetchConfig, importFn, cwd, cache, additionalPackagePrefixes, }) {
    let importCode = '';
    if (!fetchConfig) {
        importCode += `import { fetch as fetchFn } from '@whatwg-node/fetch';\n`;
        return {
            fetchFn: fetch_1.fetch,
            importCode,
            code: ``,
        };
    }
    const { moduleName, resolved: fetchFn } = await getPackage({
        name: fetchConfig,
        type: 'fetch',
        importFn,
        cwd,
        additionalPrefixes: additionalPackagePrefixes,
    });
    importCode += `import fetchFn from ${JSON.stringify(moduleName)};\n`;
    return {
        fetchFn,
        importCode,
        code: '',
    };
}
exports.resolveCustomFetch = resolveCustomFetch;
async function resolveCache(cacheConfig = {
    localforage: {},
}, importFn, rootStore, cwd, pubsub, logger, additionalPackagePrefixes) {
    const cacheName = Object.keys(cacheConfig)[0].toString();
    const config = cacheConfig[cacheName];
    const { moduleName, resolved: Cache } = await getPackage({
        name: cacheName,
        type: 'cache',
        importFn,
        cwd,
        additionalPrefixes: additionalPackagePrefixes,
    });
    const cache = new Cache({
        ...config,
        importFn,
        store: rootStore.child('cache'),
        pubsub,
        logger,
    });
    const code = `const cache = new (MeshCache as any)({
      ...(${JSON.stringify(config)} as any),
      importFn,
      store: rootStore.child('cache'),
      pubsub,
      logger,
    } as any)`;
    const importCode = `import MeshCache from ${JSON.stringify(moduleName)};`;
    return {
        cache,
        importCode,
        code,
    };
}
exports.resolveCache = resolveCache;
async function resolvePubSub(pubsubYamlConfig, importFn, cwd, additionalPackagePrefixes) {
    if (pubsubYamlConfig) {
        let pubsubName;
        let pubsubConfig;
        if (typeof pubsubYamlConfig === 'string') {
            pubsubName = pubsubYamlConfig;
        }
        else {
            pubsubName = pubsubYamlConfig.name;
            pubsubConfig = pubsubYamlConfig.config;
        }
        const { moduleName, resolved: PubSub } = await getPackage({
            name: pubsubName,
            type: 'pubsub',
            importFn,
            cwd,
            additionalPrefixes: additionalPackagePrefixes,
        });
        const pubsub = new PubSub(pubsubConfig);
        const importCode = `import PubSub from ${JSON.stringify(moduleName)}`;
        const code = `const pubsub = new PubSub(${JSON.stringify(pubsubConfig)});`;
        return {
            importCode,
            code,
            pubsub,
        };
    }
    else {
        const pubsub = new utils_2.PubSub();
        const importCode = `import { PubSub } from '@graphql-mesh/utils';`;
        const code = `const pubsub = new PubSub();`;
        return {
            importCode,
            code,
            pubsub,
        };
    }
}
exports.resolvePubSub = resolvePubSub;
async function resolveDocuments(documentsConfig, cwd) {
    if (!documentsConfig) {
        return [];
    }
    return (0, load_1.loadDocuments)(documentsConfig, {
        loaders: [new code_file_loader_1.CodeFileLoader(), new graphql_file_loader_1.GraphQLFileLoader()],
        skipGraphQLImport: true,
        cwd,
    });
}
exports.resolveDocuments = resolveDocuments;
async function resolveLogger(loggerConfig, importFn, cwd, additionalPackagePrefixes, initialLoggerPrefix = '🕸️  Mesh') {
    if (typeof loggerConfig === 'string') {
        const { moduleName, resolved: logger } = await getPackage({
            name: loggerConfig,
            type: 'logger',
            importFn,
            cwd,
            additionalPrefixes: additionalPackagePrefixes,
        });
        return {
            logger,
            importCode: `import logger from ${JSON.stringify(moduleName)};`,
            code: '',
        };
    }
    const logger = new utils_2.DefaultLogger(initialLoggerPrefix);
    return {
        logger,
        importCode: `import { DefaultLogger } from '@graphql-mesh/utils';`,
        code: `const logger = new DefaultLogger(${JSON.stringify(initialLoggerPrefix)});`,
    };
}
exports.resolveLogger = resolveLogger;
