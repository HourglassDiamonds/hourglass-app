declare module "bmp-js" {
  export function encode(input: {
    data: Buffer;
    width: number;
    height: number;
  }): { data: Uint8Array };
}
