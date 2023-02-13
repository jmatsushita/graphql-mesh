"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.referenceJSONSchema = void 0;
const visitJSONSchema_js_1 = require("./visitJSONSchema.js");
const utils_1 = require("@graphql-mesh/utils");
async function referenceJSONSchema(schema, logger = new utils_1.DefaultLogger('referenceJSONSchema')) {
    const initialDefinitions = {};
    const { $ref: initialRef } = await (0, visitJSONSchema_js_1.visitJSONSchema)(schema, {
        enter: (subSchema, { path }) => {
            if (typeof subSchema === 'object') {
                // Remove $id refs
                delete subSchema.$id;
                if (subSchema.$ref) {
                    return subSchema;
                }
                else if (subSchema.title) {
                    logger.debug(`Referencing ${path}`);
                    if (subSchema.title in initialDefinitions) {
                        let cnt = 2;
                        while (`${subSchema.title}${cnt}` in initialDefinitions) {
                            cnt++;
                        }
                        const definitionProp = `${subSchema.title}${cnt}`.split(' ').join('_SPACE_');
                        initialDefinitions[definitionProp] = subSchema;
                        return {
                            $ref: `#/definitions/${definitionProp}`,
                            ...subSchema,
                        };
                    }
                    else {
                        const definitionProp = subSchema.title.split(' ').join('_SPACE_');
                        initialDefinitions[definitionProp] = subSchema;
                        return {
                            $ref: `#/definitions/${definitionProp}`,
                            ...subSchema,
                        };
                    }
                }
                else if (subSchema.type === 'object') {
                    logger.debug(`${path} cannot be referenced because it has no title`);
                }
            }
            return subSchema;
        },
    });
    const { definitions: finalDefinitions } = await (0, visitJSONSchema_js_1.visitJSONSchema)({
        definitions: initialDefinitions,
    }, {
        enter: subSchema => {
            if (typeof subSchema === 'object') {
                if (subSchema.$ref) {
                    return {
                        $ref: subSchema.$ref,
                    };
                }
            }
            return subSchema;
        },
    });
    return {
        $ref: initialRef,
        definitions: finalDefinitions,
    };
}
exports.referenceJSONSchema = referenceJSONSchema;
