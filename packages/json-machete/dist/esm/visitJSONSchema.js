const identicalFn = (a) => a;
const objectFields = [
    'additionalProperties',
    'additionalItems',
    'contains',
    'else',
    'if',
    'items',
    'not',
    'then',
];
const dictFields = [
    'anyOf',
    'allOf',
    'oneOf',
    'definitions',
    'properties',
    'patternProperties',
];
export async function visitJSONSchema(schema, { enter = identicalFn, leave = identicalFn, }, { visitedSubschemaResultMap, path } = {
    visitedSubschemaResultMap: new WeakMap(),
    path: '',
}) {
    var _a;
    if (typeof schema === 'object') {
        if (!visitedSubschemaResultMap.has(schema)) {
            const enterResult = await enter(schema, {
                visitedSubschemaResultMap,
                path,
            });
            visitedSubschemaResultMap.set(schema, enterResult);
            for (const key of objectFields) {
                if (enterResult[key]) {
                    enterResult[key] = await visitJSONSchema(enterResult[key], { enter, leave }, {
                        visitedSubschemaResultMap,
                        path: `${path}/${key}`,
                    });
                }
            }
            for (const key of dictFields) {
                if (enterResult[key]) {
                    const entries = Object.entries(enterResult[key]);
                    for (const [itemKey, itemValue] of entries) {
                        enterResult[key][itemKey] = await visitJSONSchema(itemValue, { enter, leave }, { visitedSubschemaResultMap, path: `${path}/${key}/${itemKey}` });
                    }
                }
            }
            if ((_a = enterResult.components) === null || _a === void 0 ? void 0 : _a.schema) {
                const entries = Object.entries(enterResult.components.schemas);
                for (const [schemaName, subSchema] of entries) {
                    enterResult.components.schemas[schemaName] = await visitJSONSchema(subSchema, { enter, leave }, { visitedSubschemaResultMap, path: `${path}/components/schemas/${schemaName}` });
                }
            }
            const leaveResult = await leave(enterResult, {
                visitedSubschemaResultMap,
                path,
            });
            visitedSubschemaResultMap.set(schema, leaveResult);
            return leaveResult;
        }
        return visitedSubschemaResultMap.get(schema);
    }
    const enterResult = await enter(schema, {
        visitedSubschemaResultMap,
        path,
    });
    return leave(enterResult, {
        visitedSubschemaResultMap,
        path,
    });
}
