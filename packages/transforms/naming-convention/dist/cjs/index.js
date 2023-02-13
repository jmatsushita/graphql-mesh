"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const wrapNamingConvention_js_1 = tslib_1.__importDefault(require("./wrapNamingConvention.js"));
const bareNamingConvention_js_1 = tslib_1.__importDefault(require("./bareNamingConvention.js"));
exports.default = (function NamingConventionTransform(options) {
    return options.config.mode === 'bare'
        ? new bareNamingConvention_js_1.default(options)
        : new wrapNamingConvention_js_1.default(options);
});
