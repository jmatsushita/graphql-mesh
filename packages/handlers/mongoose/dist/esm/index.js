import { composeWithMongoose, composeWithMongooseDiscriminators } from 'graphql-compose-mongoose';
import { SchemaComposer } from 'graphql-compose';
import { connect, disconnect } from 'mongoose';
import { loadFromModuleExportExpression } from '@graphql-mesh/utils';
import { specifiedDirectives } from 'graphql';
const modelQueryOperations = [
    'findById',
    'findByIds',
    'findOne',
    'findMany',
    'count',
    'connection',
    'pagination',
    'dataLoader',
    'dataLoaderMany',
];
const modelMutationOperations = [
    'createOne',
    'createMany',
    'updateById',
    'updateOne',
    'updateMany',
    'removeById',
    'removeOne',
    'removeMany',
];
export default class MongooseHandler {
    constructor({ config, baseDir, pubsub, importFn, }) {
        this.config = config;
        this.baseDir = baseDir;
        this.pubsub = pubsub;
        this.importFn = importFn;
    }
    async getMeshSource() {
        var _a, _b;
        if (this.config.connectionString) {
            connect(this.config.connectionString, {
                useNewUrlParser: true,
                useUnifiedTopology: true,
            }).catch(e => console.error(e));
            const id = this.pubsub.subscribe('destroy', () => {
                disconnect()
                    .catch(e => console.error(e))
                    .finally(() => this.pubsub.unsubscribe(id));
            });
        }
        const schemaComposer = new SchemaComposer();
        const typeMergingOptions = {};
        await Promise.all([
            Promise.all(((_a = this.config.models) === null || _a === void 0 ? void 0 : _a.map(async (modelConfig) => {
                const model = await loadFromModuleExportExpression(modelConfig.path, {
                    defaultExportName: modelConfig.name,
                    cwd: this.baseDir,
                    importFn: this.importFn,
                });
                if (!model) {
                    throw new Error(`Model ${modelConfig.name} cannot be imported ${modelConfig.path}!`);
                }
                const modelTC = composeWithMongoose(model, modelConfig.options);
                await Promise.all([
                    Promise.all(modelQueryOperations.map(async (queryOperation) => schemaComposer.Query.addFields({
                        [`${modelConfig.name}_${queryOperation}`]: modelTC.getResolver(queryOperation),
                    }))),
                    Promise.all(modelMutationOperations.map(async (mutationOperation) => schemaComposer.Mutation.addFields({
                        [`${modelConfig.name}_${mutationOperation}`]: modelTC.getResolver(mutationOperation),
                    }))),
                ]);
                const typeName = modelTC.getTypeName();
                typeMergingOptions[typeName] = {
                    selectionSet: `{ id }`,
                    key: ({ id }) => id,
                    argsFromKeys: ids => ({ ids }),
                    fieldName: `${typeName}_dataLoaderMany`,
                };
            })) || []),
            Promise.all(((_b = this.config.discriminators) === null || _b === void 0 ? void 0 : _b.map(async (discriminatorConfig) => {
                const discriminator = await loadFromModuleExportExpression(discriminatorConfig.path, {
                    defaultExportName: discriminatorConfig.name,
                    cwd: this.baseDir,
                    importFn: this.importFn,
                });
                const discriminatorTC = composeWithMongooseDiscriminators(discriminator, discriminatorConfig.options);
                await Promise.all([
                    Promise.all(modelQueryOperations.map(async (queryOperation) => schemaComposer.Query.addFields({
                        [`${discriminatorConfig.name}_${queryOperation}`]: discriminatorTC.getResolver(queryOperation),
                    }))),
                    Promise.all(modelMutationOperations.map(async (mutationOperation) => schemaComposer.Mutation.addFields({
                        [`${discriminatorConfig.name}_${mutationOperation}`]: discriminatorTC.getResolver(mutationOperation),
                    }))),
                ]);
                const typeName = discriminatorTC.getTypeName();
                typeMergingOptions[typeName] = {
                    selectionSet: `{ id }`,
                    key: ({ id }) => id,
                    argsFromKeys: ids => ({ ids }),
                    fieldName: `${typeName}_dataLoaderMany`,
                };
            })) || []),
        ]);
        // graphql-compose doesn't add @defer and @stream to the schema
        specifiedDirectives.forEach(directive => schemaComposer.addDirective(directive));
        const schema = schemaComposer.buildSchema();
        return {
            schema,
        };
    }
}
