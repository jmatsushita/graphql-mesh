"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const utils_1 = require("@graphql-tools/utils");
const minimatch_1 = tslib_1.__importDefault(require("minimatch"));
class BareFilter {
    constructor({ config: { filters } }) {
        this.noWrap = true;
        this.typeGlobs = [];
        this.fieldsMap = new Map();
        this.argsMap = new Map();
        for (const filter of filters) {
            const [typeName, fieldNameOrGlob, argsGlob] = filter.split('.');
            // TODO: deprecate this in next major release as dscussed in #1605
            if (!fieldNameOrGlob) {
                this.typeGlobs.push(typeName);
                continue;
            }
            const rawGlob = argsGlob || fieldNameOrGlob;
            const fixedGlob = rawGlob.includes('{') && !rawGlob.includes(',')
                ? rawGlob.replace('{', '').replace('}', '')
                : rawGlob;
            const polishedGlob = fixedGlob.split(', ').join(',').trim();
            if (typeName === 'Type') {
                this.typeGlobs.push(polishedGlob);
                continue;
            }
            const mapName = argsGlob ? 'argsMap' : 'fieldsMap';
            const mapKey = argsGlob ? `${typeName}.${fieldNameOrGlob}` : typeName;
            const currentRules = this[mapName].get(mapKey) || [];
            this[mapName].set(mapKey, [...currentRules, polishedGlob]);
        }
    }
    matchInArray(rulesArray, value) {
        for (const rule of rulesArray) {
            const ruleMatcher = new minimatch_1.default.Minimatch(rule);
            if (!ruleMatcher.match(value))
                return null;
        }
        return undefined;
    }
    transformSchema(schema) {
        const transformedSchema = (0, utils_1.mapSchema)(schema, {
            ...(this.typeGlobs.length && {
                [utils_1.MapperKind.TYPE]: type => this.matchInArray(this.typeGlobs, type.toString()),
            }),
            ...((this.fieldsMap.size || this.argsMap.size) && {
                [utils_1.MapperKind.COMPOSITE_FIELD]: (fieldConfig, fieldName, typeName) => {
                    const fieldRules = this.fieldsMap.get(typeName);
                    const wildcardArgRules = this.argsMap.get(`${typeName}.*`) || [];
                    const fieldArgRules = this.argsMap.get(`${typeName}.${fieldName}`) || [];
                    const argRules = wildcardArgRules.concat(fieldArgRules);
                    const hasFieldRules = Boolean(fieldRules && fieldRules.length);
                    const hasArgRules = Boolean(argRules && argRules.length);
                    if (hasFieldRules && this.matchInArray(fieldRules, fieldName) === null)
                        return null;
                    if (!hasArgRules)
                        return undefined;
                    const fieldArgs = Object.entries(fieldConfig.args).reduce((args, [argName, argConfig]) => this.matchInArray(argRules, argName) === null
                        ? args
                        : { ...args, [argName]: argConfig }, {});
                    return { ...fieldConfig, args: fieldArgs };
                },
            }),
            ...(this.fieldsMap.size && {
                [utils_1.MapperKind.INPUT_OBJECT_FIELD]: (_, fieldName, typeName) => {
                    const fieldRules = this.fieldsMap.get(typeName);
                    const hasFieldRules = Boolean(fieldRules && fieldRules.length);
                    if (hasFieldRules && this.matchInArray(fieldRules, fieldName) === null)
                        return null;
                    return undefined;
                },
            }),
        });
        return transformedSchema;
    }
}
exports.default = BareFilter;
