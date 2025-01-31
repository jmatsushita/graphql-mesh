import { Kind, visit, } from 'graphql';
function parseObject(ast) {
    const value = Object.create(null);
    ast.fields.forEach(field => {
        // eslint-disable-next-line no-use-before-define
        value[field.name.value] = parseLiteral(field.value);
    });
    return value;
}
function parseLiteral(ast) {
    switch (ast.kind) {
        case Kind.STRING:
        case Kind.BOOLEAN:
            return ast.value;
        case Kind.INT:
        case Kind.FLOAT:
            return parseFloat(ast.value);
        case Kind.OBJECT:
            return parseObject(ast);
        case Kind.LIST:
            return ast.values.map(n => parseLiteral(n));
        case Kind.NULL:
            return null;
    }
}
export function getAdditionalResolversFromTypeDefs(additionalTypeDefs) {
    const additionalResolversFromTypeDefs = [];
    function handleFieldNode(targetTypeName, fieldNode) {
        var _a;
        if ((_a = fieldNode.directives) === null || _a === void 0 ? void 0 : _a.length) {
            const resolveToDef = fieldNode.directives.find(d => d.name.value === 'resolveTo');
            if (resolveToDef != null) {
                const resolveToArgumentMap = {};
                for (const resolveToArg of resolveToDef.arguments) {
                    const resolveToArgName = resolveToArg.name.value;
                    resolveToArgumentMap[resolveToArgName] = parseLiteral(resolveToArg.value);
                }
                additionalResolversFromTypeDefs.push({
                    targetTypeName,
                    targetFieldName: fieldNode.name.value,
                    ...resolveToArgumentMap,
                });
            }
        }
    }
    additionalTypeDefs === null || additionalTypeDefs === void 0 ? void 0 : additionalTypeDefs.forEach(typeDefs => {
        visit(typeDefs, {
            ObjectTypeDefinition(objectNode) {
                var _a;
                (_a = objectNode.fields) === null || _a === void 0 ? void 0 : _a.forEach(fieldNode => handleFieldNode(objectNode.name.value, fieldNode));
            },
            ObjectTypeExtension(objectNode) {
                var _a;
                (_a = objectNode.fields) === null || _a === void 0 ? void 0 : _a.forEach(fieldNode => handleFieldNode(objectNode.name.value, fieldNode));
            },
            InterfaceTypeDefinition(interfaceNode) {
                var _a;
                (_a = interfaceNode.fields) === null || _a === void 0 ? void 0 : _a.forEach(fieldNode => handleFieldNode(interfaceNode.name.value, fieldNode));
            },
            InterfaceTypeExtension(interfaceNode) {
                var _a;
                (_a = interfaceNode.fields) === null || _a === void 0 ? void 0 : _a.forEach(fieldNode => handleFieldNode(interfaceNode.name.value, fieldNode));
            },
        });
    });
    return additionalResolversFromTypeDefs;
}
