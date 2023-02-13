import { extendSchema, defaultFieldResolver, } from 'graphql';
import { loadFromModuleExportExpression } from '@graphql-mesh/utils';
import { CodeFileLoader } from '@graphql-tools/code-file-loader';
import { GraphQLFileLoader } from '@graphql-tools/graphql-file-loader';
import { loadTypedefsSync } from '@graphql-tools/load';
import { MapperKind, mapSchema, selectObjectFields } from '@graphql-tools/utils';
// Execute original field resolver and return single property to be hoisted from rsesolver reponse
const defaultHoistFieldComposer = (next, targetFieldName) => async (root, args, context, info) => {
    const rawResult = await next(root, args, context, info);
    return rawResult && rawResult[targetFieldName];
};
export default class ReplaceFieldTransform {
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
            const composerFn$ = loadFromModuleExportExpression(composer, {
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
            loadTypedefsSync(this.typeDefs, {
                cwd: this.baseDir,
                loaders: [new CodeFileLoader(), new GraphQLFileLoader()],
            });
        const baseSchema = additionalTypeDefs
            ? extendSchema(schema, additionalTypeDefs[0].document)
            : schema;
        const transformedSchema = mapSchema(baseSchema, {
            [MapperKind.COMPOSITE_FIELD]: (fieldConfig, currentFieldName, typeName) => {
                const fieldKey = `${typeName}.${currentFieldName}`;
                const newFieldConfig = this.replacementsMap.get(fieldKey);
                if (!newFieldConfig) {
                    return undefined;
                }
                const fieldName = newFieldConfig.name || currentFieldName;
                const targetFieldName = newFieldConfig.field;
                const targetFieldConfig = selectObjectFields(baseSchema, newFieldConfig.type, fieldName => fieldName === targetFieldName)[targetFieldName];
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
                    fieldConfig.resolve = defaultHoistFieldComposer(fieldConfig.resolve || defaultFieldResolver, targetFieldName);
                }
                // wrap user-defined composer to current field resolver or, if not preset, defaultFieldResolver
                fieldConfig.resolve = newFieldConfig.composer(fieldConfig.resolve || defaultFieldResolver);
                // avoid re-iterating over replacements that have already been applied
                this.replacementsMap.delete(fieldKey);
                return [fieldName, fieldConfig];
            },
        });
        return transformedSchema;
    }
}
