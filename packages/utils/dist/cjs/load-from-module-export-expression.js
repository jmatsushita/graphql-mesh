"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadFromModuleExportExpression = void 0;
/* eslint-disable @typescript-eslint/return-await */
const cross_helpers_1 = require("@graphql-mesh/cross-helpers");
const defaultImportFn_js_1 = require("./defaultImportFn.js");
async function loadFromModuleExportExpression(expression, options) {
    if (typeof expression !== 'string') {
        return Promise.resolve(expression);
    }
    const { defaultExportName, cwd, importFn = defaultImportFn_js_1.defaultImportFn } = options || {};
    const [modulePath, exportName = defaultExportName] = expression.split('#');
    const mod = await tryImport(modulePath, cwd, importFn);
    return mod[exportName] || (mod.default && mod.default[exportName]) || mod.default || mod;
}
exports.loadFromModuleExportExpression = loadFromModuleExportExpression;
async function tryImport(modulePath, cwd, importFn) {
    try {
        return await importFn(modulePath);
    }
    catch (_a) {
        if (!cross_helpers_1.path.isAbsolute(modulePath)) {
            const absoluteModulePath = cross_helpers_1.path.isAbsolute(modulePath)
                ? modulePath
                : cross_helpers_1.path.join(cwd, modulePath);
            return importFn(absoluteModulePath);
        }
    }
}
