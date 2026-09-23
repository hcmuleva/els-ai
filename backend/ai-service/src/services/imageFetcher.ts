import { uploadMediaToS3 } from "@els-ai/media-client";

const DIVERSE_FALLBACKS = [
  "https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=800&q=80", // Space / Earth
  "https://images.unsplash.com/photo-1507668077129-56e32842fceb?auto=format&fit=crop&w=800&q=80", // Chemistry / Lab
  "https://images.unsplash.com/photo-1534447677768-be436bb09401?auto=format&fit=crop&w=800&q=80", // Nature / Wildlife
  "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=800&q=80", // Biology / Plants
  "https://images.unsplash.com/photo-1446776811953-b23d57bd21aa?auto=format&fit=crop&w=800&q=80", // Solar system / Moon
  "https://images.unsplash.com/photo-1500485035595-cbe6f645feb1?auto=format&fit=crop&w=800&q=80", // Geography / Landscapes
  "https://images.unsplash.com/photo-1503676260728-1c00da094a0b?auto=format&fit=crop&w=800&q=80", // Education / Learning
];

/**
 * Searches public educational imagery (Wikimedia Commons) for a given topic,
 * downloads the image buffer, and uploads it to the platform's S3 media storage
 * so the jigsaw puzzle has a permanent, reliable, and diverse image.
 */
export async function fetchAndUploadTopicImage(
  topic: string,
  organizationId?: string,
): Promise<string> {
  const rawTopic = (topic || "Educational").trim();
  // Strip puzzle and generic words to extract the pure subject/concept (e.g. "Assemble the Solar System puzzle" -> "Solar System")
  const cleanTopic =
    rawTopic
      .replace(/assemble\s+(the|a)?/gi, "")
      .replace(/jigsaw|puzzle|picture|image|photo/gi, "")
      .replace(/quiz|test|exam|assessment|challenge|questions?/gi, "")
      .replace(/\b(grade|class|standard)\s*\d+\b/gi, "")
      .replace(/^(the|a|an)\s+/gi, "")
      .trim() || rawTopic;

  const orgId = organizationId || "8ba8388f-9907-486c-9883-3784c2f2f34e"; // default org

  try {
    // 1. Query Wikimedia Commons File namespace (gsrnamespace=6)
    const searchUrl = `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrnamespace=6&gsrsearch=${encodeURIComponent(
      cleanTopic,
    )}&gsrlimit=12&prop=imageinfo&iiprop=url|mime&format=json&origin=*`;

    const res = await fetch(searchUrl, {
      headers: {
        "User-Agent": "ELS-AI-EducationPlatform/1.0 (contact@els.ai)",
      },
      signal: AbortSignal.timeout(6000),
    });

    if (res.ok) {
      const data: any = await res.json();
      const pages = data?.query?.pages;
      if (pages && typeof pages === "object") {
        const pageList = Object.values(pages) as any[];

        // Filter valid bitmap images (JPG, PNG, JPEG)
        const candidates = pageList
          .map((p) => {
            const info = p?.imageinfo?.[0];
            const url = String(info?.url || "");
            const cleanUrl = url.split("?")[0].toLowerCase();
            const mime = String(info?.mime || "image/jpeg").toLowerCase();
            return {
              url,
              mime,
              isValid:
                cleanUrl.endsWith(".jpg") ||
                cleanUrl.endsWith(".jpeg") ||
                cleanUrl.endsWith(".png"),
            };
          })
          .filter((c) => c.isValid);

        // Randomly shuffle candidates so multiple puzzles or successive generations get different images
        for (let i = candidates.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
        }

        for (const candidate of candidates) {
          try {
            const imgRes = await fetch(candidate.url, {
              headers: {
                "User-Agent": "ELS-AI-EducationPlatform/1.0 (contact@els.ai)",
              },
              signal: AbortSignal.timeout(8000),
            });

            if (imgRes.ok) {
              const arrayBuf = await imgRes.arrayBuffer();
              const buffer = Buffer.from(arrayBuf);
              // Ensure size is valid bitmap (10KB to 5MB)
              if (buffer.length > 10000 && buffer.length < 5 * 1024 * 1024) {
                const base64 = buffer.toString("base64");
                const mimeType = candidate.mime.includes("png") ? "image/png" : "image/jpeg";
                const dataUrl = `data:${mimeType};base64,${base64}`;
                const safeName = cleanTopic.toLowerCase().replace(/[^a-z0-9]/g, "_").slice(0, 30);
                const uploaded = await uploadMediaToS3({
                  organizationId: orgId,
                  dataUrl,
                  fileName: `jigsaw_${safeName}_${Date.now()}_${Math.floor(Math.random() * 1000)}.jpg`,
                  mimeType: mimeType,
                  mediaType: "image",
                });
                if (uploaded?.url) {
                  return uploaded.url;
                }
              }
            }
          } catch (dlErr) {
            console.warn("[imageFetcher] Candidate download error, trying next candidate:", dlErr);
          }
        }
      }
    }
  } catch (err) {
    console.warn("[imageFetcher] Failed to search or upload online image for topic:", topic, err);
  }

  // Diverse educational fallback if Wikimedia search fails
  const randomFallback = DIVERSE_FALLBACKS[Math.floor(Math.random() * DIVERSE_FALLBACKS.length)];
  return randomFallback;
}
