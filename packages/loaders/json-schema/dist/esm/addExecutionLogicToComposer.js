import { GraphQLJSON, } from 'graphql-compose';
import { getOperationMetadata, isPubSubOperationConfig } from './utils.js';
import { getNamedType, GraphQLInt, GraphQLObjectType, GraphQLString } from 'graphql';
import { process } from '@graphql-mesh/cross-helpers';
import { GlobalOptionsDirective, HTTPOperationDirective, LinkDirective, LinkResolverDirective, PubSubOperationDirective, ResolveRootDirective, ResponseMetadataDirective, } from './directives.js';
const responseMetadataType = new GraphQLObjectType({
    name: 'ResponseMetadata',
    fields: {
        url: { type: GraphQLString },
        method: { type: GraphQLString },
        status: { type: GraphQLInt },
        statusText: { type: GraphQLString },
        headers: { type: GraphQLJSON },
        body: { type: GraphQLJSON },
    },
});
export async function addExecutionDirectivesToComposer(name, { schemaComposer, logger, operations, operationHeaders, endpoint, queryParams, queryStringOptions, }) {
    var _a, _b;
    schemaComposer.addDirective(GlobalOptionsDirective);
    schemaComposer.Query.setDirectiveByName('globalOptions', JSON.parse(JSON.stringify({
        sourceName: name,
        endpoint,
        operationHeaders,
        queryStringOptions,
        queryParams,
    })));
    logger.debug(`Attaching execution directives to the schema`);
    for (const operationConfig of operations) {
        const { httpMethod, rootTypeName, fieldName } = getOperationMetadata(operationConfig);
        const rootTypeComposer = schemaComposer[rootTypeName];
        const field = rootTypeComposer.getField(fieldName);
        if (isPubSubOperationConfig(operationConfig)) {
            field.description =
                operationConfig.description || `PubSub Topic: ${operationConfig.pubsubTopic}`;
            field.directives = field.directives || [];
            schemaComposer.addDirective(PubSubOperationDirective);
            field.directives.push({
                name: 'pubsubOperation',
                args: {
                    pubsubTopic: operationConfig.pubsubTopic,
                },
            });
        }
        else if (operationConfig.path) {
            if (process.env.DEBUG === '1' || process.env.DEBUG === 'fieldDetails') {
                field.description = `
>**Method**: \`${operationConfig.method}\`
>**Base URL**: \`${endpoint}\`
>**Path**: \`${operationConfig.path}\`
${operationConfig.description || ''}
`;
            }
            else {
                field.description = operationConfig.description;
            }
            field.directives = field.directives || [];
            schemaComposer.addDirective(HTTPOperationDirective);
            field.directives.push({
                name: 'httpOperation',
                args: JSON.parse(JSON.stringify({
                    path: operationConfig.path,
                    operationSpecificHeaders: operationConfig.headers,
                    httpMethod,
                    isBinary: 'binary' in operationConfig ? operationConfig.binary : undefined,
                    requestBaseBody: 'requestBaseBody' in operationConfig ? operationConfig.requestBaseBody : undefined,
                    queryParamArgMap: operationConfig.queryParamArgMap,
                    queryStringOptionsByParam: operationConfig.queryStringOptionsByParam,
                })),
            });
            const handleLinkMap = (linkMap, typeTC) => {
                for (const linkName in linkMap) {
                    typeTC.addFields({
                        [linkName]: () => {
                            const linkObj = linkMap[linkName];
                            field.directives = field.directives || [];
                            let linkResolverMapDirective = field.directives.find(d => d.name === 'linkResolver');
                            if (!linkResolverMapDirective) {
                                schemaComposer.addDirective(LinkResolverDirective);
                                linkResolverMapDirective = {
                                    name: 'linkResolver',
                                    args: {
                                        linkResolverMap: {},
                                    },
                                };
                                field.directives.push(linkResolverMapDirective);
                            }
                            const linkResolverFieldMap = linkResolverMapDirective.args.linkResolverMap;
                            let targetField;
                            let fieldTypeName;
                            try {
                                targetField = schemaComposer.Query.getField(linkObj.fieldName);
                                fieldTypeName = 'Query';
                            }
                            catch (_a) {
                                try {
                                    targetField = schemaComposer.Mutation.getField(linkObj.fieldName);
                                    fieldTypeName = 'Mutation';
                                }
                                catch (_b) { }
                            }
                            if (!targetField) {
                                logger.debug(`Field ${linkObj.fieldName} not found in ${name} for link ${linkName}`);
                            }
                            linkResolverFieldMap[linkName] = {
                                linkObjArgs: linkObj.args,
                                targetTypeName: fieldTypeName,
                                targetFieldName: linkObj.fieldName,
                            };
                            schemaComposer.addDirective(LinkDirective);
                            return {
                                ...targetField,
                                directives: [
                                    {
                                        name: 'link',
                                        args: {
                                            defaultRootType: rootTypeName,
                                            defaultField: operationConfig.field,
                                        },
                                    },
                                ],
                                args: linkObj.args ? {} : targetField.args,
                                description: linkObj.description || targetField.description,
                            };
                        },
                    });
                }
            };
            if ('links' in operationConfig) {
                const typeTC = schemaComposer.getOTC(field.type.getTypeName());
                handleLinkMap(operationConfig.links, typeTC);
            }
            if ('exposeResponseMetadata' in operationConfig && operationConfig.exposeResponseMetadata) {
                const typeTC = schemaComposer.getOTC(field.type.getTypeName());
                schemaComposer.addDirective(ResponseMetadataDirective);
                typeTC.addFields({
                    _response: {
                        type: responseMetadataType,
                        directives: [
                            {
                                name: 'responseMetadata',
                            },
                        ],
                    },
                });
            }
            if ('responseByStatusCode' in operationConfig) {
                const unionOrSingleTC = schemaComposer.getAnyTC(getNamedType(field.type.getType()));
                const types = 'getTypes' in unionOrSingleTC ? unionOrSingleTC.getTypes() : [unionOrSingleTC];
                const statusCodeOneOfIndexMap = {};
                const directives = unionOrSingleTC.getDirectives();
                for (const directive of directives) {
                    if (directive.name === 'statusCodeOneOfIndex') {
                        statusCodeOneOfIndexMap[(_a = directive.args) === null || _a === void 0 ? void 0 : _a.statusCode] = (_b = directive.args) === null || _b === void 0 ? void 0 : _b.oneOfIndex;
                    }
                }
                for (const statusCode in operationConfig.responseByStatusCode) {
                    const responseConfig = operationConfig.responseByStatusCode[statusCode];
                    if (responseConfig.links || responseConfig.exposeResponseMetadata) {
                        const typeTCThunked = types[statusCodeOneOfIndexMap[statusCode] || 0];
                        const originalName = typeTCThunked.getTypeName();
                        let typeTC = schemaComposer.getAnyTC(originalName);
                        if (!('addFieldArgs' in typeTC)) {
                            schemaComposer.addDirective(ResolveRootDirective);
                            typeTC = schemaComposer.createObjectTC({
                                name: `${operationConfig.field}_${statusCode}_response`,
                                fields: {
                                    [originalName]: {
                                        type: typeTC,
                                        directives: [
                                            {
                                                name: 'resolveRoot',
                                            },
                                        ],
                                    },
                                },
                            });
                            // If it is a scalar or enum type, it cannot be a union type, so we can set it directly
                            types[0] = typeTC;
                            field.type = typeTC;
                        }
                        if (responseConfig.exposeResponseMetadata) {
                            schemaComposer.addDirective(ResponseMetadataDirective);
                            typeTC.addFields({
                                _response: {
                                    type: responseMetadataType,
                                    directives: [
                                        {
                                            name: 'responseMetadata',
                                        },
                                    ],
                                },
                            });
                        }
                        if (responseConfig.links) {
                            handleLinkMap(responseConfig.links, typeTC);
                        }
                    }
                }
            }
        }
    }
    logger.debug(`Building the executable schema.`);
    return schemaComposer;
}
