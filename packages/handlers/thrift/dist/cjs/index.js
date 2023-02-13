"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const thrift_parser_1 = require("@creditkarma/thrift-parser");
const utils_1 = require("@graphql-mesh/utils");
const graphql_1 = require("graphql");
const graphql_scalars_1 = require("graphql-scalars");
const thrift_client_1 = require("@creditkarma/thrift-client");
const thrift_server_core_1 = require("@creditkarma/thrift-server-core");
const pascal_case_1 = require("pascal-case");
const store_1 = require("@graphql-mesh/store");
const utils_2 = require("@graphql-tools/utils");
const string_interpolation_1 = require("@graphql-mesh/string-interpolation");
const cross_helpers_1 = require("@graphql-mesh/cross-helpers");
class ThriftHandler {
    constructor({ config, baseDir, store, importFn, logger, }) {
        this.config = config;
        this.baseDir = baseDir;
        this.idl = store.proxy('idl.json', store_1.PredefinedProxyOptions.JsonWithoutValidation);
        this.importFn = importFn;
        this.logger = logger;
    }
    async getMeshSource({ fetchFn }) {
        var _a, _b;
        this.fetchFn = fetchFn;
        const { schemaHeaders, serviceName, operationHeaders } = this.config;
        const thriftAST = await this.idl.getWithSet(async () => {
            const rawThrift = await (0, utils_1.readFileOrUrl)(this.config.idl, {
                allowUnknownExtensions: true,
                cwd: this.baseDir,
                headers: schemaHeaders,
                fetch: this.fetchFn,
                logger: this.logger,
                importFn: this.importFn,
            });
            const parseResult = (0, thrift_parser_1.parse)(rawThrift, { organize: false });
            if (parseResult.type === thrift_parser_1.SyntaxType.ThriftErrors) {
                if (parseResult.errors.length === 1) {
                    throw parseResult.errors[0];
                }
                throw new utils_2.AggregateError(parseResult.errors);
            }
            return parseResult;
        });
        const enumTypeMap = new Map();
        const outputTypeMap = new Map();
        const inputTypeMap = new Map();
        const rootFields = {};
        const annotations = {};
        const methodAnnotations = {};
        const methodNames = [];
        const methodParameters = {};
        const topTypeMap = {};
        class MeshThriftClient extends thrift_server_core_1.ThriftClient {
            constructor() {
                super(...arguments);
                this._serviceName = serviceName;
                this._annotations = annotations;
                this._methodAnnotations = methodAnnotations;
                this._methodNames = methodNames;
                this._methodParameters = methodParameters;
            }
            writeType(typeVal, value, output) {
                switch (typeVal.type) {
                    case thrift_server_core_1.TType.BOOL:
                        output.writeBool(value);
                        break;
                    case thrift_server_core_1.TType.BYTE:
                        output.writeByte(value);
                        break;
                    case thrift_server_core_1.TType.DOUBLE:
                        output.writeDouble(value);
                        break;
                    case thrift_server_core_1.TType.I16:
                        output.writeI16(value);
                        break;
                    case thrift_server_core_1.TType.I32:
                        output.writeI32(value);
                        break;
                    case thrift_server_core_1.TType.I64:
                        output.writeI64(value.toString());
                        break;
                    case thrift_server_core_1.TType.STRING:
                        output.writeString(value);
                        break;
                    case thrift_server_core_1.TType.STRUCT: {
                        output.writeStructBegin(typeVal.name);
                        const typeMap = typeVal.fields;
                        for (const argName in value) {
                            const argType = typeMap[argName];
                            const argVal = value[argName];
                            if (argType) {
                                output.writeFieldBegin(argName, argType.type, argType.id);
                                this.writeType(argType, argVal, output);
                                output.writeFieldEnd();
                            }
                        }
                        output.writeFieldStop();
                        output.writeStructEnd();
                        break;
                    }
                    case thrift_server_core_1.TType.ENUM:
                        // TODO: A
                        break;
                    case thrift_server_core_1.TType.MAP: {
                        const keys = Object.keys(value);
                        output.writeMapBegin(typeVal.keyType.type, typeVal.valType.type, keys.length);
                        for (const key of keys) {
                            this.writeType(typeVal.keyType, key, output);
                            const val = value[key];
                            this.writeType(typeVal.valType, val, output);
                        }
                        output.writeMapEnd();
                        break;
                    }
                    case thrift_server_core_1.TType.LIST:
                        output.writeListBegin(typeVal.elementType.type, value.length);
                        for (const element of value) {
                            this.writeType(typeVal.elementType, element, output);
                        }
                        output.writeListEnd();
                        break;
                    case thrift_server_core_1.TType.SET:
                        output.writeSetBegin(typeVal.elementType.type, value.length);
                        for (const element of value) {
                            this.writeType(typeVal.elementType, element, output);
                        }
                        output.writeSetEnd();
                        break;
                }
            }
            readType(type, input) {
                switch (type) {
                    case thrift_server_core_1.TType.BOOL:
                        return input.readBool();
                    case thrift_server_core_1.TType.BYTE:
                        return input.readByte();
                    case thrift_server_core_1.TType.DOUBLE:
                        return input.readDouble();
                    case thrift_server_core_1.TType.I16:
                        return input.readI16();
                    case thrift_server_core_1.TType.I32:
                        return input.readI32();
                    case thrift_server_core_1.TType.I64:
                        return BigInt(input.readI64().toString());
                    case thrift_server_core_1.TType.STRING:
                        return input.readString();
                    case thrift_server_core_1.TType.STRUCT: {
                        const result = {};
                        input.readStructBegin();
                        while (true) {
                            const field = input.readFieldBegin();
                            const fieldType = field.fieldType;
                            const fieldName = field.fieldName || 'success';
                            if (fieldType === thrift_server_core_1.TType.STOP) {
                                break;
                            }
                            result[fieldName] = this.readType(fieldType, input);
                            input.readFieldEnd();
                        }
                        input.readStructEnd();
                        return result;
                    }
                    case thrift_server_core_1.TType.ENUM:
                        // TODO: A
                        break;
                    case thrift_server_core_1.TType.MAP: {
                        const result = {};
                        const map = input.readMapBegin();
                        for (let i = 0; i < map.size; i++) {
                            const key = this.readType(map.keyType, input);
                            const value = this.readType(map.valueType, input);
                            result[key] = value;
                        }
                        input.readMapEnd();
                        return result;
                    }
                    case thrift_server_core_1.TType.LIST: {
                        const result = [];
                        const list = input.readListBegin();
                        for (let i = 0; i < list.size; i++) {
                            const element = this.readType(list.elementType, input);
                            result.push(element);
                        }
                        input.readListEnd();
                        return result;
                    }
                    case thrift_server_core_1.TType.SET: {
                        const result = [];
                        const list = input.readSetBegin();
                        for (let i = 0; i < list.size; i++) {
                            const element = this.readType(list.elementType, input);
                            result.push(element);
                        }
                        input.readSetEnd();
                        return result;
                    }
                }
            }
            async doRequest(methodName, args, fields, context) {
                const Transport = this.transport;
                const Protocol = this.protocol;
                const writer = new Transport();
                const output = new Protocol(writer);
                const id = this.incrementRequestId();
                output.writeMessageBegin(methodName, thrift_server_core_1.MessageType.CALL, id);
                this.writeType({
                    name: (0, pascal_case_1.pascalCase)(methodName) + '__Args',
                    type: thrift_server_core_1.TType.STRUCT,
                    fields,
                    id,
                }, args, output);
                output.writeMessageEnd();
                const data = await this.connection.send(writer.flush(), context);
                const reader = this.transport.receiver(data);
                const input = new Protocol(reader);
                const { fieldName, messageType } = input.readMessageBegin();
                if (fieldName === methodName) {
                    if (messageType === thrift_server_core_1.MessageType.EXCEPTION) {
                        const err = thrift_server_core_1.TApplicationExceptionCodec.decode(input);
                        input.readMessageEnd();
                        return Promise.reject(err);
                    }
                    else {
                        const result = this.readType(thrift_server_core_1.TType.STRUCT, input);
                        input.readMessageEnd();
                        if (result.success != null) {
                            return result.success;
                        }
                        else {
                            throw new thrift_server_core_1.TApplicationException(thrift_server_core_1.TApplicationExceptionType.UNKNOWN, methodName + ' failed: unknown result');
                        }
                    }
                }
                else {
                    throw new thrift_server_core_1.TApplicationException(thrift_server_core_1.TApplicationExceptionType.WRONG_METHOD_NAME, 'Received a response to an unknown RPC function: ' + fieldName);
                }
            }
        }
        MeshThriftClient.serviceName = serviceName;
        MeshThriftClient.annotations = annotations;
        MeshThriftClient.methodAnnotations = methodAnnotations;
        MeshThriftClient.methodNames = methodNames;
        const thriftHttpClient = (0, thrift_client_1.createHttpClient)(MeshThriftClient, {
            ...this.config,
            requestOptions: {
                headers: operationHeaders,
            },
        });
        function processComments(comments) {
            return comments.map(comment => comment.value).join('\n');
        }
        function getGraphQLFunctionType(functionType, id = Math.random()) {
            let inputType;
            let outputType;
            let typeVal;
            switch (functionType.type) {
                case thrift_parser_1.SyntaxType.BinaryKeyword:
                case thrift_parser_1.SyntaxType.StringKeyword:
                    inputType = graphql_1.GraphQLString;
                    outputType = graphql_1.GraphQLString;
                    break;
                case thrift_parser_1.SyntaxType.DoubleKeyword:
                    inputType = graphql_1.GraphQLFloat;
                    outputType = graphql_1.GraphQLFloat;
                    typeVal = typeVal || { type: thrift_server_core_1.TType.DOUBLE };
                    break;
                case thrift_parser_1.SyntaxType.VoidKeyword:
                    typeVal = typeVal || { type: thrift_server_core_1.TType.VOID };
                    inputType = graphql_scalars_1.GraphQLVoid;
                    outputType = graphql_scalars_1.GraphQLVoid;
                    break;
                case thrift_parser_1.SyntaxType.BoolKeyword:
                    typeVal = typeVal || { type: thrift_server_core_1.TType.BOOL };
                    inputType = graphql_1.GraphQLBoolean;
                    outputType = graphql_1.GraphQLBoolean;
                    break;
                case thrift_parser_1.SyntaxType.I8Keyword:
                    inputType = graphql_1.GraphQLInt;
                    outputType = graphql_1.GraphQLInt;
                    typeVal = typeVal || { type: thrift_server_core_1.TType.I08 };
                    break;
                case thrift_parser_1.SyntaxType.I16Keyword:
                    inputType = graphql_1.GraphQLInt;
                    outputType = graphql_1.GraphQLInt;
                    typeVal = typeVal || { type: thrift_server_core_1.TType.I16 };
                    break;
                case thrift_parser_1.SyntaxType.I32Keyword:
                    inputType = graphql_1.GraphQLInt;
                    outputType = graphql_1.GraphQLInt;
                    typeVal = typeVal || { type: thrift_server_core_1.TType.I32 };
                    break;
                case thrift_parser_1.SyntaxType.ByteKeyword:
                    inputType = graphql_scalars_1.GraphQLByte;
                    outputType = graphql_scalars_1.GraphQLByte;
                    typeVal = typeVal || { type: thrift_server_core_1.TType.BYTE };
                    break;
                case thrift_parser_1.SyntaxType.I64Keyword:
                    inputType = graphql_scalars_1.GraphQLBigInt;
                    outputType = graphql_scalars_1.GraphQLBigInt;
                    typeVal = typeVal || { type: thrift_server_core_1.TType.I64 };
                    break;
                case thrift_parser_1.SyntaxType.ListType: {
                    const ofTypeList = getGraphQLFunctionType(functionType.valueType, id);
                    inputType = new graphql_1.GraphQLList(ofTypeList.inputType);
                    outputType = new graphql_1.GraphQLList(ofTypeList.outputType);
                    typeVal = typeVal || { type: thrift_server_core_1.TType.LIST, elementType: ofTypeList.typeVal };
                    break;
                }
                case thrift_parser_1.SyntaxType.SetType: {
                    const ofSetType = getGraphQLFunctionType(functionType.valueType, id);
                    inputType = new graphql_1.GraphQLList(ofSetType.inputType);
                    outputType = new graphql_1.GraphQLList(ofSetType.outputType);
                    typeVal = typeVal || { type: thrift_server_core_1.TType.SET, elementType: ofSetType.typeVal };
                    break;
                }
                case thrift_parser_1.SyntaxType.MapType: {
                    inputType = graphql_scalars_1.GraphQLJSON;
                    outputType = graphql_scalars_1.GraphQLJSON;
                    const ofTypeKey = getGraphQLFunctionType(functionType.keyType, id);
                    const ofTypeValue = getGraphQLFunctionType(functionType.valueType, id);
                    typeVal = typeVal || {
                        type: thrift_server_core_1.TType.MAP,
                        keyType: ofTypeKey.typeVal,
                        valType: ofTypeValue.typeVal,
                    };
                    break;
                }
                case thrift_parser_1.SyntaxType.Identifier: {
                    const typeName = functionType.value;
                    if (enumTypeMap.has(typeName)) {
                        const enumType = enumTypeMap.get(typeName);
                        inputType = enumType;
                        outputType = enumType;
                    }
                    if (inputTypeMap.has(typeName)) {
                        inputType = inputTypeMap.get(typeName);
                    }
                    if (outputTypeMap.has(typeName)) {
                        outputType = outputTypeMap.get(typeName);
                    }
                    typeVal = topTypeMap[typeName];
                    break;
                }
                default:
                    throw new Error(`Unknown function type: ${cross_helpers_1.util.inspect(functionType)}!`);
            }
            return {
                inputType: inputType,
                outputType: outputType,
                typeVal: {
                    ...typeVal,
                    id,
                },
            };
        }
        const { args: commonArgs, contextVariables } = (0, string_interpolation_1.parseInterpolationStrings)(Object.values(operationHeaders || {}));
        const headersFactory = (0, string_interpolation_1.getInterpolatedHeadersFactory)(operationHeaders);
        for (const statement of thriftAST.body) {
            switch (statement.type) {
                case thrift_parser_1.SyntaxType.EnumDefinition:
                    enumTypeMap.set(statement.name.value, new graphql_1.GraphQLEnumType({
                        name: statement.name.value,
                        description: processComments(statement.comments),
                        values: statement.members.reduce((prev, curr) => ({
                            ...prev,
                            [curr.name.value]: {
                                description: processComments(curr.comments),
                                value: curr.name.value,
                            },
                        }), {}),
                    }));
                    break;
                case thrift_parser_1.SyntaxType.StructDefinition: {
                    const structName = statement.name.value;
                    const description = processComments(statement.comments);
                    const objectFields = {};
                    const inputObjectFields = {};
                    const structTypeVal = {
                        id: Math.random(),
                        name: structName,
                        type: thrift_server_core_1.TType.STRUCT,
                        fields: {},
                    };
                    topTypeMap[structName] = structTypeVal;
                    const structFieldTypeMap = structTypeVal.fields;
                    for (const field of statement.fields) {
                        const fieldName = field.name.value;
                        let fieldOutputType;
                        let fieldInputType;
                        const description = processComments(field.comments);
                        const processedFieldTypes = getGraphQLFunctionType(field.fieldType, (_a = field.fieldID) === null || _a === void 0 ? void 0 : _a.value);
                        fieldOutputType = processedFieldTypes.outputType;
                        fieldInputType = processedFieldTypes.inputType;
                        if (field.requiredness === 'required') {
                            fieldOutputType = new graphql_1.GraphQLNonNull(fieldOutputType);
                            fieldInputType = new graphql_1.GraphQLNonNull(fieldInputType);
                        }
                        objectFields[fieldName] = {
                            type: fieldOutputType,
                            description,
                        };
                        inputObjectFields[fieldName] = {
                            type: fieldInputType,
                            description,
                        };
                        structFieldTypeMap[fieldName] = processedFieldTypes.typeVal;
                    }
                    outputTypeMap.set(structName, new graphql_1.GraphQLObjectType({
                        name: structName,
                        description,
                        fields: objectFields,
                    }));
                    inputTypeMap.set(structName, new graphql_1.GraphQLInputObjectType({
                        name: structName + 'Input',
                        description,
                        fields: inputObjectFields,
                    }));
                    break;
                }
                case thrift_parser_1.SyntaxType.ServiceDefinition:
                    for (const fnIndex in statement.functions) {
                        const fn = statement.functions[fnIndex];
                        const fnName = fn.name.value;
                        const description = processComments(fn.comments);
                        const { outputType: returnType } = getGraphQLFunctionType(fn.returnType, Number(fnIndex) + 1);
                        const args = {};
                        for (const argName in commonArgs) {
                            const typeNameOrType = commonArgs[argName].type;
                            args[argName] = {
                                type: typeof typeNameOrType === 'string'
                                    ? inputTypeMap.get(typeNameOrType)
                                    : typeNameOrType || graphql_1.GraphQLID,
                            };
                        }
                        const fieldTypeMap = {};
                        for (const field of fn.fields) {
                            const fieldName = field.name.value;
                            const fieldDescription = processComments(field.comments);
                            let { inputType: fieldType, typeVal } = getGraphQLFunctionType(field.fieldType, (_b = field.fieldID) === null || _b === void 0 ? void 0 : _b.value);
                            if (field.requiredness === 'required') {
                                fieldType = new graphql_1.GraphQLNonNull(fieldType);
                            }
                            args[fieldName] = {
                                type: fieldType,
                                description: fieldDescription,
                            };
                            fieldTypeMap[fieldName] = typeVal;
                        }
                        rootFields[fnName] = {
                            type: returnType,
                            description,
                            args,
                            resolve: async (root, args, context, info) => thriftHttpClient.doRequest(fnName, args, fieldTypeMap, {
                                headers: headersFactory({ root, args, context, info, env: cross_helpers_1.process.env }),
                            }),
                        };
                        methodNames.push(fnName);
                        methodAnnotations[fnName] = { annotations: {}, fieldAnnotations: {} };
                        methodParameters[fnName] = fn.fields.length + 1;
                    }
                    break;
                case thrift_parser_1.SyntaxType.TypedefDefinition: {
                    const { inputType, outputType } = getGraphQLFunctionType(statement.definitionType, Math.random());
                    const typeName = statement.name.value;
                    inputTypeMap.set(typeName, inputType);
                    outputTypeMap.set(typeName, outputType);
                    break;
                }
            }
        }
        const queryObjectType = new graphql_1.GraphQLObjectType({
            name: 'Query',
            fields: rootFields,
        });
        const schema = new graphql_1.GraphQLSchema({
            query: queryObjectType,
        });
        return {
            schema,
            contextVariables,
        };
    }
}
exports.default = ThriftHandler;
