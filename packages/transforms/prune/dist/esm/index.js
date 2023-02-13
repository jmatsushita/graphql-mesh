import { pruneSchema } from '@graphql-tools/utils';
export default class PruneTransform {
    constructor(options) {
        this.options = options;
        this.noWrap = true;
    }
    transformSchema(schema) {
        return pruneSchema(schema, {
            ...this.options.config,
            skipPruning: this.options.config.skipPruning
                ? type => this.options.config.skipPruning.includes(type.name)
                : undefined,
        });
    }
}
