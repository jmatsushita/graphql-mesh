import { path } from '@graphql-mesh/cross-helpers';
import { printSchemaWithDirectives } from '@graphql-tools/utils';
import { paramCase } from 'param-case';
import { loadDocuments, loadTypedefs } from '@graphql-tools/load';
import { GraphQLFileLoader } from '@graphql-tools/graphql-file-loader';
import { PubSub, DefaultLogger, parseWithCache } from '@graphql-mesh/utils';
import { fetch as defaultFetch } from '@whatwg-node/fetch';
import { CodeFileLoader } from '@graphql-tools/code-file-loader';
export async function getPackage({ name, type, importFn, cwd, additionalPrefixes = [], }) {
    const casedName = paramCase(name);
    const casedType = paramCase(type);
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
    const possibleModules = possibleNames.concat(path.resolve(cwd, name));
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
export async function resolveAdditionalTypeDefs(baseDir, additionalTypeDefs) {
    if (additionalTypeDefs) {
        const sources = await loadTypedefs(additionalTypeDefs, {
            cwd: baseDir,
            loaders: [new CodeFileLoader(), new GraphQLFileLoader()],
        });
        return sources.map(source => source.document ||
            parseWithCache(source.rawSDL || printSchemaWithDirectives(source.schema)));
    }
    return undefined;
}
export async function resolveCustomFetch({ fetchConfig, importFn, cwd, cache, additionalPackagePrefixes, }) {
    let importCode = '';
    if (!fetchConfig) {
        importCode += `import { fetch as fetchFn } from '@whatwg-node/fetch';\n`;
        return {
            fetchFn: defaultFetch,
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
export async function resolveCache(cacheConfig = {
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
export async function resolvePubSub(pubsubYamlConfig, importFn, cwd, additionalPackagePrefixes) {
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
        const pubsub = new PubSub();
        const importCode = `import { PubSub } from '@graphql-mesh/utils';`;
        const code = `const pubsub = new PubSub();`;
        return {
            importCode,
            code,
            pubsub,
        };
    }
}
export async function resolveDocuments(documentsConfig, cwd) {
    if (!documentsConfig) {
        return [];
    }
    return loadDocuments(documentsConfig, {
        loaders: [new CodeFileLoader(), new GraphQLFileLoader()],
        skipGraphQLImport: true,
        cwd,
    });
}
export async function resolveLogger(loggerConfig, importFn, cwd, additionalPackagePrefixes, initialLoggerPrefix = '🕸️  Mesh') {
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
    const logger = new DefaultLogger(initialLoggerPrefix);
    return {
        logger,
        importCode: `import { DefaultLogger } from '@graphql-mesh/utils';`,
        code: `const logger = new DefaultLogger(${JSON.stringify(initialLoggerPrefix)});`,
    };
}
