"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const graphql_compose_1 = require("graphql-compose");
const mysql_1 = require("mysql");
const mysql_utilities_1 = require("mysql-utilities");
const graphql_fields_1 = tslib_1.__importDefault(require("graphql-fields"));
const graphql_scalars_1 = require("graphql-scalars");
const graphql_1 = require("graphql");
const utils_1 = require("@graphql-mesh/utils");
const string_interpolation_1 = require("@graphql-mesh/string-interpolation");
const store_1 = require("@graphql-mesh/store");
const delegate_1 = require("@graphql-tools/delegate");
const cross_helpers_1 = require("@graphql-mesh/cross-helpers");
const SCALARS = {
    bigint: 'BigInt',
    'bigint unsigned': 'BigInt',
    binary: 'String',
    bit: 'Int',
    blob: 'String',
    bool: 'Boolean',
    boolean: 'Boolean',
    char: 'String',
    date: 'Date',
    datetime: 'DateTime',
    dec: 'Float',
    'dec unsigned': 'UnsignedFloat',
    decimal: 'Float',
    'decimal unsigned': 'UnsignedFloat',
    double: 'Float',
    'double unsigned': 'UnsignedFloat',
    float: 'Float',
    'float unsigned': 'UnsignedFloat',
    int: 'Int',
    'int unsigned': 'UnsignedInt',
    integer: 'Int',
    'integer unsigned': 'UnsignedInt',
    json: 'JSON',
    longblob: 'String',
    longtext: 'String',
    mediumblob: 'String',
    mediumint: 'Int',
    'mediumint unsigned': 'UnsignedInt',
    mediumtext: 'String',
    numeric: 'Float',
    'numeric unsigned': 'UnsignedFloat',
    smallint: 'Int',
    'smallint unsigned': 'UnsignedInt',
    text: 'String',
    time: 'Time',
    timestamp: 'Timestamp',
    tinyblob: 'String',
    tinyint: 'Int',
    'tinyint unsigned': 'UnsignedInt',
    tinytext: 'String',
    varbinary: 'String',
    varchar: 'String',
    year: 'Int',
};
async function getPromisifiedConnection(pool) {
    const getConnection = cross_helpers_1.util.promisify(pool.getConnection.bind(pool));
    const connection = await getConnection();
    const getDatabaseTables = cross_helpers_1.util.promisify(connection.databaseTables.bind(connection));
    const getTableFields = cross_helpers_1.util.promisify(connection.fields.bind(connection));
    const getTableForeigns = cross_helpers_1.util.promisify(connection.foreign.bind(connection));
    const getTablePrimaryKeyMetadata = cross_helpers_1.util.promisify(connection.primary.bind(connection));
    const selectLimit = cross_helpers_1.util.promisify(connection.selectLimit.bind(connection));
    const select = cross_helpers_1.util.promisify(connection.select.bind(connection));
    const insert = cross_helpers_1.util.promisify(connection.insert.bind(connection));
    const update = cross_helpers_1.util.promisify(connection.update.bind(connection));
    const deleteRow = cross_helpers_1.util.promisify(connection.delete.bind(connection));
    const count = cross_helpers_1.util.promisify(connection.count.bind(connection));
    const release = connection.release.bind(connection);
    return {
        connection,
        release,
        getDatabaseTables,
        getTableFields,
        getTableForeigns,
        getTablePrimaryKeyMetadata,
        selectLimit,
        select,
        insert,
        update,
        deleteRow,
        count,
    };
}
function getFieldsFromResolveInfo(info) {
    const fieldMap = (0, graphql_fields_1.default)(info);
    return Object.keys(fieldMap).filter(fieldName => Object.keys(fieldMap[fieldName]).length === 0 && fieldName !== '__typename');
}
class MySQLHandler {
    constructor({ name, config, baseDir, pubsub, store, importFn, logger, }) {
        this.config = config;
        this.baseDir = baseDir;
        this.pubsub = pubsub;
        this.store = store;
        this.importFn = importFn;
    }
    getCachedIntrospectionConnection(pool) {
        let promisifiedConnection$;
        return new Proxy({}, {
            get: (_, methodName) => {
                if (methodName === 'release') {
                    return () => promisifiedConnection$ === null || promisifiedConnection$ === void 0 ? void 0 : promisifiedConnection$.then(promisifiedConnection => promisifiedConnection === null || promisifiedConnection === void 0 ? void 0 : promisifiedConnection.connection.release());
                }
                return async (...args) => {
                    const cacheKey = [methodName, ...args].join('_');
                    const cacheProxy = this.store.proxy(cacheKey, store_1.PredefinedProxyOptions.JsonWithoutValidation);
                    return cacheProxy.getWithSet(async () => {
                        promisifiedConnection$ = promisifiedConnection$ || getPromisifiedConnection(pool);
                        const promisifiedConnection = await promisifiedConnection$;
                        return promisifiedConnection[methodName](...args);
                    });
                };
            },
        });
    }
    async getMeshSource() {
        const { pool: configPool } = this.config;
        const schemaComposer = new graphql_compose_1.SchemaComposer();
        const pool = configPool
            ? typeof configPool === 'string'
                ? await (0, utils_1.loadFromModuleExportExpression)(configPool, {
                    cwd: this.baseDir,
                    defaultExportName: 'default',
                    importFn: this.importFn,
                })
                : configPool
            : (0, mysql_1.createPool)({
                supportBigNumbers: true,
                bigNumberStrings: true,
                trace: !!cross_helpers_1.process.env.DEBUG,
                debug: !!cross_helpers_1.process.env.DEBUG,
                host: this.config.host && string_interpolation_1.stringInterpolator.parse(this.config.host, { env: cross_helpers_1.process.env }),
                port: this.config.port &&
                    parseInt(string_interpolation_1.stringInterpolator.parse(this.config.port.toString(), { env: cross_helpers_1.process.env })),
                user: this.config.user && string_interpolation_1.stringInterpolator.parse(this.config.user, { env: cross_helpers_1.process.env }),
                password: this.config.password &&
                    string_interpolation_1.stringInterpolator.parse(this.config.password, { env: cross_helpers_1.process.env }),
                database: this.config.database &&
                    string_interpolation_1.stringInterpolator.parse(this.config.database, { env: cross_helpers_1.process.env }),
                ...this.config,
            });
        pool.on('connection', connection => {
            (0, mysql_utilities_1.upgrade)(connection);
            (0, mysql_utilities_1.introspection)(connection);
        });
        const introspectionConnection = this.getCachedIntrospectionConnection(pool);
        schemaComposer.add(graphql_scalars_1.GraphQLBigInt);
        schemaComposer.add(graphql_scalars_1.GraphQLJSON);
        schemaComposer.add(graphql_scalars_1.GraphQLDate);
        schemaComposer.add(graphql_scalars_1.GraphQLTime);
        schemaComposer.add(graphql_scalars_1.GraphQLDateTime);
        schemaComposer.add(graphql_scalars_1.GraphQLTimestamp);
        schemaComposer.add(graphql_scalars_1.GraphQLUnsignedInt);
        schemaComposer.add(graphql_scalars_1.GraphQLUnsignedFloat);
        schemaComposer.createEnumTC({
            name: 'OrderBy',
            values: {
                asc: {
                    value: 'asc',
                },
                desc: {
                    value: 'desc',
                },
            },
        });
        const tables = await introspectionConnection.getDatabaseTables(pool.config.connectionConfig.database);
        const tableNames = this.config.tables || Object.keys(tables);
        const typeMergingOptions = {};
        await Promise.all(tableNames.map(async (tableName) => {
            var _a, _b;
            if (this.config.tables && !this.config.tables.includes(tableName)) {
                return;
            }
            const table = tables[tableName];
            const objectTypeName = (0, utils_1.sanitizeNameForGraphQL)(table.TABLE_NAME);
            const insertInputName = (0, utils_1.sanitizeNameForGraphQL)(table.TABLE_NAME + '_InsertInput');
            const updateInputName = (0, utils_1.sanitizeNameForGraphQL)(table.TABLE_NAME + '_UpdateInput');
            const whereInputName = (0, utils_1.sanitizeNameForGraphQL)(table.TABLE_NAME + '_WhereInput');
            const orderByInputName = (0, utils_1.sanitizeNameForGraphQL)(table.TABLE_NAME + '_OrderByInput');
            const tableTC = schemaComposer.createObjectTC({
                name: objectTypeName,
                description: table.TABLE_COMMENT || undefined,
                extensions: table,
                fields: {},
            });
            const tableInsertIC = schemaComposer.createInputTC({
                name: insertInputName,
                description: table.TABLE_COMMENT || undefined,
                extensions: table,
                fields: {},
            });
            const tableUpdateIC = schemaComposer.createInputTC({
                name: updateInputName,
                description: table.TABLE_COMMENT || undefined,
                extensions: table,
                fields: {},
            });
            const tableWhereIC = schemaComposer.createInputTC({
                name: whereInputName,
                description: table.TABLE_COMMENT || undefined,
                extensions: table,
                fields: {},
            });
            const tableOrderByIC = schemaComposer.createInputTC({
                name: orderByInputName,
                description: table.TABLE_COMMENT || undefined,
                extensions: table,
                fields: {},
            });
            const primaryKeys = new Set();
            const fields = await introspectionConnection.getTableFields(tableName);
            const fieldNames = ((_b = (_a = this.config.tableFields) === null || _a === void 0 ? void 0 : _a.find(({ table }) => table === tableName)) === null || _b === void 0 ? void 0 : _b.fields) ||
                Object.keys(fields);
            await Promise.all(fieldNames.map(async (fieldName) => {
                const tableField = fields[fieldName];
                if (tableField.Key === 'PRI') {
                    primaryKeys.add(fieldName);
                }
                const typePattern = tableField.Type;
                const [realTypeNameCased, restTypePattern] = typePattern.split('(');
                const [typeDetails] = (restTypePattern === null || restTypePattern === void 0 ? void 0 : restTypePattern.split(')')) || [];
                const realTypeName = realTypeNameCased.toLowerCase();
                let type = SCALARS[realTypeName];
                if (realTypeName === 'enum' || realTypeName === 'set') {
                    const enumValues = typeDetails.split(`'`).join('').split(',');
                    const enumTypeName = (0, utils_1.sanitizeNameForGraphQL)(tableName + '_' + fieldName);
                    schemaComposer.createEnumTC({
                        name: enumTypeName,
                        values: enumValues.reduce((prev, curr) => {
                            const enumKey = (0, utils_1.sanitizeNameForGraphQL)(curr);
                            return {
                                ...prev,
                                [enumKey]: {
                                    value: curr,
                                },
                            };
                        }, {}),
                    });
                    type = enumTypeName;
                }
                if (!type) {
                    console.warn(`${realTypeName} couldn't be mapped to a type. It will be mapped to JSON as a fallback.`);
                    type = 'JSON';
                }
                if (tableField.Null.toLowerCase() === 'no') {
                    type += '!';
                }
                tableTC.addFields({
                    [fieldName]: {
                        type,
                        description: tableField.Comment || undefined,
                    },
                });
                tableInsertIC.addFields({
                    [fieldName]: {
                        type,
                        description: tableField.Comment || undefined,
                    },
                });
                tableUpdateIC.addFields({
                    [fieldName]: {
                        type: type.replace('!', ''),
                        description: tableField.Comment || undefined,
                    },
                });
                tableWhereIC.addFields({
                    [fieldName]: {
                        type: 'String',
                        description: tableField.Comment || undefined,
                    },
                });
                tableOrderByIC.addFields({
                    [fieldName]: {
                        type: 'OrderBy',
                        description: tableField.Comment || undefined,
                    },
                });
            }));
            const tableForeigns = await introspectionConnection.getTableForeigns(tableName);
            const tableForeignNames = Object.keys(tableForeigns);
            await Promise.all(tableForeignNames.map(async (foreignName) => {
                const tableForeign = tableForeigns[foreignName];
                const columnName = tableForeign.COLUMN_NAME;
                if (!fieldNames.includes(columnName)) {
                    return;
                }
                const foreignTableName = tableForeign.REFERENCED_TABLE_NAME;
                const foreignColumnName = tableForeign.REFERENCED_COLUMN_NAME;
                const foreignObjectTypeName = (0, utils_1.sanitizeNameForGraphQL)(foreignTableName);
                const foreignWhereInputName = (0, utils_1.sanitizeNameForGraphQL)(foreignTableName + '_WhereInput');
                const foreignOrderByInputName = (0, utils_1.sanitizeNameForGraphQL)(foreignTableName + '_OrderByInput');
                tableTC.addFields({
                    [foreignTableName]: {
                        type: '[' + foreignObjectTypeName + ']',
                        args: {
                            where: {
                                type: foreignWhereInputName,
                            },
                            orderBy: {
                                type: foreignOrderByInputName,
                            },
                            limit: {
                                type: 'Int',
                            },
                            offset: {
                                type: 'Int',
                            },
                        },
                        extensions: tableForeign,
                        resolve: async (root, args, { mysqlConnection }, info) => {
                            const where = {
                                [foreignColumnName]: root[columnName],
                                ...args === null || args === void 0 ? void 0 : args.where,
                            };
                            // Generate limit statement
                            const limit = [args.limit, args.offset].filter(Boolean);
                            const fields = getFieldsFromResolveInfo(info);
                            if (limit.length) {
                                return mysqlConnection.selectLimit(foreignTableName, fields, limit, where, args === null || args === void 0 ? void 0 : args.orderBy);
                            }
                            else {
                                return mysqlConnection.select(foreignTableName, fields, where, args === null || args === void 0 ? void 0 : args.orderBy);
                            }
                        },
                    },
                });
                const foreignOTC = schemaComposer.getOTC(foreignObjectTypeName);
                foreignOTC.addFields({
                    [tableName]: {
                        type: '[' + objectTypeName + ']',
                        args: {
                            limit: {
                                type: 'Int',
                            },
                            offset: {
                                type: 'Int',
                            },
                            where: {
                                type: whereInputName,
                            },
                            orderBy: {
                                type: orderByInputName,
                            },
                        },
                        extensions: {
                            COLUMN_NAME: foreignColumnName,
                        },
                        resolve: (root, args, { mysqlConnection }, info) => {
                            const where = {
                                [columnName]: root[foreignColumnName],
                                ...args === null || args === void 0 ? void 0 : args.where,
                            };
                            const fieldMap = (0, graphql_fields_1.default)(info);
                            const fields = [];
                            for (const fieldName in fieldMap) {
                                if (fieldName !== '__typename') {
                                    const subFieldMap = fieldMap[fieldName];
                                    if (Object.keys(subFieldMap).length === 0) {
                                        fields.push(fieldName);
                                    }
                                    else {
                                        const tableForeign = schemaComposer
                                            .getOTC(objectTypeName)
                                            .getField(fieldName).extensions;
                                        fields.push(tableForeign.COLUMN_NAME);
                                    }
                                }
                            }
                            // Generate limit statement
                            const limit = [args.limit, args.offset].filter(Boolean);
                            if (limit.length) {
                                return mysqlConnection.selectLimit(tableName, fields, limit, where, args === null || args === void 0 ? void 0 : args.orderBy);
                            }
                            else {
                                return mysqlConnection.select(tableName, fields, where, args === null || args === void 0 ? void 0 : args.orderBy);
                            }
                        },
                    },
                });
            }));
            typeMergingOptions[objectTypeName] = {
                selectionSet: `{ ${[...primaryKeys].join(' ')} }`,
                args: obj => {
                    const where = {};
                    for (const primaryKey of primaryKeys) {
                        where[primaryKey] = obj[primaryKey];
                    }
                    return {
                        where,
                    };
                },
                valuesFromResults: results => results[0],
            };
            schemaComposer.Query.addFields({
                [tableName]: {
                    type: '[' + objectTypeName + ']',
                    args: {
                        limit: {
                            type: 'Int',
                        },
                        offset: {
                            type: 'Int',
                        },
                        where: {
                            type: whereInputName,
                        },
                        orderBy: {
                            type: orderByInputName,
                        },
                    },
                    resolve: (root, args, { mysqlConnection }, info) => {
                        const fieldMap = (0, graphql_fields_1.default)(info);
                        const fields = [];
                        for (const fieldName in fieldMap) {
                            if (fieldName !== '__typename') {
                                const subFieldMap = fieldMap[fieldName];
                                if (Object.keys(subFieldMap).length === 0) {
                                    fields.push(fieldName);
                                }
                                else {
                                    const tableForeign = schemaComposer.getOTC(objectTypeName).getField(fieldName)
                                        .extensions;
                                    fields.push(tableForeign.COLUMN_NAME);
                                }
                            }
                        }
                        // Generate limit statement
                        const limit = [args.limit, args.offset].filter(Boolean);
                        if (limit.length) {
                            return mysqlConnection.selectLimit(tableName, fields, limit, args.where, args === null || args === void 0 ? void 0 : args.orderBy);
                        }
                        else {
                            return mysqlConnection.select(tableName, fields, args.where, args === null || args === void 0 ? void 0 : args.orderBy);
                        }
                    },
                },
            });
            schemaComposer.Query.addFields({
                [`count_${tableName}`]: {
                    type: 'Int',
                    args: {
                        where: {
                            type: whereInputName,
                        },
                    },
                    resolve: (root, args, { mysqlConnection }, info) => mysqlConnection.count(tableName, args.where),
                },
            });
            schemaComposer.Mutation.addFields({
                [`insert_${tableName}`]: {
                    type: objectTypeName,
                    args: {
                        [tableName]: {
                            type: insertInputName + '!',
                        },
                    },
                    resolve: async (root, args, { mysqlConnection }, info) => {
                        const input = args[tableName];
                        const { recordId } = await mysqlConnection.insert(tableName, input);
                        const fields = getFieldsFromResolveInfo(info);
                        const where = {};
                        for (const primaryColumnName of primaryKeys) {
                            where[primaryColumnName] = input[primaryColumnName] || recordId;
                        }
                        const result = await mysqlConnection.select(tableName, fields, where, {});
                        return result[0];
                    },
                },
                [`update_${tableName}`]: {
                    type: objectTypeName,
                    args: {
                        [tableName]: {
                            type: updateInputName + '!',
                        },
                        where: {
                            type: whereInputName,
                        },
                    },
                    resolve: async (root, args, { mysqlConnection }, info) => {
                        await mysqlConnection.update(tableName, args[tableName], args.where);
                        const fields = getFieldsFromResolveInfo(info);
                        const result = await mysqlConnection.select(tableName, fields, args.where, {});
                        return result[0];
                    },
                },
                [`delete_${tableName}`]: {
                    type: 'Boolean',
                    args: {
                        where: {
                            type: whereInputName,
                        },
                    },
                    resolve: (root, args, { mysqlConnection }) => mysqlConnection
                        .deleteRow(tableName, args.where)
                        .then(result => !!(result === null || result === void 0 ? void 0 : result.affectedRows)),
                },
            });
        }));
        introspectionConnection.release();
        const id = this.pubsub.subscribe('destroy', () => {
            pool.end(err => {
                if (err) {
                    console.error(err);
                }
                this.pubsub.unsubscribe(id);
            });
        });
        // graphql-compose doesn't add @defer and @stream to the schema
        graphql_1.specifiedDirectives.forEach(directive => schemaComposer.addDirective(directive));
        const schema = schemaComposer.buildSchema();
        const executor = (0, delegate_1.createDefaultExecutor)(schema);
        return {
            schema,
            async executor(executionRequest) {
                const mysqlConnection = await getPromisifiedConnection(pool);
                try {
                    return await executor({
                        ...executionRequest,
                        context: {
                            ...executionRequest.context,
                            mysqlConnection,
                        },
                    });
                }
                catch (e) {
                    return e;
                }
                finally {
                    mysqlConnection.release();
                }
            },
        };
    }
}
exports.default = MySQLHandler;
