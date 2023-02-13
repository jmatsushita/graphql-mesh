"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const wrapFilter_js_1 = tslib_1.__importDefault(require("./wrapFilter.js"));
const bareFilter_js_1 = tslib_1.__importDefault(require("./bareFilter.js"));
exports.default = (function FilterTransform(options) {
    if (Array.isArray(options.config)) {
        return new wrapFilter_js_1.default({
            ...options,
            config: {
                mode: 'wrap',
                filters: options.config,
            },
        });
    }
    return options.config.mode === 'bare' ? new bareFilter_js_1.default(options) : new wrapFilter_js_1.default(options);
});
