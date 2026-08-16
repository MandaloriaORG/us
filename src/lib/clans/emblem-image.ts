import "server-only";

import sharp from "sharp";

export const MAX_EMBLEM_FILE_BYTES = 5 * 1024 * 1024;
export const MAX_EMBLEM_PIXELS = 40_000_000;
export const MAX_EMBLEM_EDGE = 512;

export type EmblemImageErrorCode =
  "empty_file" | "file_too_large" | "invalid_image" | "too_many_pixels" | "unsupported_format";

export class EmblemImageError extends Error {
  constructor(readonly code: EmblemImageErrorCode) {
    super(code);
    this.name = "EmblemImageError";
  }
}

export interface EmblemImageInput {
  size: number;
  arrayBuffer: () => Promise<ArrayBuffer>;
}

const supportedFormats = new Set(["jpeg", "png", "webp"]);

/** Re-encode a clan emblem to a bounded WebP in the same shape the avatar
 * pipeline uses. The `clan-emblems` bucket accepts WebP and PNG; WebP keeps a
 * single output path form (`<clan id>/<uuid>.webp`) for every upload. */
export async function processEmblemImage(input: EmblemImageInput): Promise<Buffer> {
  if (!Number.isSafeInteger(input.size) || input.size <= 0) {
    throw new EmblemImageError("empty_file");
  }
  if (input.size > MAX_EMBLEM_FILE_BYTES) {
    throw new EmblemImageError("file_too_large");
  }

  let bytes: Buffer;
  try {
    bytes = Buffer.from(await input.arrayBuffer());
  } catch {
    throw new EmblemImageError("invalid_image");
  }

  if (bytes.length === 0) throw new EmblemImageError("empty_file");
  if (bytes.length > MAX_EMBLEM_FILE_BYTES) {
    throw new EmblemImageError("file_too_large");
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

    if (!width || !height) throw new EmblemImageError("invalid_image");
    if (width * height > MAX_EMBLEM_PIXELS) {
      throw new EmblemImageError("too_many_pixels");
    }
    if (pages !== 1 || !metadata.format || !supportedFormats.has(metadata.format)) {
      throw new EmblemImageError("unsupported_format");
    }

    return await sharp(bytes, {
      animated: false,
      failOn: "error",
      limitInputPixels: MAX_EMBLEM_PIXELS,
      sequentialRead: true,
    })
      .rotate()
      .resize({
        width: MAX_EMBLEM_EDGE,
        height: MAX_EMBLEM_EDGE,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ effort: 4, quality: 82 })
      .toBuffer();
  } catch (error) {
    if (error instanceof EmblemImageError) throw error;
    throw new EmblemImageError("invalid_image");
  }
}

export function emblemImageMessage(error: EmblemImageError) {
  switch (error.code) {
    case "empty_file":
      return "Choose an emblem image.";
    case "file_too_large":
      return "Emblem image must be 5 MiB or smaller.";
    case "too_many_pixels":
      return "Emblem image dimensions are too large.";
    case "unsupported_format":
      return "Use a static JPEG, PNG, or WebP image.";
    case "invalid_image":
      return "We could not read that emblem image.";
  }
}
