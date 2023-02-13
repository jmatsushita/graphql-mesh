"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getJSONSchemaStringFormatScalarMap = void 0;
const tslib_1 = require("tslib");
const ajv_1 = tslib_1.__importDefault(require("ajv"));
const ajv_formats_1 = tslib_1.__importDefault(require("ajv-formats"));
const graphql_1 = require("graphql");
const pascal_case_1 = require("pascal-case");
const JSONSchemaStringFormats = [
    'date',
    'hostname',
    'regex',
    'json-pointer',
    'relative-json-pointer',
    'uri-reference',
    'uri-template',
];
function getJSONSchemaStringFormatScalarMap() {
    const ajv = new ajv_1.default({
        strict: false,
    });
    (0, ajv_formats_1.default)(ajv);
    const map = new Map();
    for (const format of JSONSchemaStringFormats) {
        const schema = {
            type: 'string',
            format,
        };
        let validate;
        try {
            validate = ajv.compile(schema);
        }
        catch (e) {
            validate = (value) => ajv.validate(schema, value);
        }
        const coerceString = (value) => {
            if (validate(value)) {
                return value;
            }
            throw new Error(`Expected ${format} but got: ${value}`);
        };
        const scalar = new graphql_1.GraphQLScalarType({
            name: (0, pascal_case_1.pascalCase)(format),
            description: `Represents ${format} values`,
            serialize: coerceString,
            parseValue: coerceString,
            parseLiteral: ast => {
                if (ast.kind === graphql_1.Kind.STRING) {
                    return coerceString(ast.value);
                }
                throw new Error(`Expected string in ${format} format but got: ${ast.value}`);
            },
            extensions: {
                codegenScalarType: 'string',
            },
        });
        map.set(format, scalar);
    }
    return map;
}
exports.getJSONSchemaStringFormatScalarMap = getJSONSchemaStringFormatScalarMap;
