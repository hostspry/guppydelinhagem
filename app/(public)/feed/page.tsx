import type { Metadata } from "next";
import { getVideoFeed } from "@/lib/queries/products";
import { getConfigPreco } from "@/lib/queries/config";
import VideoFeed from "@/components/feed/VideoFeed";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Feed de vídeos · Guppy de Linhagem",
  robots: { index: false, follow: false }, // feed não indexa
};

export default async function FeedPage({
  searchParams,
}: {
  searchParams: Promise<{ p?: string }>;
}) {
  const sp = await searchParams;
  const startSlug = typeof sp.p === "string" ? sp.p : undefined;

  const [produtos, { descontoPixGlobalPercent }] = await Promise.all([
    getVideoFeed(),
    getConfigPreco(),
  ]);

  return (
    <VideoFeed
      produtos={produtos}
      descontoPixGlobalPercent={descontoPixGlobalPercent}
      startSlug={startSlug}
    />
  );
}
