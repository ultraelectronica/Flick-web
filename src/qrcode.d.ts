declare module "qrcode" {
  interface QRCodeRenderOptions {
    color?: {
      dark?: string;
      light?: string;
    };
    errorCorrectionLevel?: "L" | "M" | "Q" | "H";
    margin?: number;
    type?: "svg" | "utf8" | "terminal";
    width?: number;
  }

  const QRCode: {
    toString(text: string, options?: QRCodeRenderOptions): Promise<string>;
  };

  export default QRCode;
}
