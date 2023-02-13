"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const cross_helpers_1 = require("@graphql-mesh/cross-helpers");
const code_file_loader_1 = require("@graphql-tools/code-file-loader");
const graphql_file_loader_1 = require("@graphql-tools/graphql-file-loader");
const load_1 = require("@graphql-tools/load");
const schema_1 = require("@graphql-tools/schema");
const utils_1 = require("@graphql-tools/utils");
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
        if (!cross_helpers_1.path.isAbsolute(modulePath)) {
            const absoluteModulePath = cross_helpers_1.path.isAbsolute(modulePath)
                ? modulePath
                : cross_helpers_1.path.join(cwd, modulePath);
            return require(absoluteModulePath);
        }
    }
}
class ExtendTransform {
    constructor({ baseDir, config }) {
        this.noWrap = true;
        this.config = config;
        this.baseDir = baseDir;
    }
    transformSchema(schema) {
        const sources = (0, load_1.loadTypedefsSync)(this.config.typeDefs, {
            cwd: cross_helpers_1.path.isAbsolute(this.config.typeDefs) ? null : this.baseDir,
            loaders: [new code_file_loader_1.CodeFileLoader(), new graphql_file_loader_1.GraphQLFileLoader()],
        });
        const typeDefs = sources.map(source => source.document);
        const resolvers = (0, utils_1.asArray)(this.config.resolvers).map(resolverDef => {
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
        return (0, schema_1.mergeSchemas)({
            schemas: [schema],
            typeDefs,
            resolvers,
        });
    }
}
exports.default = ExtendTransform;
