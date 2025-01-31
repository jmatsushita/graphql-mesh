import { buildOperationNodeForField, getRootTypeMap, parseGraphQLSDL, } from '@graphql-tools/utils';
import { print } from 'graphql';
export function generateOperations(schema, options) {
    var _a;
    const sources = [];
    const rootTypeMap = getRootTypeMap(schema);
    for (const [operationType, rootType] of rootTypeMap) {
        const fieldMap = rootType.getFields();
        for (const fieldName in fieldMap) {
            const operationNode = buildOperationNodeForField({
                schema,
                kind: operationType,
                field: fieldName,
                depthLimit: options.selectionSetDepth,
            });
            const defaultName = `operation_${sources.length}`;
            const virtualFileName = ((_a = operationNode.name) === null || _a === void 0 ? void 0 : _a.value) || defaultName;
            const rawSDL = print(operationNode);
            const source = parseGraphQLSDL(`${virtualFileName}.graphql`, rawSDL);
            sources.push(source);
        }
    }
    return sources;
}
