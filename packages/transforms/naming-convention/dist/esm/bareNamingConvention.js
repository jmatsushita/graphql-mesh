import { defaultFieldResolver, isInputObjectType, isEnumType, } from 'graphql';
import { MapperKind, mapSchema, renameType } from '@graphql-tools/utils';
import { NAMING_CONVENTIONS, IGNORED_ROOT_FIELD_NAMES, IGNORED_TYPE_NAMES } from './shared.js';
const isObject = (input) => typeof input === 'object' && input !== null && !Array.isArray(input) && true;
const getUnderlyingType = (type) => type.ofType
    ? getUnderlyingType(type.ofType)
    : type;
// Resolver composer mapping renamed field and arguments
const defaultResolverComposer = (resolveFn = defaultFieldResolver, originalFieldName, argsMap, resultMap) => (root, args, context, info) => {
    const originalResult = resolveFn(root, 
    // map renamed arguments to their original value
    argsMap
        ? Object.keys(args).reduce((acc, key) => {
            if (!argsMap[key]) {
                return { ...acc, [key]: args[key] };
            }
            const argKey = argsMap[key];
            const mappedArgKeyIsObject = isObject(argKey);
            const newArgName = Object.keys(argKey)[0];
            return {
                ...acc,
                [mappedArgKeyIsObject ? newArgName : argKey]: mappedArgKeyIsObject
                    ? Object.entries(args[key]).reduce((acc, [key, value]) => {
                        const oldInputFieldName = argKey[newArgName][key];
                        return { ...acc, [oldInputFieldName || key]: value };
                    }, {})
                    : args[key],
            };
        }, {})
        : args, context, 
    // map renamed field name to its original value
    originalFieldName ? { ...info, fieldName: originalFieldName } : info);
    // map result values from original value to new renamed value
    return resultMap
        ? Array.isArray(originalResult)
            ? originalResult.map(result => resultMap[result] || originalResult)
            : resultMap[originalResult] || originalResult
        : originalResult;
};
export default class NamingConventionTransform {
    constructor(options) {
        this.noWrap = true;
        this.config = { ...options.config };
    }
    transformSchema(schema) {
        return mapSchema(schema, {
            ...(this.config.typeNames && {
                [MapperKind.TYPE]: type => {
                    const oldName = type.name;
                    const namingConventionFn = NAMING_CONVENTIONS[this.config.typeNames];
                    const newName = IGNORED_TYPE_NAMES.includes(oldName)
                        ? oldName
                        : namingConventionFn(oldName);
                    if (newName !== undefined && newName !== oldName) {
                        return renameType(type, newName);
                    }
                    return undefined;
                },
                [MapperKind.ABSTRACT_TYPE]: type => {
                    const currentName = type.name;
                    const existingResolver = type.resolveType;
                    const namingConventionFn = NAMING_CONVENTIONS[this.config.typeNames];
                    const newName = IGNORED_TYPE_NAMES.includes(currentName)
                        ? currentName
                        : namingConventionFn(currentName);
                    type.resolveType = async (data, context, info, abstractType) => {
                        const originalResolvedTypename = await existingResolver(data, context, info, abstractType);
                        return IGNORED_TYPE_NAMES.includes(originalResolvedTypename)
                            ? originalResolvedTypename
                            : namingConventionFn(originalResolvedTypename);
                    };
                    if (newName !== undefined && newName !== currentName) {
                        return renameType(type, newName);
                    }
                    return undefined;
                },
            }),
            ...(this.config.enumValues && {
                [MapperKind.ENUM_VALUE]: (valueConfig, _typeName, _schema, externalValue) => {
                    const namingConventionFn = NAMING_CONVENTIONS[this.config.enumValues];
                    const newEnumValue = namingConventionFn(externalValue);
                    if (newEnumValue === externalValue) {
                        return undefined;
                    }
                    return [
                        newEnumValue,
                        {
                            ...valueConfig,
                            value: newEnumValue,
                            astNode: {
                                ...valueConfig.astNode,
                                name: {
                                    ...valueConfig.astNode.name,
                                    value: newEnumValue,
                                },
                            },
                        },
                    ];
                },
            }),
            ...((this.config.fieldNames || this.config.fieldArgumentNames) && {
                [MapperKind.COMPOSITE_FIELD]: (fieldConfig, fieldName) => {
                    const enumNamingConventionFn = NAMING_CONVENTIONS[this.config.enumValues];
                    const fieldNamingConventionFn = this.config.fieldNames && NAMING_CONVENTIONS[this.config.fieldNames];
                    const argNamingConventionFn = this.config.fieldArgumentNames && NAMING_CONVENTIONS[this.config.fieldArgumentNames];
                    const argsMap = fieldConfig.args && {};
                    const newFieldName = this.config.fieldNames &&
                        !IGNORED_ROOT_FIELD_NAMES.includes(fieldName) &&
                        fieldNamingConventionFn(fieldName);
                    const fieldActualType = getUnderlyingType(fieldConfig.type);
                    const resultMap = this.config.enumValues &&
                        isEnumType(fieldActualType) &&
                        Object.keys(fieldActualType.toConfig().values).reduce((map, value) => {
                            if (Number.isFinite(value)) {
                                return map;
                            }
                            const newValue = enumNamingConventionFn(value);
                            return newValue === value
                                ? map
                                : {
                                    ...map,
                                    [value]: newValue,
                                };
                        }, {});
                    if (fieldConfig.args) {
                        fieldConfig.args = Object.entries(fieldConfig.args).reduce((args, [argName, argConfig]) => {
                            const newArgName = this.config.fieldArgumentNames && argNamingConventionFn(argName);
                            const useArgName = newArgName || argName;
                            const argIsInputObjectType = isInputObjectType(argConfig.type);
                            if (argName !== useArgName || argIsInputObjectType) {
                                // take advantage of the loop to map arg name from Old to New
                                argsMap[useArgName] = !argIsInputObjectType
                                    ? argName
                                    : {
                                        [argName]: Object.keys(argConfig.type.toConfig().fields).reduce((inputFields, inputFieldName) => {
                                            if (Number.isFinite(inputFieldName))
                                                return inputFields;
                                            const newInputFieldName = fieldNamingConventionFn(inputFieldName);
                                            return newInputFieldName === inputFieldName
                                                ? inputFields
                                                : {
                                                    ...inputFields,
                                                    [fieldNamingConventionFn(inputFieldName)]: inputFieldName,
                                                };
                                        }, {}),
                                    };
                            }
                            return {
                                ...args,
                                [useArgName]: argConfig,
                            };
                        }, {});
                    }
                    // Wrap resolve fn to handle mapping renamed field and argument names as well as results (for enums)
                    fieldConfig.resolve = defaultResolverComposer(fieldConfig.resolve, fieldName, argsMap, resultMap);
                    return [newFieldName || fieldName, fieldConfig];
                },
            }),
            ...(this.config.fieldNames && {
                [MapperKind.INPUT_OBJECT_FIELD]: (inputFieldConfig, fieldName) => {
                    const namingConventionFn = this.config.fieldNames && NAMING_CONVENTIONS[this.config.fieldNames];
                    const newName = namingConventionFn(fieldName);
                    if (newName === fieldName) {
                        return undefined;
                    }
                    return [newName, inputFieldConfig];
                },
            }),
        });
    }
}