"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getGraphQLSchemaFromDereferencedJSONSchema = void 0;
const graphql_1 = require("graphql");
const graphql_compose_1 = require("graphql-compose");
const addExecutionLogicToComposer_js_1 = require("./addExecutionLogicToComposer.js");
const getComposerFromJSONSchema_js_1 = require("./getComposerFromJSONSchema.js");
async function getGraphQLSchemaFromDereferencedJSONSchema(name, opts) {
    const { fullyDeferencedSchema, logger, operations, operationHeaders, endpoint, queryParams, queryStringOptions, } = opts;
    logger.debug(`Generating GraphQL Schema from the bundled JSON Schema`);
    const visitorResult = await (0, getComposerFromJSONSchema_js_1.getComposerFromJSONSchema)(fullyDeferencedSchema, logger.child('getComposerFromJSONSchema'));
    const schemaComposerWithoutExecutionLogic = visitorResult.output;
    if (!(schemaComposerWithoutExecutionLogic instanceof graphql_compose_1.SchemaComposer)) {
        throw new Error('The visitor result should be a SchemaComposer instance.');
    }
    // graphql-compose doesn't add @defer and @stream to the schema
    for (const directive of graphql_1.specifiedDirectives) {
        schemaComposerWithoutExecutionLogic.addDirective(directive);
    }
    const schemaComposerWithExecutionLogic = await (0, addExecutionLogicToComposer_js_1.addExecutionDirectivesToComposer)(name, {
        schemaComposer: schemaComposerWithoutExecutionLogic,
        logger,
        operations,
        operationHeaders,
        endpoint,
        queryParams,
        queryStringOptions,
    });
    if (schemaComposerWithExecutionLogic.Query.getFieldNames().length === 0) {
        schemaComposerWithExecutionLogic.Query.addFields({
            dummy: {
                type: 'String',
                resolve: () => 'dummy',
            },
        });
    }
    return schemaComposerWithExecutionLogic.buildSchema();
}
exports.getGraphQLSchemaFromDereferencedJSONSchema = getGraphQLSchemaFromDereferencedJSONSchema;
