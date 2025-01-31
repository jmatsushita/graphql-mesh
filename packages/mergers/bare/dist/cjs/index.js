"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const utils_1 = require("@graphql-mesh/utils");
const schema_1 = require("@graphql-tools/schema");
const utils_2 = require("@graphql-tools/utils");
const graphql_1 = require("graphql");
const merger_stitching_1 = tslib_1.__importDefault(require("@graphql-mesh/merger-stitching"));
class BareMerger {
    constructor(options) {
        this.options = options;
        this.name = 'bare';
    }
    handleSingleWrappedExtendedSource(mergerCtx) {
        // switch to stitching merger
        this.name = 'stitching';
        this.options.logger.debug(`Switching to Stitching merger due to the transforms and additional resolvers`);
        this.options.logger = this.options.logger.child('Stitching Proxy');
        this.stitchingMerger = this.stitchingMerger || new merger_stitching_1.default(this.options);
        return this.stitchingMerger.getUnifiedSchema(mergerCtx);
    }
    handleSingleRegularSource({ rawSources: [rawSource], typeDefs, resolvers }) {
        let schema = rawSource.schema;
        if (typeDefs.length > 0 || (0, utils_2.asArray)(resolvers).length > 0) {
            for (const typeDef of typeDefs) {
                schema = (0, graphql_1.extendSchema)(schema, typeDef);
            }
            for (const resolversObj of (0, utils_2.asArray)(resolvers)) {
                (0, schema_1.addResolversToSchema)({
                    schema,
                    resolvers: resolversObj,
                    updateResolversInPlace: true,
                });
            }
        }
        this.options.logger.debug(`Attaching a dummy sourceMap to the final schema`);
        schema.extensions = schema.extensions || {};
        Object.defineProperty(schema.extensions, 'sourceMap', {
            get: () => {
                return {
                    get() {
                        // We should return a version of the schema only with the source-level transforms
                        // But we should prevent the existing schema from being mutated internally
                        const nonExecutableSchema = (0, utils_2.mapSchema)(schema);
                        return (0, utils_1.applySchemaTransforms)(nonExecutableSchema, rawSource, nonExecutableSchema, rawSource.transforms);
                    },
                };
            },
        });
        return {
            ...rawSource,
            schema,
        };
    }
    async getUnifiedSchema({ rawSources, typeDefs, resolvers }) {
        var _a;
        if (rawSources.length === 1) {
            if ((rawSources[0].executor || ((_a = rawSources[0].transforms) === null || _a === void 0 ? void 0 : _a.length)) &&
                (typeDefs.length > 0 || (0, utils_2.asArray)(resolvers).length > 0)) {
                return this.handleSingleWrappedExtendedSource({ rawSources, typeDefs, resolvers });
            }
            return this.handleSingleRegularSource({ rawSources, typeDefs, resolvers });
        }
        const sourceMap = new Map();
        this.options.logger.debug(`Applying transforms for each source`);
        const schemas = rawSources.map(source => {
            let schema = source.schema;
            let sourceLevelSchema = source.schema;
            schema = (0, utils_1.applySchemaTransforms)(schema, undefined, schema, source.transforms);
            // After that step, it will be considered as root level schema
            sourceLevelSchema = schema;
            sourceMap.set(source, sourceLevelSchema);
            return schema;
        });
        this.options.logger.debug(`Merging sources`);
        const unifiedSchema = (0, schema_1.mergeSchemas)({
            schemas,
            typeDefs,
            resolvers,
        });
        this.options.logger.debug(`Attaching sources to the unified schema`);
        unifiedSchema.extensions = unifiedSchema.extensions || {};
        Object.defineProperty(unifiedSchema.extensions, 'sourceMap', {
            get: () => sourceMap,
        });
        return {
            schema: unifiedSchema,
        };
    }
}
exports.default = BareMerger;
