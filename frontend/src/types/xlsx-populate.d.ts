declare module 'xlsx-populate/browser/xlsx-populate' {
    interface Cell {
        value(v?: any): any;
        style(name: string, value?: any): any;
        hyperlink(hyperlink?: string): any;
    }
    
    interface Row {
        cell(columnNumber: number): Cell;
        style(name: string, value?: any): any;
        height(height?: number): any;
    }
    
    interface Sheet {
        cell(cellAddress: string): Cell;
        row(rowNumber: number): Row;
        column(columnLetter: string): any;
        range(start: string, end: string): any;
        name(name?: string): any;
        hidden(hidden?: boolean): any;
        active(active?: boolean): any;
    }
    
    interface Workbook {
        sheet(sheetName: string): Sheet;
        sheet(sheetIndex: number): Sheet;
        sheets(): Sheet[];
        deleteSheet(sheetName: string): Workbook;
        addSheet(sheetName: string, sheetIndex?: number): Sheet;
        outputAsync(): Promise<ArrayBuffer>;
        toFileAsync(path: string): Promise<void>;
    }
    
    const XlsxPopulate: {
        fromFileAsync(path: string): Promise<Workbook>;
        fromBlob(blob: Blob): Promise<Workbook>;
        fromBase64(base64: string): Promise<Workbook>;
        fromDataAsync(data: ArrayBuffer): Promise<Workbook>;
    };
    
    export default XlsxPopulate;
}
