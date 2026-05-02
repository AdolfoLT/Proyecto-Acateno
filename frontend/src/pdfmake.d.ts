declare module 'pdfmake/build/pdfmake' {
  const pdfMake: {
    fonts: Record<string, unknown>;
    createPdf: (docDef: unknown) => {
      getBase64: (cb: (b64: string) => void, errCb?: (err: unknown) => void) => void;
      download:  (nombre: string) => void;
      open:      () => void;
      print:     () => void;
    };
  };
  export default pdfMake;
}
