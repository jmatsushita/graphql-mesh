import { stringInterpolator, hashObject } from '@graphql-mesh/string-interpolation';
import { process } from '@graphql-mesh/cross-helpers';
export function computeCacheKey(options) {
    const argsHash = options.args ? hashObject(options.args) : '';
    const fieldNamesHash = hashObject(options.info.fieldNodes);
    if (!options.keyStr) {
        return `${options.info.parentType.name}-${options.info.fieldName}-${argsHash}-${fieldNamesHash}`;
    }
    const templateData = {
        typeName: options.info.parentType.name,
        fieldName: options.info.fieldName,
        args: options.args,
        argsHash,
        fieldNamesHash,
        info: options.info || null,
        env: process.env,
    };
    return stringInterpolator.parse(options.keyStr, templateData);
}
