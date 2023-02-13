"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ObjMapScalar = exports.GraphQLVoid = exports.GraphQLFile = void 0;
const graphql_1 = require("graphql");
exports.GraphQLFile = new graphql_1.GraphQLScalarType({
    name: 'File',
    description: 'The `File` scalar type represents a file upload.',
    extensions: {
        codegenScalarType: 'File',
    },
});
exports.GraphQLVoid = new graphql_1.GraphQLScalarType({
    name: 'Void',
    description: 'Represents empty values',
    serialize: () => '',
    extensions: {
        codegenScalarType: 'void',
    },
});
exports.ObjMapScalar = new graphql_1.GraphQLScalarType({
    name: 'ObjMap',
    serialize: value => JSON.stringify(value),
    parseValue: value => JSON.parse(value.toString()),
    parseLiteral: ast => {
        if (ast.kind === 'StringValue') {
            return JSON.parse(ast.value);
        }
        return null;
    },
});
