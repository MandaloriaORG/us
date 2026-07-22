import sharp from "sharp";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  AvatarImageError,
  MAX_AVATAR_EDGE,
  MAX_AVATAR_FILE_BYTES,
  processAvatarImage,
} from "@/app/profile/avatar-image";

function input(buffer: Buffer) {
  return {
    size: buffer.length,
    arrayBuffer: async () =>
      buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer,
  };
}

async function expectCode(promise: Promise<unknown>, code: AvatarImageError["code"]) {
  await expect(promise).rejects.toMatchObject({ name: "AvatarImageError", code });
}

describe("processAvatarImage", () => {
  it("re-encodes to bounded WebP without carrying metadata", async () => {
    const source = await sharp({
      create: {
        width: 1024,
        height: 512,
        channels: 3,
        background: "#4b5563",
      },
    })
      .jpeg()
      .withMetadata({ orientation: 6 })
      .toBuffer();

    const output = await processAvatarImage(input(source));
    const metadata = await sharp(output).metadata();

    expect(metadata.format).toBe("webp");
    expect(Math.max(metadata.width ?? 0, metadata.height ?? 0)).toBe(MAX_AVATAR_EDGE);
    expect(metadata.exif).toBeUndefined();
    expect(metadata.xmp).toBeUndefined();
    expect(metadata.orientation).toBeUndefined();
  });

  it("does not enlarge a small valid image", async () => {
    const source = await sharp({
      create: {
        width: 100,
        height: 50,
        channels: 3,
        background: "#111827",
      },
    })
      .png()
      .toBuffer();

    const metadata = await sharp(await processAvatarImage(input(source))).metadata();
    expect({ width: metadata.width, height: metadata.height }).toEqual({
      width: 100,
      height: 50,
    });
  });

  it("rejects an oversized file before reading it", async () => {
    const arrayBuffer = vi.fn();

    await expectCode(
      processAvatarImage({ size: MAX_AVATAR_FILE_BYTES + 1, arrayBuffer }),
      "file_too_large",
    );
    expect(arrayBuffer).not.toHaveBeenCalled();
  });

  it("rejects images over the decoded-pixel limit", async () => {
    const source = Buffer.from(
      '<svg xmlns="http://www.w3.org/2000/svg" width="8000" height="6000"></svg>',
    );

    await expectCode(processAvatarImage(input(source)), "too_many_pixels");
  });

  it("rejects unsupported or animated formats", async () => {
    const source = Buffer.from(
      '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"></svg>',
    );

    await expectCode(processAvatarImage(input(source)), "unsupported_format");
  });

  it("maps corrupt content to a stable invalid-image error", async () => {
    await expectCode(processAvatarImage(input(Buffer.from("not an image"))), "invalid_image");
  });
});
