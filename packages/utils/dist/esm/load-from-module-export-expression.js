/* eslint-disable @typescript-eslint/return-await */
import { path } from '@graphql-mesh/cross-helpers';
import { defaultImportFn } from './defaultImportFn.js';
export async function loadFromModuleExportExpression(expression, options) {
    if (typeof expression !== 'string') {
        return Promise.resolve(expression);
    }
    const { defaultExportName, cwd, importFn = defaultImportFn } = options || {};
    const [modulePath, exportName = defaultExportName] = expression.split('#');
    const mod = await tryImport(modulePath, cwd, importFn);
    return mod[exportName] || (mod.default && mod.default[exportName]) || mod.default || mod;
}
async function tryImport(modulePath, cwd, importFn) {
    try {
        return await importFn(modulePath);
    }
    catch (_a) {
        if (!path.isAbsolute(modulePath)) {
            const absoluteModulePath = path.isAbsolute(modulePath)
                ? modulePath
                : path.join(cwd, modulePath);
            return importFn(absoluteModulePath);
        }
    }
}
