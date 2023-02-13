"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getValidTypeName = void 0;
const utils_1 = require("@graphql-mesh/utils");
const utils_2 = require("@graphql-tools/utils");
function getValidTypeName({ schemaComposer, isInput, subSchema, }) {
    if (!subSchema.title) {
        throw new Error('Missing title for schema; ' + (0, utils_2.inspect)(subSchema));
    }
    const sanitizedName = (0, utils_1.sanitizeNameForGraphQL)(isInput ? subSchema.title + '_Input' : subSchema.title);
    if (schemaComposer.has(sanitizedName)) {
        let i = 2;
        while (schemaComposer.has(sanitizedName + i)) {
            i++;
        }
        return sanitizedName + i;
    }
    return sanitizedName;
}
exports.getValidTypeName = getValidTypeName;
