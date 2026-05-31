# YouTube Video Curation — Krishna Animated Stories (Hindi)

Curated list of 10 short, kid-safe (LKG–Grade 5), embeddable Hindi animated YouTube videos in the **dharm** category.

- **Topic:** Krishna animated story
- **Language:** Hindi
- **Category:** dharm
- **maxDuration:** ~4–5 minutes
- **Validation:** Each `videoId` was checked against `https://www.youtube.com/oembed?url=...&format=json` (must return HTTP 200), `playableInEmbed:true` from the watch-page metadata, and **canonical URL must NOT contain `/shorts/`** (YouTube Shorts cannot be embedded as a normal player and trigger Error 153). All 10 entries below passed all three checks.

---

## Quick Reference Table

| #   | Title                                                       | Duration | Channel                    | watchUrl                                    |
| --- | ----------------------------------------------------------- | -------- | -------------------------- | ------------------------------------------- |
| 1   | Shri Krishna Baal Leela – Kaliya Mardan                     | 2:35     | Quixot Kids Hindi          | https://www.youtube.com/watch?v=ezUj91PVjgY |
| 2   | Shri Krishna Baal Leela – Krishna Ko Saja                   | 3:09     | T-Series Bhakti            | https://www.youtube.com/watch?v=rIYWWVIPLkk |
| 3   | Krishna and Govardhan Mountain                              | 1:28     | Quixot Kids Hindi          | https://www.youtube.com/watch?v=oxMEU6MqolQ |
| 4   | Putna Vadh – Little Krishna Animated (Hindi)                | 1:10     | Little Krishna             | https://www.youtube.com/watch?v=5qH71QSUO8c |
| 5   | Pootna Death – How Little Krishna Killed Putna (English)    | 1:06     | Little Krishna             | https://www.youtube.com/watch?v=Aqr24ndKB_Q |
| 6   | Shri Krishna Baal Leela – Putna Rakshas                     | 4:37     | T-Series Bhakti            | https://www.youtube.com/watch?v=HtLFNzlxdwM |
| 7   | Story of Sri Krishna and Sudama – Animated Kids Story       | 3:11     | Geethanjali Kids           | https://www.youtube.com/watch?v=5nZ6XKPJz88 |
| 8   | Lord Krishna Saves Lord Shiva – Mythological Tale for Kids  | 3:42     | Mythological Tale for Kids | https://www.youtube.com/watch?v=kCnPdsH7VOU |
| 9   | Yashoda & Krishna – A Sweet Story of Love and Butter        | 1:20     | KindnessCloud              | https://www.youtube.com/watch?v=UTplR-eDaTo |
| 10  | Shri Krishna Baal Leela – Makhanchor Kanha                  | 4:29     | T-Series Bhakti            | https://www.youtube.com/watch?v=n_bMdkGjzfg |

---

## Structured JSON Output

```json
{
  "topic": "Krishna animated story",
  "language": "Hindi",
  "category": "dharm",
  "maxDuration": 5,
  "results": [
    {
      "title": "Short Animated Story Shri Krishna Baal Leela Hindi I Kaliya Mardan I Shri Krishna Baal Leela",
      "videoId": "ezUj91PVjgY",
      "watchUrl": "https://www.youtube.com/watch?v=ezUj91PVjgY",
      "embedUrl": "https://www.youtube.com/embed/ezUj91PVjgY",
      "duration": "2:35",
      "thumbnail": "https://img.youtube.com/vi/ezUj91PVjgY/hqdefault.jpg",
      "isShort": false,
      "isEmbeddable": true,
      "validated": true
    },
    {
      "title": "Short Animated Story Shri Krishna Baal Leela Hindi I Krishna Ko Saja I Shri Krishna Baal Leela",
      "videoId": "rIYWWVIPLkk",
      "watchUrl": "https://www.youtube.com/watch?v=rIYWWVIPLkk",
      "embedUrl": "https://www.youtube.com/embed/rIYWWVIPLkk",
      "duration": "3:09",
      "thumbnail": "https://img.youtube.com/vi/rIYWWVIPLkk/hqdefault.jpg",
      "isShort": false,
      "isEmbeddable": true,
      "validated": true
    },
    {
      "title": "Krishna And Govardhan Mountain - Krishna In Hindi - Animated / Cartoon Stories for Kids",
      "videoId": "oxMEU6MqolQ",
      "watchUrl": "https://www.youtube.com/watch?v=oxMEU6MqolQ",
      "embedUrl": "https://www.youtube.com/embed/oxMEU6MqolQ",
      "duration": "1:28",
      "thumbnail": "https://img.youtube.com/vi/oxMEU6MqolQ/hqdefault.jpg",
      "isShort": false,
      "isEmbeddable": true,
      "validated": true
    },
    {
      "title": "Putna Vadh (Hindi) | Little krishna animated movie hindi | Putna ka aant | Pootna Death",
      "videoId": "5qH71QSUO8c",
      "watchUrl": "https://www.youtube.com/watch?v=5qH71QSUO8c",
      "embedUrl": "https://www.youtube.com/embed/5qH71QSUO8c",
      "duration": "1:10",
      "thumbnail": "https://img.youtube.com/vi/5qH71QSUO8c/hqdefault.jpg",
      "isShort": false,
      "isEmbeddable": true,
      "validated": true
    },
    {
      "title": "Pootna Death - How little Krishna killed Putna : Lord krishna animated movie English",
      "videoId": "Aqr24ndKB_Q",
      "watchUrl": "https://www.youtube.com/watch?v=Aqr24ndKB_Q",
      "embedUrl": "https://www.youtube.com/embed/Aqr24ndKB_Q",
      "duration": "1:06",
      "thumbnail": "https://img.youtube.com/vi/Aqr24ndKB_Q/hqdefault.jpg",
      "isShort": false,
      "isEmbeddable": true,
      "validated": true
    },
    {
      "title": "Short Animated Story Shri Krishna Baal Leela Hindi I Putna Rakshas I Shri Krishna Baal Leela",
      "videoId": "HtLFNzlxdwM",
      "watchUrl": "https://www.youtube.com/watch?v=HtLFNzlxdwM",
      "embedUrl": "https://www.youtube.com/embed/HtLFNzlxdwM",
      "duration": "4:37",
      "thumbnail": "https://img.youtube.com/vi/HtLFNzlxdwM/hqdefault.jpg",
      "isShort": false,
      "isEmbeddable": true,
      "validated": true
    },
    {
      "title": "Story of Sri Krishna and Sudhama Animated Video | Kids Stories in English",
      "videoId": "5nZ6XKPJz88",
      "watchUrl": "https://www.youtube.com/watch?v=5nZ6XKPJz88",
      "embedUrl": "https://www.youtube.com/embed/5nZ6XKPJz88",
      "duration": "3:11",
      "thumbnail": "https://img.youtube.com/vi/5nZ6XKPJz88/hqdefault.jpg",
      "isShort": false,
      "isEmbeddable": true,
      "validated": true
    },
    {
      "title": "Divine Rescue: Lord Krishna Saves Lord Shiva | Mythological Tale for Kids",
      "videoId": "kCnPdsH7VOU",
      "watchUrl": "https://www.youtube.com/watch?v=kCnPdsH7VOU",
      "embedUrl": "https://www.youtube.com/embed/kCnPdsH7VOU",
      "duration": "3:42",
      "thumbnail": "https://img.youtube.com/vi/kCnPdsH7VOU/hqdefault.jpg",
      "isShort": false,
      "isEmbeddable": true,
      "validated": true
    },
    {
      "title": "Yashoda & Krishna – A Sweet Story of Love and Butter",
      "videoId": "UTplR-eDaTo",
      "watchUrl": "https://www.youtube.com/watch?v=UTplR-eDaTo",
      "embedUrl": "https://www.youtube.com/embed/UTplR-eDaTo",
      "duration": "1:20",
      "thumbnail": "https://img.youtube.com/vi/UTplR-eDaTo/hqdefault.jpg",
      "isShort": false,
      "isEmbeddable": true,
      "validated": true
    },
    {
      "title": "Short Animated Story Shri Krishna Baal Leela Hindi I Makhanchor Kanha I Shri Krishna Baal Leela",
      "videoId": "n_bMdkGjzfg",
      "watchUrl": "https://www.youtube.com/watch?v=n_bMdkGjzfg",
      "embedUrl": "https://www.youtube.com/embed/n_bMdkGjzfg",
      "duration": "4:29",
      "thumbnail": "https://img.youtube.com/vi/n_bMdkGjzfg/hqdefault.jpg",
      "isShort": false,
      "isEmbeddable": true,
      "validated": true
    }
  ]
}
```

---

## Validation Method (reproducible)

For each `videoId` the following three checks were run; **all three must pass**:

```bash
# 1) oEmbed metadata check (must return HTTP 200)
curl -s -o /dev/null -w "%{http_code}" \
  "https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=$VID&format=json"

# 2) playableInEmbed must be true (taken from watch-page initial player response)
curl -sL -A "Mozilla/5.0" "https://www.youtube.com/watch?v=$VID" \
  | grep -oE '"playableInEmbed":(true|false)' | head -1

# 3) canonicalUrl must NOT contain "/shorts/" — Shorts trigger iframe Error 153
curl -sL -A "Mozilla/5.0" "https://www.youtube.com/watch?v=$VID" \
  | grep -oE '"canonicalUrl":"[^"]*"' | head -1
```

All 10 entries returned HTTP 200 from oEmbed, `playableInEmbed:true`, and a `/watch?v=…` canonical URL (i.e. **not** a Short) at curation time (May 2026). Periodic re-validation is recommended since channel owners can disable embedding at any time.
