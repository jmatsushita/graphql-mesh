"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.computeCacheKey = void 0;
const string_interpolation_1 = require("@graphql-mesh/string-interpolation");
const cross_helpers_1 = require("@graphql-mesh/cross-helpers");
function computeCacheKey(options) {
    const argsHash = options.args ? (0, string_interpolation_1.hashObject)(options.args) : '';
    const fieldNamesHash = (0, string_interpolation_1.hashObject)(options.info.fieldNodes);
    if (!options.keyStr) {
        return `${options.info.parentType.name}-${options.info.fieldName}-${argsHash}-${fieldNamesHash}`;
    }
    const templateData = {
        typeName: options.info.parentType.name,
        fieldName: options.info.fieldName,
        args: options.args,
        argsHash,
        fieldNamesHash,
        info: options.info || null,
        env: cross_helpers_1.process.env,
    };
    return string_interpolation_1.stringInterpolator.parse(options.keyStr, templateData);
}
exports.computeCacheKey = computeCacheKey;
