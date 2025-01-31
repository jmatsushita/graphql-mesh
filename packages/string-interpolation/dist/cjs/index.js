"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.stringInterpolator = exports.Interpolator = exports.hashObject = void 0;
const tslib_1 = require("tslib");
const interpolator_js_1 = require("./interpolator.js");
Object.defineProperty(exports, "Interpolator", { enumerable: true, get: function () { return interpolator_js_1.Interpolator; } });
const dayjs_1 = tslib_1.__importDefault(require("dayjs"));
const hashCode = (s) => s.split('').reduce((a, b) => ((a << 5) - a + b.charCodeAt(0)) | 0, 0);
function hashObject(value) {
    return hashCode(JSON.stringify(value)).toString();
}
exports.hashObject = hashObject;
exports.stringInterpolator = new interpolator_js_1.Interpolator({
    delimiter: ['{', '}'],
});
exports.stringInterpolator.addAlias('typeName', 'info.parentType.name');
exports.stringInterpolator.addAlias('type', 'info.parentType.name');
exports.stringInterpolator.addAlias('parentType', 'info.parentType.name');
exports.stringInterpolator.addAlias('fieldName', 'info.fieldName');
exports.stringInterpolator.registerModifier('date', (formatStr) => (0, dayjs_1.default)(new Date()).format(formatStr));
exports.stringInterpolator.registerModifier('hash', (value) => hashObject(value));
exports.stringInterpolator.registerModifier('base64', (value) => {
    if (globalThis.Buffer.from) {
        return globalThis.Buffer.from(value).toString('base64');
    }
    else {
        return btoa(value);
    }
});
tslib_1.__exportStar(require("./resolver-data-factory.js"), exports);
