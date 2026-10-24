import { putObject } from "./s3";
import { buildPreviews } from "./previews";

// Загрузка изображения: оригинал в S3, затем превью - в том же запросе.
export async function upload(mediaId: string, body: Buffer): Promise<{ mediaId: string }> {
  await putObject(`originals/${mediaId}`, body);
  await buildPreviews(mediaId, body); // p95 3.9 с
  return { mediaId };
}
