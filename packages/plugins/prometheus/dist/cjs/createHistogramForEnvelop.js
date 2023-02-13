"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createHistogramForEnvelop = exports.commonFillLabelsFnForEnvelop = exports.commonLabelsForEnvelop = void 0;
const prom_client_1 = require("prom-client");
exports.commonLabelsForEnvelop = ['operationType', 'operationName'];
function commonFillLabelsFnForEnvelop(params) {
    return {
        operationName: params.operationName,
        operationType: params.operationType,
    };
}
exports.commonFillLabelsFnForEnvelop = commonFillLabelsFnForEnvelop;
function createHistogramForEnvelop({ defaultName, help, valueFromConfig, registry, }) {
    return {
        histogram: new prom_client_1.Histogram({
            name: typeof valueFromConfig === 'string' ? valueFromConfig : defaultName,
            help,
            labelNames: exports.commonLabelsForEnvelop,
            registers: [registry],
        }),
        fillLabelsFn: commonFillLabelsFnForEnvelop,
    };
}
exports.createHistogramForEnvelop = createHistogramForEnvelop;
