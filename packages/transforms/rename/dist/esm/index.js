import WrapRename from './wrapRename.js';
import BareRename from './bareRename.js';
export default (function RenameTransform(options) {
    if (Array.isArray(options.config)) {
        return new WrapRename({
            config: {
                mode: 'wrap',
                renames: options.config,
            },
        });
    }
    return options.config.mode === 'bare' ? new BareRename(options) : new WrapRename(options);
});
