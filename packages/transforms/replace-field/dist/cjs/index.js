"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const graphql_1 = require("graphql");
const utils_1 = require("@graphql-mesh/utils");
const code_file_loader_1 = require("@graphql-tools/code-file-loader");
const graphql_file_loader_1 = require("@graphql-tools/graphql-file-loader");
const load_1 = require("@graphql-tools/load");
const utils_2 = require("@graphql-tools/utils");
// Execute original field resolver and return single property to be hoisted from rsesolver reponse
const defaultHoistFieldComposer = (next, targetFieldName) => async (root, args, context, info) => {
    const rawResult = await next(root, args, context, info);
    return rawResult && rawResult[targetFieldName];
};
class ReplaceFieldTransform {
    constructor(options) {
        this.noWrap = true;
        const { baseDir, config, importFn } = options;
        this.baseDir = baseDir;
        this.typeDefs = config.typeDefs;
        this.replacementsMap = new Map();
        this.importFn = importFn;
        for (const replacement of config.replacements) {
            const { from: { type: fromTypeName, field: fromFieldName }, to: toConfig, scope, composer, name, } = replacement;
            const fieldKey = `${fromTypeName}.${fromFieldName}`;
            const composerFn$ = (0, utils_1.loadFromModuleExportExpression)(composer, {
                cwd: this.baseDir,
                defaultExportName: 'default',
                importFn: this.importFn,
            });
            this.replacementsMap.set(fieldKey, {
                ...toConfig,
                scope,
                composer: (fn) => (...args) => composerFn$
                    .then(composerFn => (composerFn ? composerFn(fn) : fn))
                    .then(fn => fn(...args)),
                name,
            });
        }
    }
    transformSchema(schema) {
        const additionalTypeDefs = this.typeDefs &&
            (0, load_1.loadTypedefsSync)(this.typeDefs, {
                cwd: this.baseDir,
                loaders: [new code_file_loader_1.CodeFileLoader(), new graphql_file_loader_1.GraphQLFileLoader()],
            });
        const baseSchema = additionalTypeDefs
            ? (0, graphql_1.extendSchema)(schema, additionalTypeDefs[0].document)
            : schema;
        const transformedSchema = (0, utils_2.mapSchema)(baseSchema, {
            [utils_2.MapperKind.COMPOSITE_FIELD]: (fieldConfig, currentFieldName, typeName) => {
                const fieldKey = `${typeName}.${currentFieldName}`;
                const newFieldConfig = this.replacementsMap.get(fieldKey);
                if (!newFieldConfig) {
                    return undefined;
                }
                const fieldName = newFieldConfig.name || currentFieldName;
                const targetFieldName = newFieldConfig.field;
                const targetFieldConfig = (0, utils_2.selectObjectFields)(baseSchema, newFieldConfig.type, fieldName => fieldName === targetFieldName)[targetFieldName];
                if (newFieldConfig.scope === 'config') {
                    const targetResolver = targetFieldConfig.resolve;
                    targetFieldConfig.resolve = newFieldConfig.composer(targetResolver);
                    // replace the entire field config
                    return [fieldName, targetFieldConfig];
                }
                // override field type with the target type requested
                fieldConfig.type = targetFieldConfig.type;
                // If renaming fields that don't have a custom resolver, we need to map response to original field name
                if (newFieldConfig.name && !fieldConfig.resolve)
                    fieldConfig.resolve = source => source[currentFieldName];
                if (newFieldConfig.scope === 'hoistValue') {
                    // implement value hoisting by wrapping a default composer that hoists the value from resolver result
                    fieldConfig.resolve = defaultHoistFieldComposer(fieldConfig.resolve || graphql_1.defaultFieldResolver, targetFieldName);
                }
                // wrap user-defined composer to current field resolver or, if not preset, defaultFieldResolver
                fieldConfig.resolve = newFieldConfig.composer(fieldConfig.resolve || graphql_1.defaultFieldResolver);
                // avoid re-iterating over replacements that have already been applied
                this.replacementsMap.delete(fieldKey);
                return [fieldName, fieldConfig];
            },
        });
        return transformedSchema;
    }
}
exports.default = ReplaceFieldTransform;
