import { putObject } from "./s3";
import { buildPreviews } from "./previews";

// Загрузка медиа: оригинал в S3, затем превью - в том же запросе.
export async function upload(mediaId: string, body: Buffer, kind: "image" | "video"): Promise<{ mediaId: string }> {
  await putObject(`originals/${mediaId}`, body);
  await buildPreviews(mediaId, body, kind); // до 6 с для изображений, видео - до тайм-аута
  return { mediaId };
}
