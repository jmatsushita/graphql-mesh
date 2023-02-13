import { buildSchemaFromDatabase, buildSchemaFromInfile } from 'tuql';
import { path } from '@graphql-mesh/cross-helpers';
export default class TuqlHandler {
    constructor({ config, baseDir }) {
        this.config = config;
        this.baseDir = baseDir;
    }
    async getMeshSource() {
        const { schema, contextVariables } = await (this.config.infile
            ? buildSchemaFromInfile(path.isAbsolute(this.config.infile)
                ? this.config.db
                : path.join(this.baseDir, this.config.infile))
            : buildSchemaFromDatabase(path.isAbsolute(this.config.db)
                ? this.config.infile
                : path.join(this.baseDir, this.config.db)));
        return {
            schema,
            contextVariables,
        };
    }
}
