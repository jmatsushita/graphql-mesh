"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PARSE_XML_OPTIONS = void 0;
exports.PARSE_XML_OPTIONS = {
    attributeNamePrefix: '',
    attributesGroupName: 'attributes',
    textNodeName: 'innerText',
    ignoreAttributes: false,
    removeNSPrefix: true,
    isArray: (_, __, ___, isAttribute) => !isAttribute,
    allowBooleanAttributes: true,
};
