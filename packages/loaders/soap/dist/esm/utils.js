export const PARSE_XML_OPTIONS = {
    attributeNamePrefix: '',
    attributesGroupName: 'attributes',
    textNodeName: 'innerText',
    ignoreAttributes: false,
    removeNSPrefix: true,
    isArray: (_, __, ___, isAttribute) => !isAttribute,
    allowBooleanAttributes: true,
};
