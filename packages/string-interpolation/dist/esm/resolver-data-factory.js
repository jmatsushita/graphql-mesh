import { stringInterpolator } from './index.js';
export function getInterpolationKeys(...interpolationStrings) {
    return interpolationStrings.reduce((keys, str) => [
        ...keys,
        ...(str ? stringInterpolator.parseRules(str).map((match) => match.key) : []),
    ], []);
}
export function parseInterpolationStrings(interpolationStrings, argTypeMap) {
    const interpolationKeys = getInterpolationKeys(...interpolationStrings);
    const args = {};
    const contextVariables = {};
    for (const interpolationKey of interpolationKeys) {
        const interpolationKeyParts = interpolationKey.split('.');
        const varName = interpolationKeyParts[interpolationKeyParts.length - 1];
        const initialObject = interpolationKeyParts[0];
        const argType = argTypeMap && varName in argTypeMap
            ? argTypeMap[varName]
            : interpolationKeyParts.length > 2
                ? 'JSON'
                : 'ID';
        switch (initialObject) {
            case 'args':
                args[varName] = {
                    type: argType,
                };
                break;
            case 'context':
                contextVariables[varName] = `Scalars['${argType}']`;
                break;
        }
    }
    return {
        args,
        contextVariables,
    };
}
export function getInterpolatedStringFactory(nonInterpolatedString) {
    return resolverData => stringInterpolator.parse(nonInterpolatedString, resolverData);
}
export function getInterpolatedHeadersFactory(nonInterpolatedHeaders = {}) {
    return resolverData => {
        const headers = {};
        for (const headerName in nonInterpolatedHeaders) {
            const headerValue = nonInterpolatedHeaders[headerName];
            if (headerValue) {
                headers[headerName.toLowerCase()] = stringInterpolator.parse(headerValue, resolverData);
            }
        }
        return headers;
    };
}
