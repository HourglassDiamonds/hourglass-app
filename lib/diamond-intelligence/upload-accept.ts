/** Client-safe Diamond Intelligence upload accept policy (browser file picker only). */

export const DI_ACCEPTED_MIMES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/jpg",
  "image/png",
]);

export const DI_ACCEPTED_EXTENSIONS = new Set([
  ".pdf",
  ".jpg",
  ".jpeg",
  ".png",
]);

export const DI_CLIENT_ACCEPT =
  "application/pdf,.pdf,image/jpeg,image/jpg,image/png,.jpg,.jpeg,.png";
