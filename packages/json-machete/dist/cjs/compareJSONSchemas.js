"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.compareJSONSchemas = void 0;
const visitJSONSchema_js_1 = require("./visitJSONSchema.js");
const utils_1 = require("@graphql-tools/utils");
const dereferenceObject_js_1 = require("./dereferenceObject.js");
async function compareJSONSchemas(oldSchema, newSchema) {
    const breakingChanges = [];
    await (0, visitJSONSchema_js_1.visitJSONSchema)(oldSchema, {
        enter: (oldSubSchema, { path }) => {
            var _a, _b, _c, _d;
            if (typeof newSchema === 'object') {
                const newSubSchema = (0, dereferenceObject_js_1.resolvePath)(path, newSchema);
                if (typeof oldSubSchema === 'boolean') {
                    if (newSubSchema !== oldSubSchema) {
                        breakingChanges.push(`${path} is changed from ${oldSubSchema} to ${newSubSchema}`);
                    }
                }
                else {
                    if (oldSubSchema.$ref) {
                        if ((newSubSchema === null || newSubSchema === void 0 ? void 0 : newSubSchema.$ref) !== oldSubSchema.$ref) {
                            breakingChanges.push(`${path}/$ref is changed from ${oldSubSchema.$ref} to ${newSubSchema === null || newSubSchema === void 0 ? void 0 : newSubSchema.$ref}`);
                        }
                    }
                    if (oldSubSchema.const) {
                        if ((newSubSchema === null || newSubSchema === void 0 ? void 0 : newSubSchema.const) !== oldSubSchema.const) {
                            breakingChanges.push(`${path}/const is changed from ${oldSubSchema.const} to ${newSubSchema === null || newSubSchema === void 0 ? void 0 : newSubSchema.const}`);
                        }
                    }
                    if (oldSubSchema.enum) {
                        for (const enumValue of oldSubSchema.enum) {
                            if (!((_a = newSubSchema === null || newSubSchema === void 0 ? void 0 : newSubSchema.enum) === null || _a === void 0 ? void 0 : _a.includes(enumValue))) {
                                breakingChanges.push(`${path}/enum doesn't have ${enumValue} anymore`);
                            }
                        }
                    }
                    if (oldSubSchema.format) {
                        if ((newSubSchema === null || newSubSchema === void 0 ? void 0 : newSubSchema.format) !== oldSubSchema.format) {
                            breakingChanges.push(`${path}/format is changed from ${oldSubSchema.format} to ${newSubSchema === null || newSubSchema === void 0 ? void 0 : newSubSchema.format}`);
                        }
                    }
                    if (oldSubSchema.maxLength) {
                        if (oldSubSchema.maxLength > (newSubSchema === null || newSubSchema === void 0 ? void 0 : newSubSchema.maxLength)) {
                            breakingChanges.push(`${path}/maxLength is changed from ${oldSubSchema.maxLength} to ${newSubSchema === null || newSubSchema === void 0 ? void 0 : newSubSchema.maxLength}`);
                        }
                    }
                    if (oldSubSchema.minLength) {
                        if (oldSubSchema.minLength < (newSubSchema === null || newSubSchema === void 0 ? void 0 : newSubSchema.minLength)) {
                            breakingChanges.push(`${path}/minLength is changed from ${oldSubSchema.minLength} to ${newSubSchema === null || newSubSchema === void 0 ? void 0 : newSubSchema.minLength}`);
                        }
                    }
                    if (oldSubSchema.pattern) {
                        if (((_b = newSubSchema === null || newSubSchema === void 0 ? void 0 : newSubSchema.pattern) === null || _b === void 0 ? void 0 : _b.toString()) !== oldSubSchema.pattern.toString()) {
                            breakingChanges.push(`${path}/pattern is changed from ${oldSubSchema.pattern} to ${newSubSchema === null || newSubSchema === void 0 ? void 0 : newSubSchema.pattern}`);
                        }
                    }
                    if (oldSubSchema.properties) {
                        for (const propertyName in oldSubSchema.properties) {
                            if (((_c = newSubSchema === null || newSubSchema === void 0 ? void 0 : newSubSchema.properties) === null || _c === void 0 ? void 0 : _c[propertyName]) == null) {
                                breakingChanges.push(`${path}/properties doesn't have ${propertyName}`);
                            }
                        }
                    }
                    if (newSubSchema === null || newSubSchema === void 0 ? void 0 : newSubSchema.required) {
                        for (const propertyName of newSubSchema.required) {
                            if (!((_d = oldSubSchema.required) === null || _d === void 0 ? void 0 : _d.includes(propertyName))) {
                                breakingChanges.push(`${path}/required has ${propertyName} an extra`);
                            }
                        }
                    }
                    if (oldSubSchema.title) {
                        if ((newSubSchema === null || newSubSchema === void 0 ? void 0 : newSubSchema.title) !== oldSubSchema.title) {
                            breakingChanges.push(`${path}/title is changed from ${oldSubSchema.title} to ${newSubSchema === null || newSubSchema === void 0 ? void 0 : newSubSchema.title}`);
                        }
                    }
                    if (oldSubSchema.type) {
                        if (typeof (newSubSchema === null || newSubSchema === void 0 ? void 0 : newSubSchema.type) === 'string'
                            ? (newSubSchema === null || newSubSchema === void 0 ? void 0 : newSubSchema.type) !== oldSubSchema.type
                            : Array.isArray(newSubSchema === null || newSubSchema === void 0 ? void 0 : newSubSchema.type)
                                ? Array.isArray(oldSubSchema.type)
                                    ? oldSubSchema.type.some(typeName => !(newSubSchema === null || newSubSchema === void 0 ? void 0 : newSubSchema.type.includes(typeName)))
                                    : !(newSubSchema === null || newSubSchema === void 0 ? void 0 : newSubSchema.type.includes(oldSubSchema.type))
                                : true) {
                            breakingChanges.push(`${path}/type is changed from ${oldSubSchema.type} to ${newSubSchema === null || newSubSchema === void 0 ? void 0 : newSubSchema.type}`);
                        }
                    }
                }
            }
            return oldSubSchema;
        },
    }, {
        visitedSubschemaResultMap: new WeakMap(),
        path: '',
    });
    if (breakingChanges.length > 0) {
        throw new utils_1.AggregateError(breakingChanges.map(breakingChange => new Error(breakingChange)), `Breaking changes are found:\n${breakingChanges.join('\n')}`);
    }
}
exports.compareJSONSchemas = compareJSONSchemas;
