import { Interpolator } from './interpolator.js';
import dayjs from 'dayjs';
const hashCode = (s) => s.split('').reduce((a, b) => ((a << 5) - a + b.charCodeAt(0)) | 0, 0);
export function hashObject(value) {
    return hashCode(JSON.stringify(value)).toString();
}
export { Interpolator };
export const stringInterpolator = new Interpolator({
    delimiter: ['{', '}'],
});
stringInterpolator.addAlias('typeName', 'info.parentType.name');
stringInterpolator.addAlias('type', 'info.parentType.name');
stringInterpolator.addAlias('parentType', 'info.parentType.name');
stringInterpolator.addAlias('fieldName', 'info.fieldName');
stringInterpolator.registerModifier('date', (formatStr) => dayjs(new Date()).format(formatStr));
stringInterpolator.registerModifier('hash', (value) => hashObject(value));
stringInterpolator.registerModifier('base64', (value) => {
    if (globalThis.Buffer.from) {
        return globalThis.Buffer.from(value).toString('base64');
    }
    else {
        return btoa(value);
    }
});
export * from './resolver-data-factory.js';
