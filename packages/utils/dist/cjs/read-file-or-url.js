"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.readUrl = exports.readFile = exports.loadYaml = exports.readFileOrUrl = exports.isUrl = void 0;
const js_yaml_1 = require("js-yaml");
const cross_helpers_1 = require("@graphql-mesh/cross-helpers");
const load_from_module_export_expression_js_1 = require("./load-from-module-export-expression.js");
function isUrl(str) {
    return /^https?:\/\//.test(str);
}
exports.isUrl = isUrl;
async function readFileOrUrl(filePathOrUrl, config) {
    if (isUrl(filePathOrUrl)) {
        config.logger.debug(`Fetching ${filePathOrUrl} via HTTP`);
        return readUrl(filePathOrUrl, config);
    }
    else if (filePathOrUrl.startsWith('{') || filePathOrUrl.startsWith('[')) {
        return JSON.parse(filePathOrUrl);
    }
    else {
        config.logger.debug(`Reading ${filePathOrUrl} from the file system`);
        return readFile(filePathOrUrl, config);
    }
}
exports.readFileOrUrl = readFileOrUrl;
function getSchema(filepath, logger) {
    return js_yaml_1.DEFAULT_SCHEMA.extend([
        new js_yaml_1.Type('!include', {
            kind: 'scalar',
            resolve(path) {
                return typeof path === 'string';
            },
            construct(path) {
                const newCwd = cross_helpers_1.path.dirname(filepath);
                const absoluteFilePath = cross_helpers_1.path.isAbsolute(path)
                    ? path
                    : cross_helpers_1.path.resolve(newCwd, path);
                const content = cross_helpers_1.fs.readFileSync(absoluteFilePath, 'utf8');
                return loadYaml(absoluteFilePath, content, logger);
            },
        }),
        new js_yaml_1.Type('!includes', {
            kind: 'scalar',
            resolve(path) {
                return typeof path === 'string';
            },
            construct(path) {
                const newCwd = cross_helpers_1.path.dirname(filepath);
                const absoluteDirPath = cross_helpers_1.path.isAbsolute(path)
                    ? path
                    : cross_helpers_1.path.resolve(newCwd, path);
                const files = cross_helpers_1.fs.readdirSync(absoluteDirPath);
                return files.map(filePath => {
                    const absoluteFilePath = cross_helpers_1.path.resolve(absoluteDirPath, filePath);
                    const fileContent = cross_helpers_1.fs.readFileSync(absoluteFilePath, 'utf8');
                    return loadYaml(absoluteFilePath, fileContent, logger);
                });
            },
        }),
    ]);
}
function loadYaml(filepath, content, logger) {
    return (0, js_yaml_1.load)(content, {
        filename: filepath,
        schema: getSchema(filepath, logger),
        onWarning(warning) {
            logger.warn(`${filepath}: ${warning.message}\n${warning.stack}`);
        },
    });
}
exports.loadYaml = loadYaml;
async function readFile(fileExpression, { allowUnknownExtensions, cwd, fallbackFormat, importFn, logger }) {
    const [filePath] = fileExpression.split('#');
    if (/js$/.test(filePath) || /ts$/.test(filePath)) {
        return (0, load_from_module_export_expression_js_1.loadFromModuleExportExpression)(fileExpression, {
            cwd,
            importFn,
            defaultExportName: 'default',
        });
    }
    const actualPath = cross_helpers_1.path.isAbsolute(filePath) ? filePath : cross_helpers_1.path.join(cwd, filePath);
    const rawResult = await cross_helpers_1.fs.promises.readFile(actualPath, 'utf-8');
    if (/json$/.test(actualPath)) {
        return JSON.parse(rawResult);
    }
    if (/yaml$/.test(actualPath) || /yml$/.test(actualPath)) {
        return loadYaml(actualPath, rawResult, logger);
    }
    else if (fallbackFormat) {
        switch (fallbackFormat) {
            case 'json':
                return JSON.parse(rawResult);
            case 'yaml':
                return loadYaml(actualPath, rawResult, logger);
            case 'ts':
            case 'js':
                return importFn(actualPath);
        }
    }
    else if (!allowUnknownExtensions) {
        throw new Error(`Failed to parse JSON/YAML. Ensure file '${filePath}' has ` +
            `the correct extension (i.e. '.json', '.yaml', or '.yml).`);
    }
    return rawResult;
}
exports.readFile = readFile;
async function readUrl(path, config) {
    var _a, _b;
    const { allowUnknownExtensions, fallbackFormat } = config || {};
    config.headers = config.headers || {};
    const response = await config.fetch(path, config);
    const contentType = ((_a = response.headers) === null || _a === void 0 ? void 0 : _a.get('content-type')) || '';
    const responseText = await response.text();
    (_b = config === null || config === void 0 ? void 0 : config.logger) === null || _b === void 0 ? void 0 : _b.debug(`${path} returned `, responseText);
    if (/json$/.test(path) ||
        contentType.startsWith('application/json') ||
        fallbackFormat === 'json') {
        return JSON.parse(responseText);
    }
    else if (/yaml$/.test(path) ||
        /yml$/.test(path) ||
        contentType.includes('yaml') ||
        contentType.includes('yml') ||
        fallbackFormat === 'yaml') {
        return loadYaml(path, responseText, config === null || config === void 0 ? void 0 : config.logger);
    }
    else if (!allowUnknownExtensions) {
        throw new Error(`Failed to parse JSON/YAML. Ensure URL '${path}' has ` +
            `the correct extension (i.e. '.json', '.yaml', or '.yml) or mime type in the response headers.`);
    }
    return responseText;
}
exports.readUrl = readUrl;
