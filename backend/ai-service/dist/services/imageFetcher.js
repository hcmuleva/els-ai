import { uploadMediaToS3 } from "@els-ai/media-client";
/**
 * Searches public educational imagery (Wikimedia Commons) for a given topic,
 * downloads the image buffer, and uploads it to the platform's S3 media storage
 * so the jigsaw puzzle has a permanent, reliable image.
 */
export async function fetchAndUploadTopicImage(topic, organizationId) {
    const cleanTopic = (topic || "Educational Puzzle").trim();
    const orgId = organizationId || "8ba8388f-9907-486c-9883-3784c2f2f34e"; // default org
    try {
        // 1. Query Wikimedia Commons for educational image on topic
        const searchTerms = `${cleanTopic} filetype:bitmap`;
        const searchUrl = `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(searchTerms)}&gsrlimit=5&prop=imageinfo&iiprop=url|mime&format=json&origin=*`;
        const res = await fetch(searchUrl, {
            headers: {
                "User-Agent": "ELS-AI-EducationPlatform/1.0 (contact@els.ai)",
            },
            signal: AbortSignal.timeout(5000),
        });
        if (res.ok) {
            const data = await res.json();
            const pages = data?.query?.pages;
            if (pages && typeof pages === "object") {
                const pageList = Object.values(pages);
                // Pick best image URL
                for (const page of pageList) {
                    const info = page?.imageinfo?.[0];
                    const imgUrl = info?.url;
                    const mime = info?.mime || "image/jpeg";
                    if (imgUrl && typeof imgUrl === "string" && (imgUrl.endsWith(".jpg") || imgUrl.endsWith(".png") || imgUrl.endsWith(".jpeg"))) {
                        // Download image
                        const imgRes = await fetch(imgUrl, {
                            headers: {
                                "User-Agent": "ELS-AI-EducationPlatform/1.0 (contact@els.ai)",
                            },
                            signal: AbortSignal.timeout(8000),
                        });
                        if (imgRes.ok) {
                            const arrayBuf = await imgRes.arrayBuffer();
                            const buffer = Buffer.from(arrayBuf);
                            // Limit size to <= 5MB
                            if (buffer.length > 1000 && buffer.length < 5 * 1024 * 1024) {
                                const base64 = buffer.toString("base64");
                                const dataUrl = `data:${mime};base64,${base64}`;
                                const safeName = cleanTopic.toLowerCase().replace(/[^a-z0-9]/g, "_").slice(0, 30);
                                const uploaded = await uploadMediaToS3({
                                    organizationId: orgId,
                                    dataUrl,
                                    fileName: `jigsaw_${safeName}_${Date.now()}.jpg`,
                                    mimeType: mime,
                                    mediaType: "image",
                                });
                                if (uploaded?.url) {
                                    return uploaded.url;
                                }
                            }
                        }
                    }
                }
            }
        }
    }
    catch (err) {
        console.warn("[imageFetcher] Failed to fetch or upload online image for topic:", topic, err);
    }
    // Fallback to high quality curated educational placeholder
    return "https://images.unsplash.com/photo-1507668077129-56e32842fceb?auto=format&fit=crop&w=800&q=80";
}
