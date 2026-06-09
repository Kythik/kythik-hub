# Kythik Strategy Hub — Public API

Base URL: `https://kythik.com`

Access is key-protected. To request an API key contact Kythik on Discord: [discord.gg/qDRWUM83zY](https://discord.gg/qDRWUM83zY)

---

## Authentication

Pass your API key using either method:

**Query parameter:**
```
GET /api/strategies?key=YOUR_API_KEY
```

**Authorization header:**
```
GET /api/strategies
Authorization: Bearer YOUR_API_KEY
```

Requests without a valid key return:
```json
{
  "error": "Unauthorized. Contact kythik.com to request API access."
}
```

---

## Endpoints

### GET /api/strategies

Returns all farm strategies for the current Torchlight Infinite season.

**Request**
```
GET https://kythik.com/api/strategies?key=YOUR_API_KEY
```

**Response**
```json
{
  "source": "kythik.com",
  "season": "SS12: Lunaria",
  "seasonStart": "2026-04-16T19:00:00-07:00",
  "lastUpdated": "2026-06-08T20:30:00.000Z",
  "count": 27,
  "strategies": [
    {
      "title": "S12 Gold Bus and lvl 8 Merc Farm 2.5–4.5k/hr",
      "author": "heff_1",
      "channel": "Farms",
      "tags": "Deep Space",
      "body": "Farm to make good money while getting all your level 8 oasis workers up and running...",
      "imageURLs": "https://cdn.discordapp.com/...",
      "discordURL": "https://discord.com/channels/...",
      "comments": 34,
      "postedAt": "2026-04-28T22:15:00.000Z",
      "featured": false
    }
  ]
}
```

**Response fields**

| Field | Type | Description |
|---|---|---|
| `source` | string | Always `"kythik.com"` |
| `season` | string | Current season name |
| `seasonStart` | string | ISO 8601 season start date |
| `lastUpdated` | string | ISO 8601 timestamp of last Airtable sync |
| `count` | number | Total strategies returned |
| `strategies` | array | List of strategy objects |

**Strategy object fields**

| Field | Type | Description |
|---|---|---|
| `title` | string | Strategy title |
| `author` | string | Discord username of the poster |
| `channel` | string | `"Farms"` or `"Builds"` |
| `tags` | string | Comma-separated tags e.g. `"Deep Space, Profound"` |
| `body` | string | Full strategy description |
| `imageURLs` | string | Comma-separated Discord CDN image URLs |
| `discordURL` | string | Direct link to the Discord thread |
| `comments` | number | Comment count on the Discord thread |
| `postedAt` | string | ISO 8601 date the strategy was posted |
| `featured` | boolean | Whether manually featured by Kythik |

---

## Notes

- **Cache:** Responses are cached for 6 hours. `lastUpdated` reflects the last Airtable sync.
- **Season filtering:** Only strategies from the current season are returned. Previous seasons are archived.
- **Image URLs:** Discord CDN URLs expire periodically. The cache is refreshed every 6 hours with fresh tokens.
- **Rate limiting:** Please cache responses on your end. Excessive requests may result in key revocation.

---

## Error codes

| Status | Meaning |
|---|---|
| `200` | Success |
| `401` | Missing or invalid API key |
| `500` | Server error — try again shortly |

---

## Example — JavaScript fetch

```javascript
const res = await fetch('https://kythik.com/api/strategies?key=YOUR_API_KEY');
const data = await res.json();

data.strategies.forEach(s => {
  console.log(s.title, '—', s.author, '—', s.tags);
});
```

## Example — Python requests

```python
import requests

res = requests.get(
    'https://kythik.com/api/strategies',
    headers={'Authorization': 'Bearer YOUR_API_KEY'}
)
data = res.json()

for s in data['strategies']:
    print(s['title'], '—', s['author'])
```
