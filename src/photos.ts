import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";

/** Uses the system photo picker; only the selected photo is returned to Solace. */
export async function chooseProfilePhoto(): Promise<string | null> {
  const selection = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    allowsMultipleSelection: false,
    allowsEditing: true,
    aspect: [1, 1],
    quality: 1,
    exif: false,
  });
  if (selection.canceled || !selection.assets?.[0]) return null;
  const asset = selection.assets[0];
  // Bound decoding on native before cropping a camera-resolution image.
  const source = ImageManipulator.manipulate(asset.uri, {
    maxWidth: 1024,
    maxHeight: 1024,
  });
  let loaded: Awaited<ReturnType<typeof source.renderAsync>> | undefined;
  let crop: ReturnType<typeof ImageManipulator.manipulate> | undefined;
  let rendered: Awaited<ReturnType<typeof source.renderAsync>> | undefined;
  try {
    loaded = await source.renderAsync();
    const size = Math.min(loaded.width, loaded.height);
    if (!Number.isFinite(size) || size < 1)
      throw new Error("This photo could not be opened. Choose another image.");
    crop = ImageManipulator.manipulate(loaded);
    crop.crop({
      originX: Math.floor((loaded.width - size) / 2),
      originY: Math.floor((loaded.height - size) / 2),
      width: size,
      height: size,
    });
    crop.resize({ width: 256, height: 256 });
    rendered = await crop.renderAsync();
    const photo = await rendered.saveAsync({
      format: SaveFormat.JPEG,
      compress: 0.82,
      base64: true,
    });
    if (!photo.base64 || photo.base64.length > 349528)
      throw new Error("This photo could not be prepared. Try another image.");
    return `data:image/jpeg;base64,${photo.base64}`;
  } finally {
    rendered?.release();
    crop?.release();
    loaded?.release();
    source.release();
  }
}
