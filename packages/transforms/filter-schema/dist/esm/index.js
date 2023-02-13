import WrapFilter from './wrapFilter.js';
import BareFilter from './bareFilter.js';
export default (function FilterTransform(options) {
    if (Array.isArray(options.config)) {
        return new WrapFilter({
            ...options,
            config: {
                mode: 'wrap',
                filters: options.config,
            },
        });
    }
    return options.config.mode === 'bare' ? new BareFilter(options) : new WrapFilter(options);
});
