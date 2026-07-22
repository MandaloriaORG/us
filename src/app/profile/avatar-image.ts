import "server-only";

import sharp from "sharp";

export const MAX_AVATAR_FILE_BYTES = 5 * 1024 * 1024;
export const MAX_AVATAR_PIXELS = 40_000_000;
export const MAX_AVATAR_EDGE = 512;

export type AvatarImageErrorCode =
  "empty_file" | "file_too_large" | "invalid_image" | "too_many_pixels" | "unsupported_format";

export class AvatarImageError extends Error {
  constructor(readonly code: AvatarImageErrorCode) {
    super(code);
    this.name = "AvatarImageError";
  }
}

export interface AvatarImageInput {
  size: number;
  arrayBuffer: () => Promise<ArrayBuffer>;
}

const supportedFormats = new Set(["jpeg", "png", "webp"]);

export async function processAvatarImage(input: AvatarImageInput): Promise<Buffer> {
  if (!Number.isSafeInteger(input.size) || input.size <= 0) {
    throw new AvatarImageError("empty_file");
  }
  if (input.size > MAX_AVATAR_FILE_BYTES) {
    throw new AvatarImageError("file_too_large");
  }

  let bytes: Buffer;
  try {
    bytes = Buffer.from(await input.arrayBuffer());
  } catch {
    throw new AvatarImageError("invalid_image");
  }

  if (bytes.length === 0) throw new AvatarImageError("empty_file");
  if (bytes.length > MAX_AVATAR_FILE_BYTES) {
    throw new AvatarImageError("file_too_large");
  }

  try {
    const metadata = await sharp(bytes, {
      animated: false,
      failOn: "error",
      limitInputPixels: false,
      sequentialRead: true,
    }).metadata();

    const width = metadata.width ?? 0;
    const height = metadata.height ?? 0;
    const pages = metadata.pages ?? 1;

    if (!width || !height) throw new AvatarImageError("invalid_image");
    if (width * height > MAX_AVATAR_PIXELS) {
      throw new AvatarImageError("too_many_pixels");
    }
    if (pages !== 1 || !metadata.format || !supportedFormats.has(metadata.format)) {
      throw new AvatarImageError("unsupported_format");
    }

    return await sharp(bytes, {
      animated: false,
      failOn: "error",
      limitInputPixels: MAX_AVATAR_PIXELS,
      sequentialRead: true,
    })
      .rotate()
      .resize({
        width: MAX_AVATAR_EDGE,
        height: MAX_AVATAR_EDGE,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ effort: 4, quality: 82 })
      .toBuffer();
  } catch (error) {
    if (error instanceof AvatarImageError) throw error;
    throw new AvatarImageError("invalid_image");
  }
}
