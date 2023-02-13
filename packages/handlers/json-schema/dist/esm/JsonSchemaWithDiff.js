import { PredefinedProxyOptions } from '@graphql-mesh/store';
import { compareJSONSchemas } from 'json-machete';
export const JsonSchemaWithDiff = {
    ...PredefinedProxyOptions.JsonWithoutValidation,
    validate: compareJSONSchemas,
};
