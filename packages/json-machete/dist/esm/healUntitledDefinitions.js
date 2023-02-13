export function handleUntitledDefinitions(schemaDocument) {
    var _a, _b, _c;
    const seen = new Map();
    function handleDefinitions(definitions) {
        for (const definitionName in definitions) {
            const definition = definitions[definitionName];
            if (!definition.$ref) {
                if (!definition.title) {
                    definition.title = definitionName;
                    if (definition.title === 'Subscription') {
                        definition.title += '_';
                    }
                }
                else {
                    const seenDefinition = seen.get(definition.title);
                    if (seenDefinition) {
                        definition.title = definitionName;
                        seenDefinition.definition.title = seenDefinition.definitionName;
                    }
                    seen.set(definition.title, { definitionName, definition });
                }
            }
        }
    }
    if (schemaDocument.definitions) {
        handleDefinitions(schemaDocument.definitions);
    }
    if ((_a = schemaDocument.components) === null || _a === void 0 ? void 0 : _a.schemas) {
        handleDefinitions(schemaDocument.components.schemas);
    }
    const bodyTypeMap = {
        responses: 'response',
        requestBodies: 'request',
    };
    for (const bodyType in bodyTypeMap) {
        const bodies = (_b = schemaDocument.components) === null || _b === void 0 ? void 0 : _b[bodyType];
        if (bodies) {
            for (const bodyName in bodies) {
                const body = bodies[bodyName];
                if (body.content) {
                    for (const contentType in body.content) {
                        const contentObj = body.content[contentType];
                        const contentSchema = contentObj.schema;
                        if (contentSchema && !contentSchema.$ref) {
                            if (!contentSchema.title) {
                                contentSchema.title = bodyName;
                                if (contentType !== 'application/json') {
                                    contentSchema.title += `_${contentType.split('/')[1]}`;
                                }
                                const suffix = bodyTypeMap[bodyType];
                                contentSchema.title += '_' + suffix;
                            }
                            if (body.description && !contentSchema.description) {
                                contentSchema.description = body.description;
                            }
                        }
                    }
                }
            }
        }
    }
    const inputTypeMap = {
        parameters: 'parameter',
        headers: 'header',
    };
    for (const inputType in inputTypeMap) {
        const inputs = (_c = schemaDocument.components) === null || _c === void 0 ? void 0 : _c[inputType];
        if (inputs) {
            for (const inputName in inputs) {
                const input = inputs[inputName];
                const inputSchema = input.schema;
                if (inputSchema && !inputSchema.$ref) {
                    if (!inputSchema.title) {
                        const suffix = inputTypeMap[inputType];
                        inputSchema.title = inputName + '_' + suffix;
                    }
                    if (input.description && !inputSchema.description) {
                        inputSchema.description = input.description;
                    }
                }
            }
        }
    }
}
