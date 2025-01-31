"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.findAndParseConfig = exports.validateConfig = void 0;
const tslib_1 = require("tslib");
const config_1 = require("@graphql-mesh/config");
const types_1 = require("@graphql-mesh/types");
const utils_1 = require("@graphql-mesh/utils");
const ajv_1 = tslib_1.__importDefault(require("ajv"));
const cosmiconfig_1 = require("cosmiconfig");
const cross_helpers_1 = require("@graphql-mesh/cross-helpers");
const utils_2 = require("@graphql-tools/utils");
function validateConfig(config, filepath, initialLoggerPrefix, throwOnInvalidConfig = false) {
    const ajv = new ajv_1.default({
        strict: false,
    });
    types_1.jsonSchema.$schema = undefined;
    const isValid = ajv.validate(types_1.jsonSchema, config);
    if (!isValid) {
        if (throwOnInvalidConfig) {
            const aggregateError = new utils_2.AggregateError(ajv.errors.map(e => {
                const error = new Error(e.message);
                error.stack += `\n    at ${filepath}:0:0`;
                return error;
            }), 'Configuration file is not valid');
            throw aggregateError;
        }
        const logger = new utils_1.DefaultLogger(initialLoggerPrefix).child('config');
        logger.warn('Configuration file is not valid!');
        logger.warn("This is just a warning! It doesn't have any effects on runtime.");
        ajv.errors.forEach(error => {
            let errorMessage = '';
            if (error.propertyName) {
                errorMessage += `Property: ${error.propertyName} \n`;
            }
            if (error.data) {
                errorMessage += `Given: ${error.data} \n`;
            }
            errorMessage += `Error: ${error.message}`;
            logger.warn(errorMessage);
        });
    }
}
exports.validateConfig = validateConfig;
async function findAndParseConfig(options) {
    const { configName = 'mesh', dir: configDir = '', initialLoggerPrefix = '🕸️  Mesh', importFn, ...restOptions } = options || {};
    const dir = cross_helpers_1.path.isAbsolute(configDir) ? configDir : cross_helpers_1.path.join(cross_helpers_1.process.cwd(), configDir);
    const explorer = (0, cosmiconfig_1.cosmiconfig)(configName, {
        searchPlaces: [
            'package.json',
            `.${configName}rc`,
            `.${configName}rc.json`,
            `.${configName}rc.yaml`,
            `.${configName}rc.yml`,
            `.${configName}rc.js`,
            `.${configName}rc.ts`,
            `.${configName}rc.cjs`,
            `${configName}.config.js`,
            `${configName}.config.cjs`,
        ],
        loaders: {
            '.json': customLoader('json', importFn, initialLoggerPrefix),
            '.yaml': customLoader('yaml', importFn, initialLoggerPrefix),
            '.yml': customLoader('yaml', importFn, initialLoggerPrefix),
            '.js': customLoader('js', importFn, initialLoggerPrefix),
            '.ts': customLoader('js', importFn, initialLoggerPrefix),
            noExt: customLoader('yaml', importFn, initialLoggerPrefix),
        },
    });
    const results = await explorer.search(dir);
    if (!results) {
        throw new Error(`No ${configName} config file found in "${dir}"!`);
    }
    const config = results.config;
    validateConfig(config, results.filepath, initialLoggerPrefix);
    return (0, config_1.processConfig)(config, { dir, initialLoggerPrefix, importFn, ...restOptions });
}
exports.findAndParseConfig = findAndParseConfig;
function customLoader(ext, importFn = utils_1.defaultImportFn, initialLoggerPrefix = '🕸️  Mesh') {
    const logger = new utils_1.DefaultLogger(initialLoggerPrefix).child('config');
    function loader(filepath, content) {
        if (cross_helpers_1.process.env) {
            content = content.replace(/\$\{(.*?)\}/g, (_, variable) => {
                let varName = variable;
                let defaultValue = '';
                if (variable.includes(':')) {
                    const spl = variable.split(':');
                    varName = spl.shift();
                    defaultValue = spl.join(':');
                }
                return cross_helpers_1.process.env[varName] || defaultValue;
            });
        }
        if (ext === 'json') {
            return cosmiconfig_1.defaultLoaders['.json'](filepath, content);
        }
        if (ext === 'yaml') {
            return (0, utils_1.loadYaml)(filepath, content, logger);
        }
        if (ext === 'js') {
            return importFn(filepath);
        }
    }
    return loader;
}
