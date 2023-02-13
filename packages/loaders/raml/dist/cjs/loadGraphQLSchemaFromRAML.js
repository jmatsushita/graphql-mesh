"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.processDirectives = exports.loadNonExecutableGraphQLSchemaFromRAML = exports.loadGraphQLSchemaFromRAML = void 0;
const json_schema_1 = require("@omnigraph/json-schema");
const getJSONSchemaOptionsFromRAMLOptions_js_1 = require("./getJSONSchemaOptionsFromRAMLOptions.js");
/**
 * Creates a local GraphQLSchema instance from a RAML API Document.
 * Everytime this function is called, the RAML file and its dependencies will be resolved on runtime.
 * If you want to avoid this, use `createBundle` function to create a bundle once and save it to a storage
 * then load it with `loadGraphQLSchemaFromBundle`.
 */
async function loadGraphQLSchemaFromRAML(name, options) {
    const extraJSONSchemaOptions = await (0, getJSONSchemaOptionsFromRAMLOptions_js_1.getJSONSchemaOptionsFromRAMLOptions)(options);
    return (0, json_schema_1.loadGraphQLSchemaFromJSONSchemas)(name, {
        ...options,
        ...extraJSONSchemaOptions,
    });
}
exports.loadGraphQLSchemaFromRAML = loadGraphQLSchemaFromRAML;
async function loadNonExecutableGraphQLSchemaFromRAML(name, options) {
    const extraJSONSchemaOptions = await (0, getJSONSchemaOptionsFromRAMLOptions_js_1.getJSONSchemaOptionsFromRAMLOptions)(options);
    return (0, json_schema_1.loadNonExecutableGraphQLSchemaFromJSONSchemas)(name, {
        ...options,
        ...extraJSONSchemaOptions,
    });
}
exports.loadNonExecutableGraphQLSchemaFromRAML = loadNonExecutableGraphQLSchemaFromRAML;
var json_schema_2 = require("@omnigraph/json-schema");
Object.defineProperty(exports, "processDirectives", { enumerable: true, get: function () { return json_schema_2.processDirectives; } });
