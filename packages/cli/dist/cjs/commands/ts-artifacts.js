"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.compileTS = exports.generateTsArtifacts = void 0;
const tslib_1 = require("tslib");
const tsBasePlugin = tslib_1.__importStar(require("@graphql-codegen/typescript"));
const tsResolversPlugin = tslib_1.__importStar(require("@graphql-codegen/typescript-resolvers"));
const graphql_1 = require("graphql");
const core_1 = require("@graphql-codegen/core");
const pascal_case_1 = require("pascal-case");
const utils_1 = require("@graphql-tools/utils");
const tsOperationsPlugin = tslib_1.__importStar(require("@graphql-codegen/typescript-operations"));
const typescriptGenericSdk = tslib_1.__importStar(require("@graphql-codegen/typescript-generic-sdk"));
const typedDocumentNodePlugin = tslib_1.__importStar(require("@graphql-codegen/typed-document-node"));
const cross_helpers_1 = require("@graphql-mesh/cross-helpers");
const typescript_1 = tslib_1.__importDefault(require("typescript"));
const utils_2 = require("@graphql-mesh/utils");
const generate_operations_js_1 = require("./generate-operations.js");
const json5_1 = tslib_1.__importDefault(require("json5"));
const unifiedContextIdentifier = 'MeshContext';
class CodegenHelpers extends tsBasePlugin.TsVisitor {
    getTypeToUse(namedType) {
        if (this.scalars[namedType.name.value]) {
            return this._getScalar(namedType.name.value);
        }
        return this._getTypeForNode(namedType);
    }
}
function buildSignatureBasedOnRootFields(codegenHelpers, type) {
    if (!type) {
        return {};
    }
    const fields = type.getFields();
    const operationMap = {};
    for (const fieldName in fields) {
        const field = fields[fieldName];
        const argsExists = field.args && field.args.length > 0;
        const argsName = argsExists ? `${type.name}${field.name}Args` : '{}';
        const parentTypeNode = {
            kind: graphql_1.Kind.NAMED_TYPE,
            name: {
                kind: graphql_1.Kind.NAME,
                value: type.name,
            },
        };
        operationMap[fieldName] = `  /** ${field.description} **/\n  ${field.name}: InContextSdkMethod<${codegenHelpers.getTypeToUse(parentTypeNode)}['${fieldName}'], ${argsName}, ${unifiedContextIdentifier}>`;
    }
    return operationMap;
}
async function generateTypesForApi(options) {
    const config = {
        skipTypename: true,
        namingConvention: 'keep',
        enumsAsTypes: true,
        ignoreEnumValuesFromSchema: true,
    };
    const baseTypes = await (0, core_1.codegen)({
        filename: options.name + '_types.ts',
        documents: [],
        config,
        schemaAst: options.schema,
        schema: undefined,
        skipDocumentsValidation: true,
        plugins: [
            {
                typescript: {},
            },
        ],
        pluginMap: {
            typescript: tsBasePlugin,
        },
    });
    const codegenHelpers = new CodegenHelpers(options.schema, config, {});
    const namespace = (0, pascal_case_1.pascalCase)(`${options.name}Types`);
    const queryOperationMap = buildSignatureBasedOnRootFields(codegenHelpers, options.schema.getQueryType());
    const mutationOperationMap = buildSignatureBasedOnRootFields(codegenHelpers, options.schema.getMutationType());
    const subscriptionsOperationMap = buildSignatureBasedOnRootFields(codegenHelpers, options.schema.getSubscriptionType());
    const codeAst = `
import { InContextSdkMethod } from '@graphql-mesh/types';
import { MeshContext } from '@graphql-mesh/runtime';

export namespace ${namespace} {
  ${baseTypes}
  export type QuerySdk = {
    ${Object.values(queryOperationMap).join(',\n')}
  };

  export type MutationSdk = {
    ${Object.values(mutationOperationMap).join(',\n')}
  };

  export type SubscriptionSdk = {
    ${Object.values(subscriptionsOperationMap).join(',\n')}
  };

  export type Context = {
      [${JSON.stringify(options.name)}]: { Query: QuerySdk, Mutation: MutationSdk, Subscription: SubscriptionSdk },
      ${Object.keys(options.contextVariables)
        .map(key => `[${JSON.stringify(key)}]: ${options.contextVariables[key]}`)
        .join(',\n')}
    };
}
`;
    return {
        identifier: namespace,
        codeAst,
    };
}
const BASEDIR_ASSIGNMENT_COMMENT = `/* BASEDIR_ASSIGNMENT */`;
async function generateTsArtifacts({ unifiedSchema, rawSources, mergerType = 'stitching', documents, flattenTypes, importedModulesSet, baseDir, meshConfigImportCodes, meshConfigCodes, logger, sdkConfig, fileType, codegenConfig = {}, }, cliParams) {
    var _a, _b, _c, _d, _e, _f;
    const artifactsDir = cross_helpers_1.path.join(baseDir, cliParams.artifactsDir);
    logger.info('Generating index file in TypeScript');
    for (const rawSource of rawSources) {
        const transformedSchema = unifiedSchema.extensions.sourceMap.get(rawSource);
        const sdl = (0, utils_1.printSchemaWithDirectives)(transformedSchema);
        await (0, utils_2.writeFile)(cross_helpers_1.path.join(artifactsDir, `sources/${rawSource.name}/schema.graphql`), sdl);
    }
    const documentsInput = (sdkConfig === null || sdkConfig === void 0 ? void 0 : sdkConfig.generateOperations)
        ? (0, generate_operations_js_1.generateOperations)(unifiedSchema, sdkConfig.generateOperations)
        : documents;
    const pluginsInput = [
        {
            typescript: {},
        },
        {
            resolvers: {},
        },
        {
            contextSdk: {},
        },
    ];
    if (documentsInput.length) {
        pluginsInput.push({
            typescriptOperations: {},
        }, {
            typedDocumentNode: {},
        }, {
            typescriptGenericSdk: {
                documentMode: 'external',
                importDocumentNodeExternallyFrom: 'NOWHERE',
            },
        });
    }
    const codegenOutput = '// @ts-nocheck\n' +
        (await (0, core_1.codegen)({
            filename: 'types.ts',
            documents: documentsInput,
            config: {
                skipTypename: true,
                flattenGeneratedTypes: flattenTypes,
                onlyOperationTypes: flattenTypes,
                preResolveTypes: flattenTypes,
                namingConvention: 'keep',
                documentMode: 'graphQLTag',
                gqlImport: '@graphql-mesh/utils#gql',
                enumsAsTypes: true,
                ignoreEnumValuesFromSchema: true,
                useIndexSignature: true,
                noSchemaStitching: false,
                contextType: unifiedContextIdentifier,
                federation: mergerType === 'federation',
                ...codegenConfig,
            },
            schemaAst: unifiedSchema,
            schema: undefined,
            // skipDocumentsValidation: true,
            pluginMap: {
                typescript: tsBasePlugin,
                typescriptOperations: tsOperationsPlugin,
                typedDocumentNode: typedDocumentNodePlugin,
                typescriptGenericSdk,
                resolvers: tsResolversPlugin,
                contextSdk: {
                    plugin: async () => {
                        const importCodes = new Set([
                            ...meshConfigImportCodes,
                            `import { getMesh, ExecuteMeshFn, SubscribeMeshFn, MeshContext as BaseMeshContext, MeshInstance } from '@graphql-mesh/runtime';`,
                            `import { MeshStore, FsStoreStorageAdapter } from '@graphql-mesh/store';`,
                            `import { path as pathModule } from '@graphql-mesh/cross-helpers';`,
                            `import { ImportFn } from '@graphql-mesh/types';`,
                        ]);
                        const results = await Promise.all(rawSources.map(async (source) => {
                            const sourceMap = unifiedSchema.extensions.sourceMap;
                            const sourceSchema = sourceMap.get(source);
                            const { identifier, codeAst } = await generateTypesForApi({
                                schema: sourceSchema,
                                name: source.name,
                                contextVariables: source.contextVariables,
                            });
                            if (codeAst) {
                                const content = '// @ts-nocheck\n' + codeAst;
                                await (0, utils_2.writeFile)(cross_helpers_1.path.join(artifactsDir, `sources/${source.name}/types.ts`), content);
                            }
                            if (identifier) {
                                importCodes.add(`import type { ${identifier} } from './sources/${source.name}/types';`);
                            }
                            return {
                                identifier,
                                codeAst,
                            };
                        }));
                        const contextType = `export type ${unifiedContextIdentifier} = ${results
                            .map(r => `${r === null || r === void 0 ? void 0 : r.identifier}.Context`)
                            .filter(Boolean)
                            .join(' & ')} & BaseMeshContext;`;
                        let meshMethods = `
${BASEDIR_ASSIGNMENT_COMMENT}

const importFn: ImportFn = <T>(moduleId: string) => {
  const relativeModuleId = (pathModule.isAbsolute(moduleId) ? pathModule.relative(baseDir, moduleId) : moduleId).split('\\\\').join('/').replace(baseDir + '/', '');
  switch(relativeModuleId) {${[...importedModulesSet]
                            .map(importedModuleName => {
                            let moduleMapProp = importedModuleName;
                            let importPath = importedModuleName;
                            if (importPath.startsWith('.')) {
                                importPath = cross_helpers_1.path.join(baseDir, importPath);
                            }
                            if (cross_helpers_1.path.isAbsolute(importPath)) {
                                moduleMapProp = cross_helpers_1.path.relative(baseDir, importedModuleName).split('\\').join('/');
                                importPath = `./${cross_helpers_1.path
                                    .relative(artifactsDir, importedModuleName)
                                    .split('\\')
                                    .join('/')}`;
                            }
                            return `
    case ${JSON.stringify(moduleMapProp)}:
      return import(${JSON.stringify(importPath)}) as T;
    `;
                        })
                            .join('')}
    default:
      return Promise.reject(new Error(\`Cannot find module '\${relativeModuleId}'.\`));
  }
};

const rootStore = new MeshStore('${cliParams.artifactsDir}', new FsStoreStorageAdapter({
  cwd: baseDir,
  importFn,
  fileType: ${JSON.stringify(fileType)},
}), {
  readonly: true,
  validate: false
});

${[...meshConfigCodes].join('\n')}

let meshInstance$: Promise<MeshInstance> | undefined;

export function ${cliParams.builtMeshFactoryName}(): Promise<MeshInstance> {
  if (meshInstance$ == null) {
    meshInstance$ = getMeshOptions().then(meshOptions => getMesh(meshOptions)).then(mesh => {
      const id = mesh.pubsub.subscribe('destroy', () => {
        meshInstance$ = undefined;
        mesh.pubsub.unsubscribe(id);
      });
      return mesh;
    });
  }
  return meshInstance$;
}

export const execute: ExecuteMeshFn = (...args) => ${cliParams.builtMeshFactoryName}().then(({ execute }) => execute(...args));

export const subscribe: SubscribeMeshFn = (...args) => ${cliParams.builtMeshFactoryName}().then(({ subscribe }) => subscribe(...args));`;
                        if (documentsInput.length) {
                            meshMethods += `
export function ${cliParams.builtMeshSDKFactoryName}<TGlobalContext = any, TOperationContext = any>(globalContext?: TGlobalContext) {
  const sdkRequester$ = ${cliParams.builtMeshFactoryName}().then(({ sdkRequesterFactory }) => sdkRequesterFactory(globalContext));
  return getSdk<TOperationContext, TGlobalContext>((...args) => sdkRequester$.then(sdkRequester => sdkRequester(...args)));
}`;
                        }
                        return {
                            prepend: [[...importCodes].join('\n'), '\n\n'],
                            content: [contextType, meshMethods].join('\n\n'),
                        };
                    },
                },
            },
            plugins: pluginsInput,
        }))
            .replace(`import * as Operations from 'NOWHERE';\n`, '')
            .replace(`import { DocumentNode } from 'graphql';`, '');
    const endpointAssignmentESM = `import { fileURLToPath } from '@graphql-mesh/utils';
const baseDir = pathModule.join(pathModule.dirname(fileURLToPath(import.meta.url)), '${cross_helpers_1.path.relative(artifactsDir, baseDir)}');`;
    const endpointAssignmentCJS = `const baseDir = pathModule.join(typeof __dirname === 'string' ? __dirname : '/', '${cross_helpers_1.path.relative(artifactsDir, baseDir)}');`;
    const tsFilePath = cross_helpers_1.path.join(artifactsDir, 'index.ts');
    const jobs = [];
    const jsFilePath = cross_helpers_1.path.join(artifactsDir, 'index.js');
    const dtsFilePath = cross_helpers_1.path.join(artifactsDir, 'index.d.ts');
    const esmJob = (ext) => async () => {
        logger.info('Writing index.ts for ESM to the disk.');
        await (0, utils_2.writeFile)(tsFilePath, codegenOutput.replace(BASEDIR_ASSIGNMENT_COMMENT, endpointAssignmentESM));
        const esmJsFilePath = cross_helpers_1.path.join(artifactsDir, `index.${ext}`);
        if (await (0, utils_2.pathExists)(esmJsFilePath)) {
            await cross_helpers_1.fs.promises.unlink(esmJsFilePath);
        }
        if (fileType !== 'ts') {
            logger.info(`Compiling TS file as ES Module to "index.${ext}"`);
            compileTS(tsFilePath, typescript_1.default.ModuleKind.ESNext, [jsFilePath, dtsFilePath]);
            if (ext === 'mjs') {
                const mjsFilePath = cross_helpers_1.path.join(artifactsDir, 'index.mjs');
                await cross_helpers_1.fs.promises.rename(jsFilePath, mjsFilePath);
            }
            logger.info('Deleting index.ts');
            await cross_helpers_1.fs.promises.unlink(tsFilePath);
        }
    };
    const cjsJob = async () => {
        logger.info('Writing index.ts for CJS to the disk.');
        await (0, utils_2.writeFile)(tsFilePath, codegenOutput.replace(BASEDIR_ASSIGNMENT_COMMENT, endpointAssignmentCJS));
        if (await (0, utils_2.pathExists)(jsFilePath)) {
            await cross_helpers_1.fs.promises.unlink(jsFilePath);
        }
        if (fileType !== 'ts') {
            logger.info('Compiling TS file as CommonJS Module to `index.js`');
            compileTS(tsFilePath, typescript_1.default.ModuleKind.CommonJS, [jsFilePath, dtsFilePath]);
            logger.info('Deleting index.ts');
            await cross_helpers_1.fs.promises.unlink(tsFilePath);
        }
    };
    const packageJsonJob = (module) => () => (0, utils_2.writeJSON)(cross_helpers_1.path.join(artifactsDir, 'package.json'), {
        name: 'mesh-artifacts',
        private: true,
        type: module,
        main: 'index.js',
        module: 'index.mjs',
        sideEffects: false,
        typings: 'index.d.ts',
        typescript: {
            definition: 'index.d.ts',
        },
        exports: {
            '.': {
                require: './index.js',
                import: './index.mjs',
            },
            './*': {
                require: './*.js',
                import: './*.mjs',
            },
        },
    });
    function setTsConfigDefault() {
        jobs.push(cjsJob);
        if (fileType !== 'ts') {
            jobs.push(packageJsonJob('commonjs'));
        }
    }
    const rootDir = cross_helpers_1.path.resolve('./');
    const tsConfigPath = cross_helpers_1.path.join(rootDir, 'tsconfig.json');
    const packageJsonPath = cross_helpers_1.path.join(rootDir, 'package.json');
    if (await (0, utils_2.pathExists)(tsConfigPath)) {
        // case tsconfig exists
        const tsConfigStr = await cross_helpers_1.fs.promises.readFile(tsConfigPath, 'utf-8');
        const tsConfig = json5_1.default.parse(tsConfigStr);
        if ((_c = (_b = (_a = tsConfig === null || tsConfig === void 0 ? void 0 : tsConfig.compilerOptions) === null || _a === void 0 ? void 0 : _a.module) === null || _b === void 0 ? void 0 : _b.toLowerCase()) === null || _c === void 0 ? void 0 : _c.startsWith('es')) {
            // case tsconfig set to esm
            jobs.push(esmJob('js'));
            if (fileType !== 'ts') {
                jobs.push(packageJsonJob('module'));
            }
        }
        else if (((_f = (_e = (_d = tsConfig === null || tsConfig === void 0 ? void 0 : tsConfig.compilerOptions) === null || _d === void 0 ? void 0 : _d.module) === null || _e === void 0 ? void 0 : _e.toLowerCase()) === null || _f === void 0 ? void 0 : _f.startsWith('node')) &&
            (await (0, utils_2.pathExists)(packageJsonPath))) {
            // case tsconfig set to node* and package.json exists
            const packageJsonStr = await cross_helpers_1.fs.promises.readFile(packageJsonPath, 'utf-8');
            const packageJson = json5_1.default.parse(packageJsonStr);
            if ((packageJson === null || packageJson === void 0 ? void 0 : packageJson.type) === 'module') {
                // case package.json set to esm
                jobs.push(esmJob('js'));
                if (fileType !== 'ts') {
                    jobs.push(packageJsonJob('module'));
                }
            }
            else {
                // case package.json set to cjs or not set
                setTsConfigDefault();
            }
        }
        else {
            // case tsconfig set to cjs or set to node* with no package.json
            setTsConfigDefault();
        }
    }
    else if (await (0, utils_2.pathExists)(packageJsonPath)) {
        // case package.json exists
        const packageJsonStr = await cross_helpers_1.fs.promises.readFile(packageJsonPath, 'utf-8');
        const packageJson = json5_1.default.parse(packageJsonStr);
        if ((packageJson === null || packageJson === void 0 ? void 0 : packageJson.type) === 'module') {
            // case package.json set to esm
            jobs.push(esmJob('js'));
            if (fileType !== 'ts') {
                jobs.push(packageJsonJob('module'));
            }
        }
        else {
            // case package.json set to cjs or not set
            jobs.push(esmJob('mjs'));
            if (fileType === 'js') {
                jobs.push(packageJsonJob('module'));
            }
            else {
                jobs.push(cjsJob);
                jobs.push(packageJsonJob('commonjs'));
            }
        }
    }
    else {
        // case no tsconfig and no package.json
        jobs.push(esmJob('mjs'));
        if (fileType === 'js') {
            jobs.push(packageJsonJob('module'));
        }
        else {
            jobs.push(cjsJob);
            jobs.push(packageJsonJob('commonjs'));
        }
    }
    for (const job of jobs) {
        await job();
    }
}
exports.generateTsArtifacts = generateTsArtifacts;
function compileTS(tsFilePath, module, outputFilePaths) {
    const options = {
        target: typescript_1.default.ScriptTarget.ESNext,
        module,
        sourceMap: false,
        inlineSourceMap: false,
        importHelpers: true,
        allowSyntheticDefaultImports: true,
        esModuleInterop: true,
        declaration: true,
    };
    const host = typescript_1.default.createCompilerHost(options);
    const hostWriteFile = host.writeFile.bind(host);
    host.writeFile = (fileName, ...rest) => {
        if (outputFilePaths.some(f => cross_helpers_1.path.normalize(f) === cross_helpers_1.path.normalize(fileName))) {
            return hostWriteFile(fileName, ...rest);
        }
    };
    // Prepare and emit the d.ts files
    const program = typescript_1.default.createProgram([tsFilePath], options, host);
    program.emit();
}
exports.compileTS = compileTS;
