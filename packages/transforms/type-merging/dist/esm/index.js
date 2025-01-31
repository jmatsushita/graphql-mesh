import { stitchingDirectives } from '@graphql-tools/stitching-directives';
export default class TypeMerging {
    constructor({ config, importFn }) {
        this.config = config;
        // this.baseDir = baseDir;
        this.importFn = importFn;
    }
    transformSchema(schema, subschemaConfig) {
        /**
         *
        if (this.config.additionalConfiguration) {
          const additionalConfiguration = loadFromModuleExportExpressionSync(this.config.additionalConfiguration, {
            cwd: this.baseDir,
            defaultExportName: 'default',
            syncImportFn: this.syncImportFn,
          });
          if (typeof additionalConfiguration !== 'object' || additionalConfiguration == null) {
            throw new Error(
              `Invalid additional type merging configuration provided in ${this.config.additionalConfiguration}`
            );
          }
          subschemaConfig.merge = subschemaConfig.merge || {};
          Object.assign(subschemaConfig.merge, additionalConfiguration);
        }
         */
        const { stitchingDirectivesTransformer } = stitchingDirectives();
        if (this.config.types) {
            for (const mergedTypeConfig of this.config.types) {
                const type = schema.getType(mergedTypeConfig.typeName);
                type.extensions = type.extensions || {};
                const typeDirectiveExtensions = (type.extensions.directives =
                    type.extensions.directives || {});
                if (mergedTypeConfig.key) {
                    typeDirectiveExtensions.key = mergedTypeConfig.key;
                }
                if (mergedTypeConfig.canonical) {
                    typeDirectiveExtensions.canonical = {};
                }
                if (mergedTypeConfig.fields) {
                    if (!('getFields' in type)) {
                        throw new Error('You cannot add field annotations to this type ' + mergedTypeConfig.typeName);
                    }
                    const fieldMap = type.getFields();
                    for (const fieldConfig of mergedTypeConfig.fields) {
                        const field = fieldMap[fieldConfig.fieldName];
                        field.extensions = field.extensions || {};
                        const fieldDirectiveExtensions = (field.extensions.directives =
                            field.extensions.directives || {});
                        if (fieldConfig.computed) {
                            fieldDirectiveExtensions.computed = fieldConfig.computed;
                        }
                    }
                }
            }
        }
        if (this.config.queryFields) {
            const queryFieldMap = schema.getQueryType().getFields();
            for (const { queryFieldName, ...rootFieldConfig } of this.config.queryFields) {
                const field = queryFieldMap[queryFieldName];
                field.extensions = field.extensions || {};
                const fieldDirectiveExtensions = (field.extensions.directives =
                    field.extensions.directives || {});
                fieldDirectiveExtensions.merge = rootFieldConfig;
            }
        }
        subschemaConfig.merge = stitchingDirectivesTransformer({ schema }).merge;
        return schema;
    }
}
