"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractResolvers = void 0;
const utils_1 = require("@graphql-tools/utils");
function extractResolvers(schema) {
    const allResolvers = (0, utils_1.getResolversFromSchema)(schema);
    const filteredResolvers = {};
    for (const prop in allResolvers) {
        if (!prop.startsWith('_')) {
            filteredResolvers[prop] = allResolvers[prop];
        }
        if (typeof filteredResolvers === 'object') {
            for (const fieldName in filteredResolvers[prop]) {
                if (!prop.startsWith('_resolveType')) {
                    filteredResolvers[prop][fieldName] = allResolvers[prop][fieldName];
                }
            }
        }
    }
    return filteredResolvers;
}
exports.extractResolvers = extractResolvers;
