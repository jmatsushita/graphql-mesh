"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.IGNORED_TYPE_NAMES = exports.IGNORED_ROOT_FIELD_NAMES = exports.NAMING_CONVENTIONS = void 0;
const change_case_1 = require("change-case");
const upper_case_1 = require("upper-case");
const lower_case_1 = require("lower-case");
const graphql_scalars_1 = require("graphql-scalars");
exports.NAMING_CONVENTIONS = {
    camelCase: change_case_1.camelCase,
    capitalCase: change_case_1.capitalCase,
    constantCase: change_case_1.constantCase,
    dotCase: change_case_1.dotCase,
    headerCase: change_case_1.headerCase,
    noCase: change_case_1.noCase,
    paramCase: change_case_1.paramCase,
    pascalCase: change_case_1.pascalCase,
    pathCase: change_case_1.pathCase,
    sentenceCase: change_case_1.sentenceCase,
    snakeCase: change_case_1.snakeCase,
    upperCase: upper_case_1.upperCase,
    lowerCase: lower_case_1.lowerCase,
};
// Ignore fields needed by Federation spec
exports.IGNORED_ROOT_FIELD_NAMES = ['_service', '_entities'];
exports.IGNORED_TYPE_NAMES = [
    'Int',
    'Float',
    'String',
    'Boolean',
    'ID',
    'date',
    'hostname',
    'regex',
    'json-pointer',
    'relative-json-pointer',
    'uri-reference',
    'uri-template',
    'ObjMap',
    'HttpMethod',
    ...Object.keys(graphql_scalars_1.resolvers),
];
