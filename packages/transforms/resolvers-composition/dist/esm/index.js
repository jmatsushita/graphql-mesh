import { addResolversToSchema } from '@graphql-tools/schema';
import { composeResolvers } from '@graphql-tools/resolvers-composition';
import { extractResolvers, loadFromModuleExportExpression } from '@graphql-mesh/utils';
export default class ResolversCompositionTransform {
    constructor({ baseDir, config, importFn, }) {
        this.noWrap = config.mode ? config.mode !== 'wrap' : false; // use config.mode value or default to false
        this.compositions = Array.isArray(config) ? config : config.compositions;
        this.baseDir = baseDir;
        this.importFn = importFn;
    }
    transformSchema(schema) {
        const resolversComposition = {};
        for (const { resolver, composer } of this.compositions) {
            const composerFn$ = loadFromModuleExportExpression(composer, {
                cwd: this.baseDir,
                defaultExportName: 'default',
                importFn: this.importFn,
            });
            resolversComposition[resolver] =
                next => (...args) => composerFn$
                    .then(composerFn => (composerFn ? composerFn(next) : next))
                    .then(next => next(...args));
        }
        const resolvers = extractResolvers(schema);
        const composedResolvers = composeResolvers(resolvers, resolversComposition);
        return addResolversToSchema({
            schema,
            resolvers: composedResolvers,
            updateResolversInPlace: true,
        });
    }
}
