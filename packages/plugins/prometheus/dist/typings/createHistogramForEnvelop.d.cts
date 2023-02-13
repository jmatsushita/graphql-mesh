import { Histogram, Registry } from 'prom-client';
export declare const commonLabelsForEnvelop: readonly ["operationType", "operationName"];
export declare function commonFillLabelsFnForEnvelop(params: {
    operationName?: string;
    operationType?: string;
}): {
    operationName: string;
    operationType: string;
};
interface CreateHistogramContainerForEnvelop {
    defaultName: string;
    help: string;
    valueFromConfig: string | boolean;
    registry: Registry;
}
export declare function createHistogramForEnvelop({ defaultName, help, valueFromConfig, registry, }: CreateHistogramContainerForEnvelop): {
    histogram: Histogram<"operationType" | "operationName">;
    fillLabelsFn: typeof commonFillLabelsFnForEnvelop;
};
export {};
