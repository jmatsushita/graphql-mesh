"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const utils_1 = require("@graphql-tools/utils");
class PruneTransform {
    constructor(options) {
        this.options = options;
        this.noWrap = true;
    }
    transformSchema(schema) {
        return (0, utils_1.pruneSchema)(schema, {
            ...this.options.config,
            skipPruning: this.options.config.skipPruning
                ? type => this.options.config.skipPruning.includes(type.name)
                : undefined,
        });
    }
}
exports.default = PruneTransform;
