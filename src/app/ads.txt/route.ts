/**
 * ads.txt — só é servido quando o Publisher ID real do AdSense estiver
 * configurado. Nunca inventamos um Publisher ID: sem ID, respondemos 404.
 */
export const dynamic = "force-static";

export function GET() {
  const client = process.env.NEXT_PUBLIC_ADSENSE_CLIENT ?? "";
  // O client vem como "ca-pub-XXXX"; o ads.txt usa "pub-XXXX".
  const publisherId = client.replace(/^ca-/, "");
  if (!publisherId.startsWith("pub-")) {
    return new Response("Not found", { status: 404 });
  }
  const body = `google.com, ${publisherId}, DIRECT, f08c47fec0942fa0\n`;
  return new Response(body, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
