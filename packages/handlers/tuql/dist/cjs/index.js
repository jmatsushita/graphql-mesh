"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tuql_1 = require("tuql");
const cross_helpers_1 = require("@graphql-mesh/cross-helpers");
class TuqlHandler {
    constructor({ config, baseDir }) {
        this.config = config;
        this.baseDir = baseDir;
    }
    async getMeshSource() {
        const { schema, contextVariables } = await (this.config.infile
            ? (0, tuql_1.buildSchemaFromInfile)(cross_helpers_1.path.isAbsolute(this.config.infile)
                ? this.config.db
                : cross_helpers_1.path.join(this.baseDir, this.config.infile))
            : (0, tuql_1.buildSchemaFromDatabase)(cross_helpers_1.path.isAbsolute(this.config.db)
                ? this.config.infile
                : cross_helpers_1.path.join(this.baseDir, this.config.db)));
        return {
            schema,
            contextVariables,
        };
    }
}
exports.default = TuqlHandler;
