import sharp from "sharp";

export const AVATAR_MAX_BYTES = 256 * 1024;
export const AVATAR_PIXELS = 256;
const prefix = "data:image/jpeg;base64,";
const maxBase64Length = Math.ceil(AVATAR_MAX_BYTES / 3) * 4;

export class AvatarError extends Error {
  constructor(public readonly code: "AVATAR_TOO_LARGE" | "INVALID_AVATAR") {
    super(code);
  }
}

// Accept bytes, never remote URLs or paths. Re-encoding applies orientation and
// removes EXIF/GPS, embedded profiles, and any trailing content before storage.
export async function prepareAvatar(value: string): Promise<string> {
  if (value.length > prefix.length + maxBase64Length)
    throw new AvatarError("AVATAR_TOO_LARGE");
  if (!value.startsWith(prefix)) throw new AvatarError("INVALID_AVATAR");
  const encoded = value.slice(prefix.length);
  if (
    !encoded.length ||
    encoded.length % 4 !== 0 ||
    !/^[A-Za-z0-9+/]+={0,2}$/.test(encoded)
  )
    throw new AvatarError("INVALID_AVATAR");
  const input = Buffer.from(encoded, "base64");
  if (input.length > AVATAR_MAX_BYTES)
    throw new AvatarError("AVATAR_TOO_LARGE");
  if (
    input.toString("base64") !== encoded ||
    input[0] !== 0xff ||
    input[1] !== 0xd8 ||
    input[2] !== 0xff
  )
    throw new AvatarError("INVALID_AVATAR");
  try {
    const image = sharp(input, {
      failOn: "warning",
      limitInputPixels: 2048 * 2048,
      sequentialRead: true,
    });
    const metadata = await image.metadata();
    if (
      metadata.format !== "jpeg" ||
      !metadata.width ||
      !metadata.height ||
      metadata.width > 4096 ||
      metadata.height > 4096
    )
      throw new AvatarError("INVALID_AVATAR");
    const output = await image
      .autoOrient()
      .resize(AVATAR_PIXELS, AVATAR_PIXELS, {
        fit: "cover",
        position: "centre",
      })
      .jpeg({ quality: 82, chromaSubsampling: "4:2:0" })
      .timeout({ seconds: 5 })
      .toBuffer();
    if (output.length > AVATAR_MAX_BYTES)
      throw new AvatarError("AVATAR_TOO_LARGE");
    return prefix + output.toString("base64");
  } catch (error) {
    if (error instanceof AvatarError) throw error;
    throw new AvatarError("INVALID_AVATAR");
  }
}
