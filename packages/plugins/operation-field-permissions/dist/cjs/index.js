"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const cross_helpers_1 = require("@graphql-mesh/cross-helpers");
const operation_field_permissions_1 = require("@envelop/operation-field-permissions");
function useMeshOperationFieldPermissions(options) {
    return {
        onPluginInit({ addPlugin }) {
            addPlugin((0, operation_field_permissions_1.useOperationFieldPermissions)({
                getPermissions(context) {
                    const allowedFields = new Set();
                    for (const { if: condition, allow } of options.permissions) {
                        const ifFn = new Function('context', 'env', 'return ' + condition);
                        if (ifFn(context, cross_helpers_1.process.env)) {
                            for (const allowedField of allow) {
                                allowedFields.add(allowedField);
                            }
                        }
                    }
                    return allowedFields;
                },
            }));
        },
    };
}
exports.default = useMeshOperationFieldPermissions;
