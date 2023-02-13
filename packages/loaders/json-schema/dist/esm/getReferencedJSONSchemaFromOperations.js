import { getInterpolationKeys } from '@graphql-mesh/string-interpolation';
import { defaultImportFn, DefaultLogger, readFileOrUrl } from '@graphql-mesh/utils';
import { AnySchema } from 'json-machete';
import toJsonSchema from 'to-json-schema';
import { getOperationMetadata } from './utils.js';
async function handleOperationResponseConfig(operationResponseConfig, { schemaHeaders, cwd, fetchFn, logger = new DefaultLogger('handleOperationResponseConfig'), }) {
    if (operationResponseConfig.responseSchema) {
        const schema = typeof operationResponseConfig.responseSchema === 'string'
            ? {
                $ref: operationResponseConfig.responseSchema,
                title: operationResponseConfig.responseTypeName,
            }
            : operationResponseConfig.responseSchema;
        if (operationResponseConfig.responseSample) {
            schema.examples = schema.examples || [operationResponseConfig.responseSample];
        }
        return schema;
    }
    else if (operationResponseConfig.responseSample) {
        const sample = typeof operationResponseConfig.responseSample === 'object'
            ? operationResponseConfig.responseSample
            : await readFileOrUrl(operationResponseConfig.responseSample, {
                cwd,
                fetch: fetchFn,
                logger,
                importFn: defaultImportFn,
                headers: schemaHeaders,
            }).catch((e) => {
                throw new Error(`responseSample - ${e.message}`);
            });
        const generatedSchema = toJsonSchema(sample, {
            required: false,
            objects: {
                additionalProperties: false,
            },
            strings: {
                detectFormat: true,
            },
            arrays: {
                mode: 'first',
            },
        });
        generatedSchema.title = operationResponseConfig.responseTypeName;
        generatedSchema.examples = [sample];
        return generatedSchema;
    }
    else {
        return AnySchema;
    }
}
export async function getReferencedJSONSchemaFromOperations({ operations, cwd, schemaHeaders, ignoreErrorResponses, logger = new DefaultLogger('getReferencedJSONSchemaFromOperations'), fetchFn, endpoint, operationHeaders, queryParams, }) {
    const finalJsonSchema = {
        type: 'object',
        title: '_schema',
        properties: {},
        required: ['query'],
    };
    for (const operationConfig of operations) {
        const { operationType, rootTypeName, fieldName } = getOperationMetadata(operationConfig);
        const rootTypeDefinition = (finalJsonSchema.properties[operationType] = finalJsonSchema
            .properties[operationType] || {
            type: 'object',
            title: rootTypeName,
            properties: {},
            readOnly: true,
        });
        rootTypeDefinition.properties = rootTypeDefinition.properties || {};
        const interpolationStrings = [
            ...Object.values(operationHeaders || {}),
            ...Object.values(queryParams || {}).map(val => val.toString()),
            endpoint,
        ];
        if ('pubsubTopic' in operationConfig) {
            interpolationStrings.push(operationConfig.pubsubTopic);
        }
        if ('headers' in operationConfig) {
            interpolationStrings.push(...Object.values(operationConfig.headers || {}));
        }
        if ('path' in operationConfig) {
            interpolationStrings.push(operationConfig.path);
        }
        if ('responseByStatusCode' in operationConfig) {
            rootTypeDefinition.properties[fieldName] = rootTypeDefinition.properties[fieldName] || {};
            const statusCodeOneOfIndexMap = {};
            const responseSchemas = [];
            for (const statusCode in operationConfig.responseByStatusCode) {
                if (ignoreErrorResponses && !statusCode.startsWith('2')) {
                    continue;
                }
                const responseOperationConfig = operationConfig.responseByStatusCode[statusCode];
                const responseOperationSchema = await handleOperationResponseConfig(responseOperationConfig, {
                    cwd,
                    schemaHeaders,
                    fetchFn,
                    logger,
                });
                statusCodeOneOfIndexMap[statusCode] = responseSchemas.length;
                responseOperationSchema.title =
                    responseOperationSchema.title || `${fieldName}_${statusCode}_response`;
                responseSchemas.push(responseOperationSchema);
            }
            if (responseSchemas.length === 1) {
                rootTypeDefinition.properties[fieldName] = responseSchemas[0];
            }
            else if (responseSchemas.length === 0) {
                rootTypeDefinition.properties[fieldName] = AnySchema;
            }
            else {
                rootTypeDefinition.properties[fieldName] = {
                    $comment: `statusCodeOneOfIndexMap:${JSON.stringify(statusCodeOneOfIndexMap)}`,
                    title: fieldName + '_response',
                    oneOf: responseSchemas,
                };
            }
        }
        else {
            rootTypeDefinition.properties[fieldName] = await handleOperationResponseConfig(operationConfig, {
                cwd,
                schemaHeaders,
                fetchFn,
                logger,
            });
        }
        const rootTypeInputPropertyName = operationType + 'Input';
        const rootInputTypeName = rootTypeName + 'Input';
        const rootTypeInputTypeDefinition = (finalJsonSchema.properties[rootTypeInputPropertyName] =
            finalJsonSchema.properties[rootTypeInputPropertyName] || {
                type: 'object',
                title: rootInputTypeName,
                properties: {},
                writeOnly: true,
            });
        const interpolationKeys = getInterpolationKeys(...interpolationStrings);
        if ('queryParamArgMap' in operationConfig) {
            interpolationKeys.push(...Object.values(operationConfig.queryParamArgMap).map(key => `args.${key}`));
        }
        for (const interpolationKey of interpolationKeys) {
            const [initialObjectName, varName] = interpolationKey.split('.');
            if (initialObjectName === 'args') {
                rootTypeInputTypeDefinition.properties[fieldName] = rootTypeInputTypeDefinition.properties[fieldName] || {
                    title: `${rootTypeInputPropertyName}_${fieldName}`,
                    type: 'object',
                    properties: {},
                };
                if (operationConfig.argTypeMap != null && varName in operationConfig.argTypeMap) {
                    const argTypeDef = operationConfig.argTypeMap[varName];
                    if (typeof argTypeDef === 'object') {
                        rootTypeInputTypeDefinition.properties[fieldName].properties[varName] = argTypeDef;
                    }
                    else {
                        rootTypeInputTypeDefinition.properties[fieldName].properties[varName] = {
                            $ref: argTypeDef,
                        };
                    }
                }
                else if (!rootTypeInputTypeDefinition.properties[fieldName].properties[varName]) {
                    rootTypeInputTypeDefinition.properties[fieldName].properties[varName] = {
                        type: 'string',
                    };
                }
            }
        }
        if ('binary' in operationConfig) {
            const generatedSchema = {
                type: 'string',
                format: 'binary',
            };
            rootTypeInputTypeDefinition.properties[fieldName] = rootTypeInputTypeDefinition.properties[fieldName] || {
                title: `${rootTypeInputPropertyName}_${fieldName}`,
                type: 'object',
                properties: {},
            };
            rootTypeInputTypeDefinition.properties[fieldName].properties.input = generatedSchema;
        }
        else if ('requestSchema' in operationConfig && operationConfig.requestSchema) {
            rootTypeInputTypeDefinition.properties[fieldName] = rootTypeInputTypeDefinition.properties[fieldName] || {
                title: `${rootTypeInputPropertyName}_${fieldName}`,
                type: 'object',
                properties: {},
            };
            rootTypeInputTypeDefinition.properties[fieldName].properties.input =
                typeof operationConfig.requestSchema === 'string'
                    ? {
                        $ref: operationConfig.requestSchema,
                        title: operationConfig.requestTypeName,
                    }
                    : operationConfig.requestSchema;
            if (operationConfig.requestSample) {
                rootTypeInputTypeDefinition.properties[fieldName].properties.input.examples =
                    rootTypeInputTypeDefinition.properties[fieldName].properties.input.examples || [
                        operationConfig.requestSample,
                    ];
            }
        }
        else if ('requestSample' in operationConfig) {
            const sample = typeof operationConfig.requestSample === 'object'
                ? operationConfig.requestSample
                : await readFileOrUrl(operationConfig.requestSample, {
                    cwd,
                    headers: schemaHeaders,
                    fetch: fetchFn,
                    logger,
                    importFn: defaultImportFn,
                }).catch((e) => {
                    throw new Error(`${operationConfig.field}.requestSample: ${operationConfig.requestSample}; ${e.message}`);
                });
            const generatedSchema = toJsonSchema(sample, {
                required: false,
                objects: {
                    additionalProperties: false,
                },
                strings: {
                    detectFormat: true,
                },
                arrays: {
                    mode: 'first',
                },
            });
            generatedSchema.title = operationConfig.requestTypeName;
            generatedSchema.examples = [sample];
            rootTypeInputTypeDefinition.properties[fieldName] = rootTypeInputTypeDefinition.properties[fieldName] || {
                title: `${rootTypeInputPropertyName}_${fieldName}`,
                type: 'object',
                properties: {},
            };
            rootTypeInputTypeDefinition.properties[fieldName].properties.input = generatedSchema;
        }
    }
    return finalJsonSchema;
}
