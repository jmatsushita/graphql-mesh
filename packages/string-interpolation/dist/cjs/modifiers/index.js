"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.defaultModifiers = void 0;
const uppercase_js_1 = require("./uppercase.js");
const lowercase_js_1 = require("./lowercase.js");
const title_js_1 = require("./title.js");
exports.defaultModifiers = [
    {
        key: 'uppercase',
        transform: uppercase_js_1.uppercase,
    },
    {
        key: 'lowercase',
        transform: lowercase_js_1.lowercase,
    },
    {
        key: 'title',
        transform: title_js_1.titlecase,
    },
];
