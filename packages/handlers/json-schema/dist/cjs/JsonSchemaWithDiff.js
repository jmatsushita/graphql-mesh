"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.JsonSchemaWithDiff = void 0;
const store_1 = require("@graphql-mesh/store");
const json_machete_1 = require("json-machete");
exports.JsonSchemaWithDiff = {
    ...store_1.PredefinedProxyOptions.JsonWithoutValidation,
    validate: json_machete_1.compareJSONSchemas,
};
