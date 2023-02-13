import { Histogram } from 'prom-client';
export const commonLabelsForEnvelop = ['operationType', 'operationName'];
export function commonFillLabelsFnForEnvelop(params) {
    return {
        operationName: params.operationName,
        operationType: params.operationType,
    };
}
export function createHistogramForEnvelop({ defaultName, help, valueFromConfig, registry, }) {
    return {
        histogram: new Histogram({
            name: typeof valueFromConfig === 'string' ? valueFromConfig : defaultName,
            help,
            labelNames: commonLabelsForEnvelop,
            registers: [registry],
        }),
        fillLabelsFn: commonFillLabelsFnForEnvelop,
    };
}
