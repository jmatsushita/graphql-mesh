import WrapPrefix from './wrapPrefix.js';
import BarePrefix from './barePrefix.js';
export default (function PrefixTransform(options) {
    return options.config.mode === 'bare' ? new BarePrefix(options) : new WrapPrefix(options);
});
