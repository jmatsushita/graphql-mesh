import { X2jOptions } from 'fast-xml-parser';
export interface SoapAnnotations {
    elementName: string;
    bindingNamespace: string;
    endpoint: string;
}
export declare const PARSE_XML_OPTIONS: Partial<X2jOptions>;
