import { camelCase, capitalCase, constantCase, dotCase, headerCase, noCase, paramCase, pascalCase, pathCase, sentenceCase, snakeCase, } from 'change-case';
import { upperCase } from 'upper-case';
import { lowerCase } from 'lower-case';
import { resolvers as scalarsResolversMap } from 'graphql-scalars';
export const NAMING_CONVENTIONS = {
    camelCase,
    capitalCase,
    constantCase,
    dotCase,
    headerCase,
    noCase,
    paramCase,
    pascalCase,
    pathCase,
    sentenceCase,
    snakeCase,
    upperCase,
    lowerCase,
};
// Ignore fields needed by Federation spec
export const IGNORED_ROOT_FIELD_NAMES = ['_service', '_entities'];
export const IGNORED_TYPE_NAMES = [
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
    ...Object.keys(scalarsResolversMap),
];
