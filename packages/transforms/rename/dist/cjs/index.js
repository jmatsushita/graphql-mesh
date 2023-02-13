"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const wrapRename_js_1 = tslib_1.__importDefault(require("./wrapRename.js"));
const bareRename_js_1 = tslib_1.__importDefault(require("./bareRename.js"));
exports.default = (function RenameTransform(options) {
    if (Array.isArray(options.config)) {
        return new wrapRename_js_1.default({
            config: {
                mode: 'wrap',
                renames: options.config,
            },
        });
    }
    return options.config.mode === 'bare' ? new bareRename_js_1.default(options) : new wrapRename_js_1.default(options);
});
