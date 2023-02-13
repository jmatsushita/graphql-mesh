"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const schema_1 = require("@graphql-tools/schema");
const resolvers_composition_1 = require("@graphql-tools/resolvers-composition");
const utils_1 = require("@graphql-mesh/utils");
class ResolversCompositionTransform {
    constructor({ baseDir, config, importFn, }) {
        this.noWrap = config.mode ? config.mode !== 'wrap' : false; // use config.mode value or default to false
        this.compositions = Array.isArray(config) ? config : config.compositions;
        this.baseDir = baseDir;
        this.importFn = importFn;
    }
    transformSchema(schema) {
        const resolversComposition = {};
        for (const { resolver, composer } of this.compositions) {
            const composerFn$ = (0, utils_1.loadFromModuleExportExpression)(composer, {
                cwd: this.baseDir,
                defaultExportName: 'default',
                importFn: this.importFn,
            });
            resolversComposition[resolver] =
                next => (...args) => composerFn$
                    .then(composerFn => (composerFn ? composerFn(next) : next))
                    .then(next => next(...args));
        }
        const resolvers = (0, utils_1.extractResolvers)(schema);
        const composedResolvers = (0, resolvers_composition_1.composeResolvers)(resolvers, resolversComposition);
        return (0, schema_1.addResolversToSchema)({
            schema,
            resolvers: composedResolvers,
            updateResolversInPlace: true,
        });
    }
}
exports.default = ResolversCompositionTransform;
