"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.defaultImportFn = void 0;
const cross_helpers_1 = require("@graphql-mesh/cross-helpers");
async function defaultImportFn(path) {
    var _a;
    let module = await (_a = path, Promise.resolve().then(() => __importStar(require(_a)))).catch(e => {
        if (e.code === 'ERR_REQUIRE_ESM') {
            // eslint-disable-next-line no-new-func
            return new Function(`return import(${JSON.stringify(path)})`)();
        }
        throw e;
    })
        .catch(e => {
        if (cross_helpers_1.path.isAbsolute(path) && !path.endsWith('.js') && !path.endsWith('.ts')) {
            return defaultImportFn(`${path}.ts`);
        }
        throw e;
    });
    if (module.default != null) {
        module = module.default;
    }
    if (typeof module === 'object' && module != null) {
        const prototypeOfObject = Object.getPrototypeOf(module);
        if (prototypeOfObject == null || prototypeOfObject === Object.prototype) {
            const normalizedVal = {};
            for (const key in module) {
                normalizedVal[key] = module[key];
            }
            return normalizedVal;
        }
    }
    return module;
}
exports.defaultImportFn = defaultImportFn;
