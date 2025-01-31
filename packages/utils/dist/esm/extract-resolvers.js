import { getResolversFromSchema } from '@graphql-tools/utils';
export function extractResolvers(schema) {
    const allResolvers = getResolversFromSchema(schema);
    const filteredResolvers = {};
    for (const prop in allResolvers) {
        if (!prop.startsWith('_')) {
            filteredResolvers[prop] = allResolvers[prop];
        }
        if (typeof filteredResolvers === 'object') {
            for (const fieldName in filteredResolvers[prop]) {
                if (!prop.startsWith('_resolveType')) {
                    filteredResolvers[prop][fieldName] = allResolvers[prop][fieldName];
                }
            }
        }
    }
    return filteredResolvers;
}
