import * as tsBasePlugin from '@graphql-codegen/typescript';
import * as tsResolversPlugin from '@graphql-codegen/typescript-resolvers';
import { Kind } from 'graphql';
import { codegen } from '@graphql-codegen/core';
import { pascalCase } from 'pascal-case';
import { printSchemaWithDirectives } from '@graphql-tools/utils';
import * as tsOperationsPlugin from '@graphql-codegen/typescript-operations';
import * as typescriptGenericSdk from '@graphql-codegen/typescript-generic-sdk';
import * as typedDocumentNodePlugin from '@graphql-codegen/typed-document-node';
import { fs, path as pathModule } from '@graphql-mesh/cross-helpers';
import ts from 'typescript';
import { pathExists, writeFile, writeJSON } from '@graphql-mesh/utils';
import { generateOperations } from './generate-operations.js';
import JSON5 from 'json5';
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
            kind: Kind.NAMED_TYPE,
            name: {
                kind: Kind.NAME,
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
    const baseTypes = await codegen({
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
    const namespace = pascalCase(`${options.name}Types`);
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
export async function generateTsArtifacts({ unifiedSchema, rawSources, mergerType = 'stitching', documents, flattenTypes, importedModulesSet, baseDir, meshConfigImportCodes, meshConfigCodes, logger, sdkConfig, fileType, codegenConfig = {}, }, cliParams) {
    var _a, _b, _c, _d, _e, _f;
    const artifactsDir = pathModule.join(baseDir, cliParams.artifactsDir);
    logger.info('Generating index file in TypeScript');
    for (const rawSource of rawSources) {
        const transformedSchema = unifiedSchema.extensions.sourceMap.get(rawSource);
        const sdl = printSchemaWithDirectives(transformedSchema);
        await writeFile(pathModule.join(artifactsDir, `sources/${rawSource.name}/schema.graphql`), sdl);
    }
    const documentsInput = (sdkConfig === null || sdkConfig === void 0 ? void 0 : sdkConfig.generateOperations)
        ? generateOperations(unifiedSchema, sdkConfig.generateOperations)
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
        (await codegen({
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
                                await writeFile(pathModule.join(artifactsDir, `sources/${source.name}/types.ts`), content);
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
                                importPath = pathModule.join(baseDir, importPath);
                            }
                            if (pathModule.isAbsolute(importPath)) {
                                moduleMapProp = pathModule.relative(baseDir, importedModuleName).split('\\').join('/');
                                importPath = `./${pathModule
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
const baseDir = pathModule.join(pathModule.dirname(fileURLToPath(import.meta.url)), '${pathModule.relative(artifactsDir, baseDir)}');`;
    const endpointAssignmentCJS = `const baseDir = pathModule.join(typeof __dirname === 'string' ? __dirname : '/', '${pathModule.relative(artifactsDir, baseDir)}');`;
    const tsFilePath = pathModule.join(artifactsDir, 'index.ts');
    const jobs = [];
    const jsFilePath = pathModule.join(artifactsDir, 'index.js');
    const dtsFilePath = pathModule.join(artifactsDir, 'index.d.ts');
    const esmJob = (ext) => async () => {
        logger.info('Writing index.ts for ESM to the disk.');
        await writeFile(tsFilePath, codegenOutput.replace(BASEDIR_ASSIGNMENT_COMMENT, endpointAssignmentESM));
        const esmJsFilePath = pathModule.join(artifactsDir, `index.${ext}`);
        if (await pathExists(esmJsFilePath)) {
            await fs.promises.unlink(esmJsFilePath);
        }
        if (fileType !== 'ts') {
            logger.info(`Compiling TS file as ES Module to "index.${ext}"`);
            compileTS(tsFilePath, ts.ModuleKind.ESNext, [jsFilePath, dtsFilePath]);
            if (ext === 'mjs') {
                const mjsFilePath = pathModule.join(artifactsDir, 'index.mjs');
                await fs.promises.rename(jsFilePath, mjsFilePath);
            }
            logger.info('Deleting index.ts');
            await fs.promises.unlink(tsFilePath);
        }
    };
    const cjsJob = async () => {
        logger.info('Writing index.ts for CJS to the disk.');
        await writeFile(tsFilePath, codegenOutput.replace(BASEDIR_ASSIGNMENT_COMMENT, endpointAssignmentCJS));
        if (await pathExists(jsFilePath)) {
            await fs.promises.unlink(jsFilePath);
        }
        if (fileType !== 'ts') {
            logger.info('Compiling TS file as CommonJS Module to `index.js`');
            compileTS(tsFilePath, ts.ModuleKind.CommonJS, [jsFilePath, dtsFilePath]);
            logger.info('Deleting index.ts');
            await fs.promises.unlink(tsFilePath);
        }
    };
    const packageJsonJob = (module) => () => writeJSON(pathModule.join(artifactsDir, 'package.json'), {
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
    const rootDir = pathModule.resolve('./');
    const tsConfigPath = pathModule.join(rootDir, 'tsconfig.json');
    const packageJsonPath = pathModule.join(rootDir, 'package.json');
    if (await pathExists(tsConfigPath)) {
        // case tsconfig exists
        const tsConfigStr = await fs.promises.readFile(tsConfigPath, 'utf-8');
        const tsConfig = JSON5.parse(tsConfigStr);
        if ((_c = (_b = (_a = tsConfig === null || tsConfig === void 0 ? void 0 : tsConfig.compilerOptions) === null || _a === void 0 ? void 0 : _a.module) === null || _b === void 0 ? void 0 : _b.toLowerCase()) === null || _c === void 0 ? void 0 : _c.startsWith('es')) {
            // case tsconfig set to esm
            jobs.push(esmJob('js'));
            if (fileType !== 'ts') {
                jobs.push(packageJsonJob('module'));
            }
        }
        else if (((_f = (_e = (_d = tsConfig === null || tsConfig === void 0 ? void 0 : tsConfig.compilerOptions) === null || _d === void 0 ? void 0 : _d.module) === null || _e === void 0 ? void 0 : _e.toLowerCase()) === null || _f === void 0 ? void 0 : _f.startsWith('node')) &&
            (await pathExists(packageJsonPath))) {
            // case tsconfig set to node* and package.json exists
            const packageJsonStr = await fs.promises.readFile(packageJsonPath, 'utf-8');
            const packageJson = JSON5.parse(packageJsonStr);
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
    else if (await pathExists(packageJsonPath)) {
        // case package.json exists
        const packageJsonStr = await fs.promises.readFile(packageJsonPath, 'utf-8');
        const packageJson = JSON5.parse(packageJsonStr);
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
export function compileTS(tsFilePath, module, outputFilePaths) {
    const options = {
        target: ts.ScriptTarget.ESNext,
        module,
        sourceMap: false,
        inlineSourceMap: false,
        importHelpers: true,
        allowSyntheticDefaultImports: true,
        esModuleInterop: true,
        declaration: true,
    };
    const host = ts.createCompilerHost(options);
    const hostWriteFile = host.writeFile.bind(host);
    host.writeFile = (fileName, ...rest) => {
        if (outputFilePaths.some(f => pathModule.normalize(f) === pathModule.normalize(fileName))) {
            return hostWriteFile(fileName, ...rest);
        }
    };
    // Prepare and emit the d.ts files
    const program = ts.createProgram([tsFilePath], options, host);
    program.emit();
}
