"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const utils_1 = require("@graphql-mesh/utils");
const wrap_1 = require("@graphql-tools/wrap");
class MeshHoistField {
    constructor({ config }) {
        this.noWrap = false;
        this.transforms = config.map(({ typeName, pathConfig, newFieldName, alias, filterArgsInPath = false }) => {
            const processedPathConfig = pathConfig.map(config => this.getPathConfigItem(config, filterArgsInPath));
            return new wrap_1.HoistField(typeName, processedPathConfig, newFieldName, alias);
        });
    }
    getPathConfigItem(pathConfigItemFromConfig, filterArgsInPath) {
        if (typeof pathConfigItemFromConfig === 'string') {
            const pathConfigItem = {
                fieldName: pathConfigItemFromConfig,
                argFilter: () => filterArgsValue(filterArgsInPath),
            };
            return pathConfigItem;
        }
        if (!pathConfigItemFromConfig.fieldName) {
            throw new Error(`Field name is required in pathConfig item`);
        }
        if (!pathConfigItemFromConfig.filterArgs) {
            throw new Error(`FilterArgs is required in pathConfig item`);
        }
        const filterArgsDict = (pathConfigItemFromConfig.filterArgs || []).reduce((prev, argName) => {
            prev[argName] = true;
            return prev;
        }, {});
        const pathConfigItem = {
            fieldName: pathConfigItemFromConfig.fieldName,
            argFilter: arg => {
                return filterArgsValue(filterArgsDict[arg.name]);
            },
        };
        return pathConfigItem;
    }
    transformSchema(originalWrappingSchema, subschemaConfig, transformedSchema) {
        return (0, utils_1.applySchemaTransforms)(originalWrappingSchema, subschemaConfig, transformedSchema, this.transforms);
    }
    transformRequest(originalRequest, delegationContext, transformationContext) {
        return (0, utils_1.applyRequestTransforms)(originalRequest, delegationContext, transformationContext, this.transforms);
    }
    transformResult(originalResult, delegationContext, transformationContext) {
        return (0, utils_1.applyResultTransforms)(originalResult, delegationContext, transformationContext, this.transforms);
    }
}
exports.default = MeshHoistField;
// The argFilters in HoistField seem to work more like argIncludes, hence the value needs to be negated
// https://github.com/ardatan/graphql-tools/blob/af266974bf02967e0675187e9bea0391fd7fe0cf/packages/wrap/src/transforms/HoistField.ts#L44
function filterArgsValue(filter) {
    return !filter;
}
