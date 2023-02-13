import WrapNamingConvention from './wrapNamingConvention.js';
import BareNamingConvention from './bareNamingConvention.js';
export default (function NamingConventionTransform(options) {
    return options.config.mode === 'bare'
        ? new BareNamingConvention(options)
        : new WrapNamingConvention(options);
});
