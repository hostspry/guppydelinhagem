import "server-only";
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { randomUUID } from "crypto";

function env(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} não configurada no ambiente.`);
  return v;
}

// Singleton lazy: evita instanciar (e exigir env) durante o "Collecting page
// data" do build, quando as vars de runtime podem não estar presentes.
let cached: S3Client | undefined;
function client(): S3Client {
  if (cached) return cached;
  cached = new S3Client({
    endpoint: env("S3_ENDPOINT"),
    region: env("S3_REGION"),
    credentials: {
      accessKeyId: env("S3_ACCESS_KEY_ID"),
      secretAccessKey: env("S3_SECRET_ACCESS_KEY"),
    },
    forcePathStyle: true, // Garage exige path-style (não virtual-hosted)
  });
  return cached;
}

/** Envia um buffer de imagem ao Garage e retorna a URL pública de leitura. */
export async function uploadImage(
  buffer: Buffer,
  contentType: string,
  ext: string,
): Promise<string> {
  const key = `produtos/thumbs/${randomUUID()}.${ext}`;
  await client().send(
    new PutObjectCommand({
      Bucket: env("S3_BUCKET"),
      Key: key,
      Body: buffer,
      ContentType: contentType,
    }),
  );
  return `${env("S3_PUBLIC_URL")}/${key}`;
}

/**
 * Remove um objeto a partir da sua URL pública. No-op se a URL não for do nosso
 * domínio público (não deletamos thumbnails externas coladas pelo admin).
 */
export async function deleteImage(publicUrl: string): Promise<void> {
  const base = env("S3_PUBLIC_URL");
  const prefix = base.endsWith("/") ? base : `${base}/`;
  if (!publicUrl.startsWith(prefix)) return;
  const key = publicUrl.slice(prefix.length);
  if (!key) return;
  await client().send(
    new DeleteObjectCommand({ Bucket: env("S3_BUCKET"), Key: key }),
  );
}
