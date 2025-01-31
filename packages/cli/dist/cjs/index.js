"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.graphqlMesh = exports.DEFAULT_CLI_PARAMS = exports.handleFatalError = exports.findAndParseConfig = exports.serveMesh = exports.generateTsArtifacts = void 0;
const tslib_1 = require("tslib");
const config_js_1 = require("./config.js");
Object.defineProperty(exports, "findAndParseConfig", { enumerable: true, get: function () { return config_js_1.findAndParseConfig; } });
const runtime_1 = require("@graphql-mesh/runtime");
const ts_artifacts_js_1 = require("./commands/ts-artifacts.js");
Object.defineProperty(exports, "generateTsArtifacts", { enumerable: true, get: function () { return ts_artifacts_js_1.generateTsArtifacts; } });
const serve_js_1 = require("./commands/serve/serve.js");
Object.defineProperty(exports, "serveMesh", { enumerable: true, get: function () { return serve_js_1.serveMesh; } });
const cross_helpers_1 = require("@graphql-mesh/cross-helpers");
const store_1 = require("@graphql-mesh/store");
const utils_1 = require("@graphql-mesh/utils");
const handleFatalError_js_1 = require("./handleFatalError.js");
Object.defineProperty(exports, "handleFatalError", { enumerable: true, get: function () { return handleFatalError_js_1.handleFatalError; } });
const yargs_1 = tslib_1.__importDefault(require("yargs"));
const helpers_1 = require("yargs/helpers");
const ts_node_1 = require("ts-node");
const tsconfig_paths_1 = require("tsconfig-paths");
const dotenv_1 = require("dotenv");
const utils_2 = require("@graphql-tools/utils");
const json5_1 = tslib_1.__importDefault(require("json5"));
exports.DEFAULT_CLI_PARAMS = {
    commandName: 'mesh',
    initialLoggerPrefix: '🕸️  Mesh',
    configName: 'mesh',
    artifactsDir: '.mesh',
    serveMessage: 'Serving GraphQL Mesh',
    playgroundTitle: 'GraphiQL Mesh',
    builtMeshFactoryName: 'getBuiltMesh',
    builtMeshSDKFactoryName: 'getMeshSDK',
    devServerCommand: 'dev',
    prodServerCommand: 'start',
    buildArtifactsCommand: 'build',
    sourceServerCommand: 'serve-source',
    validateCommand: 'validate',
    additionalPackagePrefixes: [],
};
async function graphqlMesh(cliParams = exports.DEFAULT_CLI_PARAMS, args = (0, helpers_1.hideBin)(cross_helpers_1.process.argv), cwdPath = cross_helpers_1.process.cwd()) {
    let baseDir = cwdPath;
    let logger = new utils_1.DefaultLogger(cliParams.initialLoggerPrefix);
    return (0, yargs_1.default)(args)
        .help()
        .option('r', {
        alias: 'require',
        describe: 'Loads specific require.extensions before running the codegen and reading the configuration',
        type: 'array',
        default: [],
        coerce: (externalModules) => Promise.all(externalModules.map(module => {
            const localModulePath = cross_helpers_1.path.resolve(baseDir, module);
            const islocalModule = cross_helpers_1.fs.existsSync(localModulePath);
            return (0, utils_1.defaultImportFn)(islocalModule ? localModulePath : module);
        })),
    })
        .option('dir', {
        describe: 'Modified the base directory to use for looking for ' +
            cliParams.configName +
            ' config file',
        type: 'string',
        default: baseDir,
        coerce: dir => {
            var _a;
            if (cross_helpers_1.path.isAbsolute(dir)) {
                baseDir = dir;
            }
            else {
                baseDir = cross_helpers_1.path.resolve(cwdPath, dir);
            }
            const tsConfigPath = cross_helpers_1.path.join(baseDir, 'tsconfig.json');
            const tsConfigExists = cross_helpers_1.fs.existsSync(tsConfigPath);
            (0, ts_node_1.register)({
                transpileOnly: true,
                typeCheck: false,
                dir: baseDir,
                require: ['graphql-import-node/register'],
                compilerOptions: {
                    module: 'commonjs',
                },
            });
            if (tsConfigExists) {
                try {
                    const tsConfigStr = cross_helpers_1.fs.readFileSync(tsConfigPath, 'utf-8');
                    const tsConfig = json5_1.default.parse(tsConfigStr);
                    if ((_a = tsConfig.compilerOptions) === null || _a === void 0 ? void 0 : _a.paths) {
                        (0, tsconfig_paths_1.register)({
                            baseUrl: baseDir,
                            paths: tsConfig.compilerOptions.paths,
                        });
                    }
                }
                catch (e) {
                    logger.warn(`Unable to read TSConfig file ${tsConfigPath};\n`, e);
                }
            }
            if (cross_helpers_1.fs.existsSync(cross_helpers_1.path.join(baseDir, '.env'))) {
                (0, dotenv_1.config)({
                    path: cross_helpers_1.path.join(baseDir, '.env'),
                });
            }
        },
    })
        .command(cliParams.devServerCommand, 'Serves a GraphQL server with GraphQL interface by building artifacts on the fly', builder => {
        builder.option('port', {
            type: 'number',
        });
    }, async (args) => {
        try {
            const outputDir = cross_helpers_1.path.join(baseDir, cliParams.artifactsDir);
            cross_helpers_1.process.env.NODE_ENV = 'development';
            const meshConfig = await (0, config_js_1.findAndParseConfig)({
                dir: baseDir,
                artifactsDir: cliParams.artifactsDir,
                configName: cliParams.configName,
                additionalPackagePrefixes: cliParams.additionalPackagePrefixes,
                initialLoggerPrefix: cliParams.initialLoggerPrefix,
            });
            logger = meshConfig.logger;
            const meshInstance$ = (0, runtime_1.getMesh)(meshConfig);
            // We already handle Mesh instance errors inside `serveMesh`
            // eslint-disable-next-line @typescript-eslint/no-floating-promises
            meshInstance$.then(({ schema }) => (0, utils_1.writeFile)(cross_helpers_1.path.join(outputDir, 'schema.graphql'), (0, utils_2.printSchemaWithDirectives)(schema)).catch(e => logger.error(`An error occured while writing the schema file: `, e)));
            // eslint-disable-next-line @typescript-eslint/no-floating-promises
            meshInstance$.then(({ schema, rawSources }) => (0, ts_artifacts_js_1.generateTsArtifacts)({
                unifiedSchema: schema,
                rawSources,
                mergerType: meshConfig.merger.name,
                documents: meshConfig.documents,
                flattenTypes: false,
                importedModulesSet: new Set(),
                baseDir,
                meshConfigImportCodes: new Set([
                    `import { findAndParseConfig } from '@graphql-mesh/cli';`,
                    `import { createMeshHTTPHandler, MeshHTTPHandler } from '@graphql-mesh/http';`,
                ]),
                meshConfigCodes: new Set([
                    `
export function getMeshOptions() {
  console.warn('WARNING: These artifacts are built for development mode. Please run "${cliParams.commandName} build" to build production artifacts');
  return findAndParseConfig({
    dir: baseDir,
    artifactsDir: ${JSON.stringify(cliParams.artifactsDir)},
    configName: ${JSON.stringify(cliParams.configName)},
    additionalPackagePrefixes: ${JSON.stringify(cliParams.additionalPackagePrefixes)},
    initialLoggerPrefix: ${JSON.stringify(cliParams.initialLoggerPrefix)},
  });
}

export function createBuiltMeshHTTPHandler(): MeshHTTPHandler<MeshContext> {
  return createMeshHTTPHandler<MeshContext>({
    baseDir,
    getBuiltMesh: ${cliParams.builtMeshFactoryName},
    rawServeConfig: ${JSON.stringify(meshConfig.config.serve)},
  })
}
              `.trim(),
                ]),
                logger,
                sdkConfig: meshConfig.config.sdk,
                fileType: 'ts',
                codegenConfig: meshConfig.config.codegen,
            }, cliParams).catch(e => {
                logger.error(`An error occurred while building the artifacts: ${e.stack || e.message}`);
            }));
            const serveMeshOptions = {
                baseDir,
                argsPort: args.port,
                getBuiltMesh: () => meshInstance$,
                logger: meshConfig.logger.child('Server'),
                rawServeConfig: meshConfig.config.serve,
            };
            await (0, serve_js_1.serveMesh)(serveMeshOptions, cliParams);
        }
        catch (e) {
            (0, handleFatalError_js_1.handleFatalError)(e, logger);
        }
    })
        .command(cliParams.prodServerCommand, 'Serves a GraphQL server with GraphQL interface based on your generated artifacts', builder => {
        builder.option('port', {
            type: 'number',
        });
    }, async (args) => {
        try {
            const builtMeshArtifactsPath = cross_helpers_1.path.join(baseDir, cliParams.artifactsDir);
            if (!(await (0, utils_1.pathExists)(builtMeshArtifactsPath))) {
                throw new Error(`Seems like you haven't build the artifacts yet to start production server! You need to build artifacts first with "${cliParams.commandName} build" command!`);
            }
            cross_helpers_1.process.env.NODE_ENV = 'production';
            const mainModule = cross_helpers_1.path.join(builtMeshArtifactsPath, 'index');
            const builtMeshArtifacts = await (0, utils_1.defaultImportFn)(mainModule);
            const getMeshOptions = await builtMeshArtifacts.getMeshOptions();
            logger = getMeshOptions.logger;
            const rawServeConfig = builtMeshArtifacts.rawServeConfig;
            const serveMeshOptions = {
                baseDir,
                argsPort: args.port,
                getBuiltMesh: () => (0, runtime_1.getMesh)(getMeshOptions),
                logger: getMeshOptions.logger.child('Server'),
                rawServeConfig,
            };
            await (0, serve_js_1.serveMesh)(serveMeshOptions, cliParams);
        }
        catch (e) {
            (0, handleFatalError_js_1.handleFatalError)(e, logger);
        }
    })
        .command(cliParams.validateCommand, 'Validates artifacts', builder => { }, async (args) => {
        let destroy;
        try {
            if (!(await (0, utils_1.pathExists)(cross_helpers_1.path.join(baseDir, cliParams.artifactsDir)))) {
                throw new Error(`You cannot validate artifacts now because you don't have built artifacts yet! You need to build artifacts first with "${cliParams.commandName} build" command!`);
            }
            const store = new store_1.MeshStore(cliParams.artifactsDir, new store_1.FsStoreStorageAdapter({
                cwd: baseDir,
                importFn: utils_1.defaultImportFn,
                fileType: 'ts',
            }), {
                readonly: false,
                validate: true,
            });
            logger.info(`Reading the configuration`);
            const meshConfig = await (0, config_js_1.findAndParseConfig)({
                dir: baseDir,
                store,
                importFn: utils_1.defaultImportFn,
                ignoreAdditionalResolvers: true,
                artifactsDir: cliParams.artifactsDir,
                configName: cliParams.configName,
                additionalPackagePrefixes: cliParams.additionalPackagePrefixes,
                initialLoggerPrefix: cliParams.initialLoggerPrefix,
            });
            logger = meshConfig.logger;
            logger.info(`Generating the unified schema`);
            const mesh = await (0, runtime_1.getMesh)(meshConfig);
            logger.info(`Artifacts have been validated successfully`);
            destroy = mesh === null || mesh === void 0 ? void 0 : mesh.destroy;
        }
        catch (e) {
            (0, handleFatalError_js_1.handleFatalError)(e, logger);
        }
        if (destroy) {
            destroy();
        }
    })
        .command(cliParams.buildArtifactsCommand, 'Builds artifacts', builder => {
        builder.option('fileType', {
            type: 'string',
            choices: ['json', 'ts', 'js'],
            default: 'ts',
        });
        builder.option('throwOnInvalidConfig', {
            type: 'boolean',
            default: false,
        });
    }, async (args) => {
        try {
            const outputDir = cross_helpers_1.path.join(baseDir, cliParams.artifactsDir);
            logger.info('Cleaning existing artifacts');
            await (0, utils_1.rmdirs)(outputDir);
            const importedModulesSet = new Set();
            const importPromises = [];
            const importFn = (moduleId, noCache) => {
                const importPromise = (0, utils_1.defaultImportFn)(moduleId)
                    .catch(e => {
                    if (e.message.includes('getter')) {
                        return e;
                    }
                    else {
                        throw e;
                    }
                })
                    .then(m => {
                    if (!noCache) {
                        importedModulesSet.add(moduleId);
                    }
                    return m;
                });
                importPromises.push(importPromise.catch(() => { }));
                return importPromise;
            };
            await Promise.all(importPromises);
            const store = new store_1.MeshStore(cliParams.artifactsDir, new store_1.FsStoreStorageAdapter({
                cwd: baseDir,
                importFn,
                fileType: args.fileType,
            }), {
                readonly: false,
                validate: false,
            });
            logger.info(`Reading the configuration`);
            const meshConfig = await (0, config_js_1.findAndParseConfig)({
                dir: baseDir,
                store,
                importFn,
                ignoreAdditionalResolvers: true,
                artifactsDir: cliParams.artifactsDir,
                configName: cliParams.configName,
                additionalPackagePrefixes: cliParams.additionalPackagePrefixes,
                generateCode: true,
                initialLoggerPrefix: cliParams.initialLoggerPrefix,
                throwOnInvalidConfig: args.throwOnInvalidConfig,
            });
            logger = meshConfig.logger;
            logger.info(`Generating the unified schema`);
            const { schema, destroy, rawSources } = await (0, runtime_1.getMesh)(meshConfig);
            await (0, utils_1.writeFile)(cross_helpers_1.path.join(outputDir, 'schema.graphql'), (0, utils_2.printSchemaWithDirectives)(schema));
            logger.info(`Generating artifacts`);
            meshConfig.importCodes.add(`import { createMeshHTTPHandler, MeshHTTPHandler } from '@graphql-mesh/http';`);
            meshConfig.codes.add(`
export function createBuiltMeshHTTPHandler(): MeshHTTPHandler<MeshContext> {
  return createMeshHTTPHandler<MeshContext>({
    baseDir,
    getBuiltMesh: ${cliParams.builtMeshFactoryName},
    rawServeConfig: ${JSON.stringify(meshConfig.config.serve)},
  })
}
`);
            await (0, ts_artifacts_js_1.generateTsArtifacts)({
                unifiedSchema: schema,
                rawSources,
                mergerType: meshConfig.merger.name,
                documents: meshConfig.documents,
                flattenTypes: false,
                importedModulesSet,
                baseDir,
                meshConfigImportCodes: meshConfig.importCodes,
                meshConfigCodes: meshConfig.codes,
                logger,
                sdkConfig: meshConfig.config.sdk,
                fileType: args.fileType,
                codegenConfig: meshConfig.config.codegen,
            }, cliParams);
            logger.info(`Cleanup`);
            destroy();
            logger.info('Done! => ' + outputDir);
        }
        catch (e) {
            (0, handleFatalError_js_1.handleFatalError)(e, logger);
        }
    })
        .command(cliParams.sourceServerCommand + ' <source>', 'Serves specific source in development mode', builder => {
        builder.positional('source', {
            type: 'string',
            requiresArg: true,
        });
    }, async (args) => {
        cross_helpers_1.process.env.NODE_ENV = 'development';
        const meshConfig = await (0, config_js_1.findAndParseConfig)({
            dir: baseDir,
            artifactsDir: cliParams.artifactsDir,
            configName: cliParams.configName,
            additionalPackagePrefixes: cliParams.additionalPackagePrefixes,
            initialLoggerPrefix: cliParams.initialLoggerPrefix,
        });
        logger = meshConfig.logger;
        const sourceIndex = meshConfig.sources.findIndex(rawSource => rawSource.name === args.source);
        if (sourceIndex === -1) {
            throw new Error(`Source ${args.source} not found`);
        }
        const meshInstance$ = (0, runtime_1.getMesh)({
            ...meshConfig,
            additionalTypeDefs: undefined,
            additionalResolvers: [],
            transforms: [],
            sources: [meshConfig.sources[sourceIndex]],
        });
        const serveMeshOptions = {
            baseDir,
            argsPort: 4000 + sourceIndex + 1,
            getBuiltMesh: () => meshInstance$,
            logger: meshConfig.logger.child('Server'),
            rawServeConfig: meshConfig.config.serve,
            playgroundTitle: `${args.source} GraphiQL`,
        };
        await (0, serve_js_1.serveMesh)(serveMeshOptions, cliParams);
    }).argv;
}
exports.graphqlMesh = graphqlMesh;
