import { DEFAULT_SCHEMA, load as loadYamlFromJsYaml, Type } from 'js-yaml';
import { fs, path as pathModule } from '@graphql-mesh/cross-helpers';
import { loadFromModuleExportExpression } from './load-from-module-export-expression.js';
export function isUrl(str) {
    return /^https?:\/\//.test(str);
}
export async function readFileOrUrl(filePathOrUrl, config) {
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
function getSchema(filepath, logger) {
    return DEFAULT_SCHEMA.extend([
        new Type('!include', {
            kind: 'scalar',
            resolve(path) {
                return typeof path === 'string';
            },
            construct(path) {
                const newCwd = pathModule.dirname(filepath);
                const absoluteFilePath = pathModule.isAbsolute(path)
                    ? path
                    : pathModule.resolve(newCwd, path);
                const content = fs.readFileSync(absoluteFilePath, 'utf8');
                return loadYaml(absoluteFilePath, content, logger);
            },
        }),
        new Type('!includes', {
            kind: 'scalar',
            resolve(path) {
                return typeof path === 'string';
            },
            construct(path) {
                const newCwd = pathModule.dirname(filepath);
                const absoluteDirPath = pathModule.isAbsolute(path)
                    ? path
                    : pathModule.resolve(newCwd, path);
                const files = fs.readdirSync(absoluteDirPath);
                return files.map(filePath => {
                    const absoluteFilePath = pathModule.resolve(absoluteDirPath, filePath);
                    const fileContent = fs.readFileSync(absoluteFilePath, 'utf8');
                    return loadYaml(absoluteFilePath, fileContent, logger);
                });
            },
        }),
    ]);
}
export function loadYaml(filepath, content, logger) {
    return loadYamlFromJsYaml(content, {
        filename: filepath,
        schema: getSchema(filepath, logger),
        onWarning(warning) {
            logger.warn(`${filepath}: ${warning.message}\n${warning.stack}`);
        },
    });
}
export async function readFile(fileExpression, { allowUnknownExtensions, cwd, fallbackFormat, importFn, logger }) {
    const [filePath] = fileExpression.split('#');
    if (/js$/.test(filePath) || /ts$/.test(filePath)) {
        return loadFromModuleExportExpression(fileExpression, {
            cwd,
            importFn,
            defaultExportName: 'default',
        });
    }
    const actualPath = pathModule.isAbsolute(filePath) ? filePath : pathModule.join(cwd, filePath);
    const rawResult = await fs.promises.readFile(actualPath, 'utf-8');
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
export async function readUrl(path, config) {
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