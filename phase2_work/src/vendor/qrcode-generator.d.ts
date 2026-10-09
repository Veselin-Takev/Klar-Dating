type QRCodeFactory = (typeNumber: 0, errorCorrectionLevel: 'L' | 'M' | 'Q' | 'H') => {
  addData(data: string, mode?: 'Numeric' | 'Alphanumeric' | 'Byte' | 'Kanji'): void;
  make(): void;
  getModuleCount(): number;
  isDark(row: number, col: number): boolean;
  createDataURL(cellSize?: number, margin?: number): string;
  createSvgTag(cellSize?: number, margin?: number): string;
};
declare const qrcode: QRCodeFactory;
export default qrcode;
