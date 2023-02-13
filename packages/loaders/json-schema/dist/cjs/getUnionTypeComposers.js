"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getUnionTypeComposers = exports.getContainerTC = void 0;
const graphql_compose_1 = require("graphql-compose");
const directives_js_1 = require("./directives.js");
function getContainerTC(schemaComposer, output) {
    const containerTypeName = `${output.getTypeName()}_container`;
    return schemaComposer.getOrCreateOTC(containerTypeName, otc => otc.addFields({
        [output.getTypeName()]: {
            type: output,
            resolve: root => root,
        },
    }));
}
exports.getContainerTC = getContainerTC;
function getUnionTypeComposers({ schemaComposer, typeComposersList, subSchemaAndTypeComposers, logger, }) {
    var _a;
    if (new Set(typeComposersList).size === 1) {
        return typeComposersList[0];
    }
    const unionInputFields = {};
    const outputTypeComposers = [];
    typeComposersList.forEach(typeComposers => {
        const { input, output } = typeComposers;
        if ((0, graphql_compose_1.isSomeInputTypeComposer)(output)) {
            outputTypeComposers.push(getContainerTC(schemaComposer, output));
        }
        else {
            outputTypeComposers.push(output);
        }
        if (input) {
            unionInputFields[input.getTypeName()] = {
                type: input,
            };
        }
        if (!input) {
            logger.debug(`No input type composer found for ${output.getTypeName()}, skipping...`);
        }
    });
    if (Object.keys(unionInputFields).length === 1) {
        subSchemaAndTypeComposers.input = Object.values(unionInputFields)[0].type;
    }
    else {
        subSchemaAndTypeComposers.input.addFields(unionInputFields);
    }
    if (new Set(outputTypeComposers).size === 1) {
        subSchemaAndTypeComposers.output = outputTypeComposers[0];
    }
    else {
        const directives = subSchemaAndTypeComposers.output.getDirectives() || [];
        const statusCodeOneOfIndexMap = subSchemaAndTypeComposers.output.getExtension('statusCodeOneOfIndexMap');
        const statusCodeOneOfIndexMapEntries = Object.entries(statusCodeOneOfIndexMap || {});
        for (const outputTypeComposerIndex in outputTypeComposers) {
            const outputTypeComposer = outputTypeComposers[outputTypeComposerIndex];
            const statusCode = (_a = statusCodeOneOfIndexMapEntries.find(([statusCode, index]) => index.toString() === outputTypeComposerIndex.toString())) === null || _a === void 0 ? void 0 : _a[0];
            if ('getFields' in outputTypeComposer) {
                if (statusCode != null) {
                    schemaComposer.addDirective(directives_js_1.StatusCodeTypeNameDirective);
                    directives.push({
                        name: 'statusCodeTypeName',
                        args: {
                            statusCode,
                            typeName: outputTypeComposer.getTypeName(),
                        },
                    });
                }
                subSchemaAndTypeComposers.output.addType(outputTypeComposer);
            }
            else {
                for (const possibleType of outputTypeComposer.getTypes()) {
                    subSchemaAndTypeComposers.output.addType(possibleType);
                }
            }
        }
        subSchemaAndTypeComposers.output.setDirectives(directives);
    }
    return {
        input: subSchemaAndTypeComposers.input,
        output: subSchemaAndTypeComposers.output,
        nullable: subSchemaAndTypeComposers.nullable,
        readOnly: subSchemaAndTypeComposers.readOnly,
        writeOnly: subSchemaAndTypeComposers.writeOnly,
    };
}
exports.getUnionTypeComposers = getUnionTypeComposers;
