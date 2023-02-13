"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDereferencedJSONSchemaFromOperations = void 0;
const getReferencedJSONSchemaFromOperations_js_1 = require("./getReferencedJSONSchemaFromOperations.js");
const json_machete_1 = require("json-machete");
const string_interpolation_1 = require("@graphql-mesh/string-interpolation");
const cross_helpers_1 = require("@graphql-mesh/cross-helpers");
async function getDereferencedJSONSchemaFromOperations({ operations, cwd = cross_helpers_1.process.cwd(), logger, fetchFn, schemaHeaders, ignoreErrorResponses, endpoint, operationHeaders, queryParams, }) {
    const referencedJSONSchema = await (0, getReferencedJSONSchemaFromOperations_js_1.getReferencedJSONSchemaFromOperations)({
        operations,
        cwd,
        schemaHeaders,
        ignoreErrorResponses,
        fetchFn,
        endpoint,
        operationHeaders,
        queryParams,
    });
    logger.debug(`Dereferencing JSON Schema to resolve all $refs`);
    const schemaHeadersFactory = (0, string_interpolation_1.getInterpolatedHeadersFactory)(schemaHeaders);
    const fullyDeferencedSchema = await (0, json_machete_1.dereferenceObject)(referencedJSONSchema, {
        cwd,
        fetchFn,
        logger: logger.child('dereferenceObject'),
        headers: schemaHeadersFactory({ env: cross_helpers_1.process.env }),
    });
    logger.debug(`Healing JSON Schema`);
    const healedSchema = await (0, json_machete_1.healJSONSchema)(fullyDeferencedSchema, {
        logger: logger.child('healJSONSchema'),
    });
    return healedSchema;
}
exports.getDereferencedJSONSchemaFromOperations = getDereferencedJSONSchemaFromOperations;
