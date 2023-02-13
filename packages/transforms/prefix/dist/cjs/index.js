"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const wrapPrefix_js_1 = tslib_1.__importDefault(require("./wrapPrefix.js"));
const barePrefix_js_1 = tslib_1.__importDefault(require("./barePrefix.js"));
exports.default = (function PrefixTransform(options) {
    return options.config.mode === 'bare' ? new barePrefix_js_1.default(options) : new wrapPrefix_js_1.default(options);
});
