import { path as pathModule } from '@graphql-mesh/cross-helpers';
import { CodeFileLoader } from '@graphql-tools/code-file-loader';
import { GraphQLFileLoader } from '@graphql-tools/graphql-file-loader';
import { loadTypedefsSync } from '@graphql-tools/load';
import { mergeSchemas } from '@graphql-tools/schema';
import { asArray } from '@graphql-tools/utils';
function loadFromModuleExportExpressionSync({ expression, defaultExportName, cwd, }) {
    if (typeof expression !== 'string') {
        return expression;
    }
    const [modulePath, exportName = defaultExportName] = expression.split('#');
    const mod = tryRequire(modulePath, cwd);
    return mod[exportName] || (mod.default && mod.default[exportName]) || mod.default || mod;
}
function tryRequire(modulePath, cwd) {
    try {
        return require(modulePath);
    }
    catch (_a) {
        if (!pathModule.isAbsolute(modulePath)) {
            const absoluteModulePath = pathModule.isAbsolute(modulePath)
                ? modulePath
                : pathModule.join(cwd, modulePath);
            return require(absoluteModulePath);
        }
    }
}
export default class ExtendTransform {
    constructor({ baseDir, config }) {
        this.noWrap = true;
        this.config = config;
        this.baseDir = baseDir;
    }
    transformSchema(schema) {
        const sources = loadTypedefsSync(this.config.typeDefs, {
            cwd: pathModule.isAbsolute(this.config.typeDefs) ? null : this.baseDir,
            loaders: [new CodeFileLoader(), new GraphQLFileLoader()],
        });
        const typeDefs = sources.map(source => source.document);
        const resolvers = asArray(this.config.resolvers).map(resolverDef => {
            if (typeof resolverDef === 'string') {
                return loadFromModuleExportExpressionSync({
                    expression: resolverDef,
                    defaultExportName: 'default',
                    cwd: this.baseDir,
                });
            }
            else {
                return resolverDef;
            }
        });
        return mergeSchemas({
            schemas: [schema],
            typeDefs,
            resolvers,
        });
    }
}
