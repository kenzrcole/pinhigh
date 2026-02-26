# Custom API for Fleet & Cart Integrations (e.g. Pace Technology)

This document outlines how to expose the PinHigh game engine as a **custom API** so partners like [Pace Technology](https://pace.txtsv.com/golf-carts) (E-Z-GO, Cushman, Jacobsen cart screens, Shield II, ONYX) can offer **AI playing alongside the user**—optionally in the golf cart—while using their own maps and fleet capabilities.

---

## 1. Goal

- **Your engine**: AI opponent, shot simulation, scoring, course features (tees, greens, hazards, fairways).
- **Their stack**: Course maps on cart/tablet (10" / ONYX), fleet tracking, food & beverage, tee sheet, geofencing.
- **Ideal**: Use **their maps** on the cart for GPS/navigation, and **your API** to run the AI round (shot-by-shot, scorecard) so the golfer sees “AI playing alongside” on the same screen or a companion panel.

---

## 2. High-Level Integration Options

| Option | Maps | AI & round state | Where it runs |
|--------|------|-------------------|---------------|
| **A. Headless API** | Partner (Pace) | Your API | Your cloud; cart/tablet calls your API, renders on their UI. |
| **B. Embeddable SDK / iframe** | Partner | Your engine in iframe or WebView | Cart loads your bundle; their map + your AI widget. |
| **C. WebSocket companion** | Partner | Your API over WebSocket | Real-time AI shots and scores pushed to cart; their map shows position, your service drives AI. |

For “use their maps but have AI play alongside in the cart,” **Option A (headless API)** or **C (WebSocket)** fit best: Pace keeps map and cart UX; your backend runs the simulation and returns AI shots, scores, and state.

---

## 3. Suggested API Surface (REST + optional WebSocket)

### 3.1 Authentication & context

- Partner (e.g. Pace) gets an **API key** or **OAuth2 client** for your gateway.
- Each “round” is keyed by a **round ID** (you generate or they pass) and optionally **course ID** (so you can support multiple courses later).

### 3.2 Core endpoints

| Method | Path | Purpose |
|--------|------|--------|
| `POST` | `/v1/rounds` | Start a round: course, tee, AI profile (handicap or “EW 2K”). Returns `roundId`. |
| `GET`  | `/v1/rounds/:roundId` | Get round state: current hole, player score, AI score, hole-by-hole. |
| `POST` | `/v1/rounds/:roundId/holes/:holeNumber/ai-play` | Run AI for the hole; returns shot-by-shot (from tee to hole-out). |
| `POST` | `/v1/rounds/:roundId/holes/:holeNumber/player-score` | Record player score for the hole (so AI and player stay in sync). |
| `GET`  | `/v1/courses/:courseId` | Course metadata (holes, par, yardage) and, if needed, feature references (tee/green per hole). |
| `GET`  | `/v1/courses/:courseId/holes/:holeNumber` | Tee/green/fairway/hazards for one hole (so partner can draw your features on their map if desired). |

### 3.3 Example: start round and get AI play for hole 1

**Request**

```http
POST /v1/rounds
Authorization: Bearer <partner_api_key>
Content-Type: application/json

{
  "courseId": "lincoln-park",
  "aiProfile": "EW 2K",
  "options": { "proMode": true }
}
```

**Response**

```json
{
  "roundId": "r_abc123",
  "courseId": "lincoln-park",
  "aiProfile": "EW 2K",
  "currentHole": 1,
  "playerScoresByHole": [],
  "aiScoresByHole": []
}
```

**Request – play AI for hole 1**

```http
POST /v1/rounds/r_abc123/holes/1/ai-play
```

**Response**

```json
{
  "shots": [
    {
      "shotNumber": 1,
      "fromPosition": { "lat": 37.7823, "lng": -122.4948 },
      "toPosition": { "lat": 37.7841, "lng": -122.4962 },
      "club": "Driver",
      "distanceYards": 245,
      "commentary": { "distanceYards": 245, "club": "Driver", "shotShape": "Fade", ... }
    }
  ],
  "score": 4,
  "aiScoreForHole": 4
}
```

Partner can then:

- Draw the AI shot path on **their** map (using their tiles/satellite).
- Update the scorecard on the cart (their UI, your data).

### 3.4 Optional: WebSocket for “live” AI on cart

- Cart opens a WebSocket to your service (e.g. `wss://api.pinhigh.com/v1/rounds/:roundId/stream`).
- When the group reaches a hole, cart sends “player on hole 5” → your service runs AI for hole 5 and pushes shot-by-shot (or full hole result) over the socket.
- Cart UI (Pace’s 10" or ONYX screen) shows their map + your AI shots/scores in real time.

---

## 4. Using “Their Maps” While You Run AI

- **Maps**: Stay on Pace (or partner). Their cart app already has course maps, GPS, and geofencing. You don’t need to ship map tiles.
- **Your API provides**:
  - **Positions**: Tee, green, and (optionally) fairway/hazard polygons per hole so the partner can overlay your features on their map if they want.
  - **AI shots**: `fromPosition` / `toPosition` (and optional path) so they can draw the AI ball path on their map.
  - **Scores and state**: So their scorecard or “AI opponent” panel stays in sync.
- **Result**: One integrated experience on the cart: “their” map + “your” AI playing alongside, with optional food/beverage, messaging, etc., all on the same device.

---

## 5. “In the Golf Cart” as an Option

- **Pace** already puts 10" screens, Shield II, and ONYX on carts ([Pace Technology – Golf Carts](https://pace.txtsv.com/golf-carts)).
- To offer “AI in the cart”:
  1. **Pace** (or another partner) integrates your API into their cart app (or a “game” tab).
  2. Cart sends: course, hole, and (when the user finishes the hole) player score.
  3. Your API returns AI shots and score; cart renders them on their map and scorecard.
  4. No need to replace their maps—only add a layer or panel for “AI opponent” driven by your engine.

---

## 6. Implementation Outline in This Repo

1. **Extract engine as a callable core**  
   - The existing `engine/` (BenchmarkSystem, DispersionCalculator, BallisticsEngine, AIGolfer, etc.) already runs in Node/browser. Add a thin **server-side entry** (e.g. Node or edge function) that:
     - Accepts `courseId`, `holeNumber`, `aiProfile`, optional `teePosition` (if they provide GPS).
     - Runs `AIGolfer.playHole(...)` (or equivalent) and returns a list of shots + score.

2. **Add REST (and optional WebSocket) gateway**  
   - Use Express, Fastify, or Hono behind a single `POST /v1/rounds/:roundId/holes/:holeNumber/ai-play` (and the other routes above).
   - Store round state in memory, Redis, or DB (roundId, courseId, aiProfile, playerScoresByHole, aiScoresByHole).

3. **Course and feature API**  
   - `GET /v1/courses/:courseId` and `GET /v1/courses/:courseId/holes/:holeNumber` can read from your existing course data (e.g. Lincoln Park, Course Pro overrides) and return GeoJSON or simple lat/lng so partners can overlay on their maps.

4. **Partner auth**  
   - API key or OAuth2 client per partner (e.g. Pace); rate limits and CORS for their cart/tablet domains.

5. **Docs and sandbox**  
   - OpenAPI (Swagger) spec for the REST API; optional sandbox environment so Pace (or others) can test “start round → play hole 1 → get AI shots” without touching production.

---

## 7. Summary

- **Custom API**: REST (and optional WebSocket) that exposes “start round,” “play AI for hole N,” “submit player score,” and “course/hole features.”
- **Their maps**: Partner keeps their map stack; you provide positions and AI shot paths so they can render on their cart screens.
- **AI in the cart**: Implemented by the partner calling your API from their cart app (e.g. Pace’s 10" or ONYX) and showing your AI shots and scores next to their map and UX.
- **Next steps**: (1) Add a small Node/edge service that wraps the existing engine and implements the endpoints above; (2) define the exact request/response schemas and an OpenAPI spec; (3) reach out to Pace (or similar) with a one-page “integration offer” and a sandbox base URL.
