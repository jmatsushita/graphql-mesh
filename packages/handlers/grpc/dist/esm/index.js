/* eslint-disable import/no-duplicates */
import './patchLongJs.js';
import { stringInterpolator } from '@graphql-mesh/string-interpolation';
import { credentials, loadPackageDefinition } from '@grpc/grpc-js';
import { fromJSON } from '@grpc/proto-loader';
import { SchemaComposer } from 'graphql-compose';
import { GraphQLBigInt, GraphQLByte, GraphQLUnsignedInt, GraphQLVoid, GraphQLJSON, } from 'graphql-scalars';
import lodashGet from 'lodash.get';
import lodashHas from 'lodash.has';
import protobufjs from 'protobufjs';
import { Client } from '@ardatan/grpc-reflection-js';
import descriptor from 'protobufjs/ext/descriptor/index.js';
import { addIncludePathResolver, addMetaDataToCall, getTypeName } from './utils.js';
import { specifiedDirectives } from 'graphql';
import { path, process } from '@graphql-mesh/cross-helpers';
import { fs } from '@graphql-mesh/cross-helpers';
import globby from 'globby';
const { Root } = protobufjs;
const QUERY_METHOD_PREFIXES = ['get', 'list', 'search'];
export default class GrpcHandler {
    constructor({ config, baseDir, store, logger }) {
        this.schemaComposer = new SchemaComposer();
        this.logger = logger;
        this.config = config;
        this.baseDir = baseDir;
        this.rootJsonEntries = store.proxy('rootJsonEntries', {
            codify: rootJsonEntries => `
export default [
${rootJsonEntries
                .map(({ name, rootJson }) => `
  {
    name: ${JSON.stringify(name)},
    rootJson: ${JSON.stringify(rootJson, null, 2)},
  },
`)
                .join('\n')}
];
`.trim(),
            fromJSON: jsonData => {
                return jsonData.map(({ name, rootJson }) => ({
                    name,
                    rootJson,
                }));
            },
            toJSON: rootJsonEntries => {
                return rootJsonEntries.map(({ name, rootJson }) => {
                    return {
                        name,
                        rootJson,
                    };
                });
            },
            validate: () => { },
        });
    }
    async processReflection(creds) {
        this.logger.debug(`Using the reflection`);
        const grpcReflectionServer = this.config.endpoint;
        this.logger.debug(`Creating gRPC Reflection Client`);
        const reflectionClient = new Client(grpcReflectionServer, creds);
        const services = await reflectionClient.listServices();
        const userServices = services.filter(service => service && !(service === null || service === void 0 ? void 0 : service.startsWith('grpc.')));
        return userServices.map(async (service) => {
            this.logger.debug(`Resolving root of Service: ${service} from the reflection response`);
            const serviceRoot = await reflectionClient.fileContainingSymbol(service);
            return serviceRoot;
        });
    }
    async processDescriptorFile() {
        var _a;
        let fileName;
        let options;
        if (typeof this.config.source === 'object') {
            fileName = this.config.source.file;
            options = {
                ...this.config.source.load,
                includeDirs: (_a = this.config.source.load.includeDirs) === null || _a === void 0 ? void 0 : _a.map(includeDir => path.isAbsolute(includeDir) ? includeDir : path.join(this.baseDir, includeDir)),
            };
        }
        else {
            fileName = this.config.source;
        }
        const absoluteFilePath = path.isAbsolute(fileName)
            ? fileName
            : path.join(this.baseDir, fileName);
        this.logger.debug(`Using the descriptor set from ${absoluteFilePath} `);
        const descriptorSetBuffer = await fs.promises.readFile(absoluteFilePath);
        this.logger.debug(`Reading ${absoluteFilePath} `);
        let decodedDescriptorSet;
        if (absoluteFilePath.endsWith('json')) {
            this.logger.debug(`Parsing ${absoluteFilePath} as json`);
            const descriptorSetJSON = JSON.parse(descriptorSetBuffer.toString());
            decodedDescriptorSet = descriptor.FileDescriptorSet.fromObject(descriptorSetJSON);
        }
        else {
            decodedDescriptorSet = descriptor.FileDescriptorSet.decode(descriptorSetBuffer);
        }
        this.logger.debug(`Creating root from descriptor set`);
        const rootFromDescriptor = Root.fromDescriptor(decodedDescriptorSet);
        if (options.includeDirs) {
            if (!Array.isArray(options.includeDirs)) {
                return Promise.reject(new Error('The includeDirs option must be an array'));
            }
            addIncludePathResolver(rootFromDescriptor, options.includeDirs);
        }
        return rootFromDescriptor;
    }
    async processProtoFile() {
        var _a, _b;
        this.logger.debug(`Using proto file(s)`);
        let protoRoot = new Root();
        let fileGlob;
        let options = {
            keepCase: true,
            alternateCommentMode: true,
        };
        if (typeof this.config.source === 'object') {
            fileGlob = this.config.source.file;
            options = {
                ...options,
                ...this.config.source.load,
                includeDirs: (_b = (_a = this.config.source.load) === null || _a === void 0 ? void 0 : _a.includeDirs) === null || _b === void 0 ? void 0 : _b.map(includeDir => path.isAbsolute(includeDir) ? includeDir : path.join(this.baseDir, includeDir)),
            };
            if (options.includeDirs) {
                if (!Array.isArray(options.includeDirs)) {
                    throw new Error('The includeDirs option must be an array');
                }
                addIncludePathResolver(protoRoot, options.includeDirs);
            }
        }
        else {
            fileGlob = this.config.source;
        }
        const fileNames = await globby(fileGlob, {
            cwd: this.baseDir,
        });
        this.logger.debug(`Loading proto files(${fileGlob}); \n ${fileNames.join('\n')} `);
        protoRoot = await protoRoot.load(fileNames.map(filePath => path.isAbsolute(filePath) ? filePath : path.join(this.baseDir, filePath)), options);
        this.logger.debug(`Adding proto content to the root`);
        return protoRoot;
    }
    getCachedDescriptorSets(creds) {
        return this.rootJsonEntries.getWithSet(async () => {
            const rootPromises = [];
            this.logger.debug(`Building Roots`);
            if (this.config.source) {
                const filePath = typeof this.config.source === 'string' ? this.config.source : this.config.source.file;
                if (filePath.endsWith('json')) {
                    rootPromises.push(this.processDescriptorFile());
                }
                else if (filePath.endsWith('proto')) {
                    rootPromises.push(this.processProtoFile());
                }
            }
            else {
                const reflectionPromises = await this.processReflection(creds);
                rootPromises.push(...reflectionPromises);
            }
            return Promise.all(rootPromises.map(async (root$, i) => {
                const root = await root$;
                const rootName = root.name || `Root${i}`;
                const rootLogger = this.logger.child(rootName);
                rootLogger.debug(`Resolving entire the root tree`);
                root.resolveAll();
                rootLogger.debug(`Creating artifacts from descriptor set and root`);
                return {
                    name: rootName,
                    rootJson: root.toJSON({
                        keepComments: true,
                    }),
                };
            }));
        });
    }
    async getCredentials() {
        if (this.config.credentialsSsl) {
            this.logger.debug(() => `Using SSL Connection with credentials at ${this.config.credentialsSsl.privateKey} & ${this.config.credentialsSsl.certChain}`);
            const absolutePrivateKeyPath = path.isAbsolute(this.config.credentialsSsl.privateKey)
                ? this.config.credentialsSsl.privateKey
                : path.join(this.baseDir, this.config.credentialsSsl.privateKey);
            const absoluteCertChainPath = path.isAbsolute(this.config.credentialsSsl.certChain)
                ? this.config.credentialsSsl.certChain
                : path.join(this.baseDir, this.config.credentialsSsl.certChain);
            const sslFiles = [
                fs.promises.readFile(absolutePrivateKeyPath),
                fs.promises.readFile(absoluteCertChainPath),
            ];
            if (this.config.credentialsSsl.rootCA !== 'rootCA') {
                const absoluteRootCAPath = path.isAbsolute(this.config.credentialsSsl.rootCA)
                    ? this.config.credentialsSsl.rootCA
                    : path.join(this.baseDir, this.config.credentialsSsl.rootCA);
                sslFiles.unshift(fs.promises.readFile(absoluteRootCAPath));
            }
            const [rootCA, privateKey, certChain] = await Promise.all(sslFiles);
            return credentials.createSsl(rootCA, privateKey, certChain);
        }
        else if (this.config.useHTTPS) {
            this.logger.debug(`Using SSL Connection`);
            return credentials.createSsl();
        }
        this.logger.debug(`Using insecure connection`);
        return credentials.createInsecure();
    }
    walkToFindTypePath(rootJson, pathWithName, baseTypePath) {
        const currentWalkingPath = [...pathWithName];
        while (!lodashHas(rootJson.nested, currentWalkingPath.concat(baseTypePath).join('.nested.'))) {
            if (!currentWalkingPath.length) {
                break;
            }
            currentWalkingPath.pop();
        }
        return currentWalkingPath.concat(baseTypePath);
    }
    visit({ nested, name, currentPath, rootJson, creds, grpcObject, rootLogger: logger, }) {
        var _a;
        const pathWithName = [...currentPath, ...name.split('.')].filter(Boolean);
        if ('nested' in nested) {
            for (const key in nested.nested) {
                logger.debug(`Visiting ${currentPath}.nested[${key}]`);
                const currentNested = nested.nested[key];
                this.visit({
                    nested: currentNested,
                    name: key,
                    currentPath: pathWithName,
                    rootJson,
                    creds,
                    grpcObject,
                    rootLogger: logger,
                });
            }
        }
        const typeName = pathWithName.join('_');
        if ('values' in nested) {
            const enumTypeConfig = {
                name: typeName,
                values: {},
                description: nested.comment,
            };
            const commentMap = nested.comments;
            for (const [key, value] of Object.entries(nested.values)) {
                logger.debug(`Visiting ${currentPath}.nested.values[${key}]`);
                enumTypeConfig.values[key] = {
                    value,
                    description: commentMap === null || commentMap === void 0 ? void 0 : commentMap[key],
                };
            }
            this.schemaComposer.createEnumTC(enumTypeConfig);
        }
        else if ('fields' in nested) {
            const inputTypeName = typeName + '_Input';
            const outputTypeName = typeName;
            const description = nested.comment;
            const fieldEntries = Object.entries(nested.fields);
            if (fieldEntries.length) {
                const inputTC = this.schemaComposer.createInputTC({
                    name: inputTypeName,
                    description,
                    fields: {},
                });
                const outputTC = this.schemaComposer.createObjectTC({
                    name: outputTypeName,
                    description,
                    fields: {},
                });
                for (const [fieldName, { type, rule, comment, keyType }] of fieldEntries) {
                    logger.debug(`Visiting ${currentPath}.nested.fields[${fieldName}]`);
                    const baseFieldTypePath = type.split('.');
                    inputTC.addFields({
                        [fieldName]: {
                            type: () => {
                                let fieldInputTypeName;
                                if (keyType) {
                                    fieldInputTypeName = 'JSON';
                                }
                                else {
                                    const fieldTypePath = this.walkToFindTypePath(rootJson, pathWithName, baseFieldTypePath);
                                    fieldInputTypeName = getTypeName(this.schemaComposer, fieldTypePath, true);
                                }
                                return rule === 'repeated' ? `[${fieldInputTypeName}]` : fieldInputTypeName;
                            },
                            description: comment,
                        },
                    });
                    outputTC.addFields({
                        [fieldName]: {
                            type: () => {
                                let fieldTypeName;
                                if (keyType) {
                                    fieldTypeName = 'JSON';
                                }
                                else {
                                    const fieldTypePath = this.walkToFindTypePath(rootJson, pathWithName, baseFieldTypePath);
                                    fieldTypeName = getTypeName(this.schemaComposer, fieldTypePath, false);
                                }
                                return rule === 'repeated' ? `[${fieldTypeName}]` : fieldTypeName;
                            },
                            description: comment,
                        },
                    });
                }
            }
            else {
                this.schemaComposer.createScalarTC({
                    ...GraphQLJSON.toConfig(),
                    name: inputTypeName,
                    description,
                });
                this.schemaComposer.createScalarTC({
                    ...GraphQLJSON.toConfig(),
                    name: outputTypeName,
                    description,
                });
            }
        }
        else if ('methods' in nested) {
            const objPath = pathWithName.join('.');
            const ServiceClient = lodashGet(grpcObject, objPath);
            if (typeof ServiceClient !== 'function') {
                throw new Error(`Object at path ${objPath} is not a Service constructor`);
            }
            const client = new ServiceClient((_a = stringInterpolator.parse(this.config.endpoint, { env: process.env })) !== null && _a !== void 0 ? _a : this.config.endpoint, creds);
            for (const methodName in nested.methods) {
                const method = nested.methods[methodName];
                const rootFieldName = [...pathWithName, methodName].join('_');
                const fieldConfig = {
                    type: () => {
                        var _a;
                        const baseResponseTypePath = (_a = method.responseType) === null || _a === void 0 ? void 0 : _a.split('.');
                        if (baseResponseTypePath) {
                            const responseTypePath = this.walkToFindTypePath(rootJson, pathWithName, baseResponseTypePath);
                            let typeName = getTypeName(this.schemaComposer, responseTypePath, false);
                            if (method.responseStream) {
                                typeName = `[${typeName}]`;
                            }
                            return typeName;
                        }
                        return 'Void';
                    },
                    description: method.comment,
                };
                fieldConfig.args = {
                    input: () => {
                        var _a;
                        if (method.requestStream) {
                            return 'File';
                        }
                        const baseRequestTypePath = (_a = method.requestType) === null || _a === void 0 ? void 0 : _a.split('.');
                        if (baseRequestTypePath) {
                            const requestTypePath = this.walkToFindTypePath(rootJson, pathWithName, baseRequestTypePath);
                            const requestTypeName = getTypeName(this.schemaComposer, requestTypePath, true);
                            return requestTypeName;
                        }
                        return undefined;
                    },
                };
                const methodNameLowerCased = methodName.toLowerCase();
                const prefixQueryMethod = this.config.prefixQueryMethod || QUERY_METHOD_PREFIXES;
                const rootTypeComposer = prefixQueryMethod.some(prefix => methodNameLowerCased.startsWith(prefix))
                    ? this.schemaComposer.Query
                    : this.schemaComposer.Mutation;
                rootTypeComposer.addFields({
                    [rootFieldName]: {
                        ...fieldConfig,
                        resolve: (root, args, context, info) => addMetaDataToCall(client[methodName].bind(client), args.input, {
                            root,
                            args,
                            context,
                            env: process.env,
                        }, this.config.metaData, !!method.responseStream),
                    },
                });
            }
            const connectivityStateFieldName = pathWithName.join('_') + '_connectivityState';
            this.schemaComposer.Query.addFields({
                [connectivityStateFieldName]: {
                    type: 'ConnectivityState',
                    args: {
                        tryToConnect: {
                            type: 'Boolean',
                        },
                    },
                    resolve: (_, { tryToConnect }) => client.getChannel().getConnectivityState(tryToConnect),
                },
            });
        }
    }
    async getMeshSource() {
        this.config.requestTimeout = this.config.requestTimeout || 200000;
        this.schemaComposer.add(GraphQLBigInt);
        this.schemaComposer.add(GraphQLByte);
        this.schemaComposer.add(GraphQLUnsignedInt);
        this.schemaComposer.add(GraphQLVoid);
        this.schemaComposer.add(GraphQLJSON);
        this.schemaComposer.createScalarTC({
            name: 'File',
        });
        // identical of grpc's ConnectivityState
        this.schemaComposer.createEnumTC({
            name: 'ConnectivityState',
            values: {
                IDLE: { value: 0 },
                CONNECTING: { value: 1 },
                READY: { value: 2 },
                TRANSIENT_FAILURE: { value: 3 },
                SHUTDOWN: { value: 4 },
            },
        });
        this.logger.debug(`Getting channel credentials`);
        const creds = await this.getCredentials();
        this.logger.debug(`Getting stored root and decoded descriptor set objects`);
        const artifacts = await this.getCachedDescriptorSets(creds);
        for (const { name, rootJson } of artifacts) {
            const rootLogger = this.logger.child(name);
            rootLogger.debug(`Creating package definition from file descriptor set object`);
            const packageDefinition = fromJSON(rootJson);
            rootLogger.debug(`Creating service client for package definition`);
            const grpcObject = loadPackageDefinition(packageDefinition);
            this.logger.debug(`Building the schema structure based on the root object`);
            this.visit({
                nested: rootJson,
                name: '',
                currentPath: [],
                rootJson,
                creds,
                grpcObject,
                rootLogger,
            });
        }
        // graphql-compose doesn't add @defer and @stream to the schema
        specifiedDirectives.forEach(directive => this.schemaComposer.addDirective(directive));
        this.logger.debug(`Building the final GraphQL Schema`);
        const schema = this.schemaComposer.buildSchema();
        return {
            schema,
        };
    }
}
