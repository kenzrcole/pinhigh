# Testing on Your Phone & Sharing With Friends

## Do I need Wi-Fi? What about courses with no service?

**You do not need Wi-Fi to test on a golf course.**

- **Best approach:** Deploy the app (e.g. Vercel, Netlify) and open the **HTTPS link on your phone**. Use **cellular data** — no Wi-Fi required. As long as you have cell signal, the app loads and GPS works.
- **If the course has no cell service:** A normal "open link in browser" app needs to load from the internet, so with zero signal it won't load. Options:
  - **Native app (Capacitor):** This project includes Capacitor. Building and installing the app on your phone (iOS/Android) puts the app on the device. Once installed, it can run without a connection; **GPS still works without data**. Map imagery may not load in dead zones until you're back in range.
  - **Open the app before you go:** If you have a little signal when you arrive, open the deployed URL once so the browser may cache some of it — but for reliable use with no service, a native build is the better path.

---

## Test on your own phone (same Wi-Fi, optional)

Use this only when you're at home or somewhere with Wi-Fi (e.g. quick local test). **Not for testing on the course.**

1. **Start the app on your network**
   ```bash
   npm run dev:network
   ```

2. **Find your computer's IP**
   - **Mac:** `ipconfig getifaddr en0` or System Settings → Network → Wi-Fi
   - **Windows:** `ipconfig` → IPv4 under your Wi-Fi adapter

3. **On your phone** (same Wi-Fi): open **`http://YOUR_IP:5173`**

**Note:** Over HTTP, some phones block GPS. For real on-course testing with location, use a deployed HTTPS URL (below).

---

## Step-by-step: Test on your phone on the course (with signal)

Use this when you have cell service on the course. No Wi‑Fi needed.

### One-time setup (do this before you go)

1. **Build the app**
   ```bash
   cd /path/to/project
   npm run build
   ```
   This creates a `dist` folder with the production app.

2. **Deploy the `dist` folder**
   - Sign up or log in at **[Vercel](https://vercel.com)**, **[Netlify](https://netlify.com)**, or **[Cloudflare Pages](https://pages.cloudflare.com)**.
   - Create a new project and connect it to your repo, or drag-and-drop the `dist` folder (manual deploy).
   - For Vercel/Netlify: set the **build output directory** to `dist` and the **root directory** to your project root (so `npm run build` runs on deploy). Or do a one-off upload of `dist`.
   - After deploy you get a URL like `https://your-app.vercel.app` (or similar). Save this URL.

3. **Set the Google Maps key (if you use maps)**
   - In the host’s dashboard, open your project → **Settings** → **Environment variables**.
   - Add: `VITE_GOOGLE_MAPS_API_KEY` = your API key.
   - Redeploy once so the new variable is applied.

### On the course (every time)

4. **On your phone:** Turn off Wi‑Fi (or leave it on; cellular will be used for the app).
5. **Open the app:** In your browser (Safari, Chrome, etc.), go to your deployed URL (e.g. `https://your-app.vercel.app`).
6. **Allow location:** When the browser asks for location access, tap **Allow** so GPS and the map work.
7. **Use the app:** Select a course, start a round, and use the map/yardages as normal. Data comes over cellular.

**Tip:** Add the URL to your home screen (e.g. Safari → Share → Add to Home Screen) so it opens like an app.

---

## Share with friends

### Option A: Same Wi-Fi (quick test only)

- Run `npm run dev:network` and share **`http://YOUR_IP:5173`**. Friends must be on the same Wi-Fi. Not for use on a course.

### Option B: Deploy and share link (best; no Wi-Fi needed)

- Deploy as above, then share the **HTTPS** link. Friends open it on their phones on cellular; no Wi-Fi required. Works on the course as long as they have signal.

---

## Quick reference

| Goal                          | What to do |
|-------------------------------|------------|
| Test on course (have signal)  | Deploy app → open HTTPS URL on phone with cellular; no Wi-Fi. |
| Test on course (no signal)    | Use a native build (Capacitor) so the app runs from the device; GPS works without data. |
| Quick test at home            | `npm run dev:network` → open `http://YOUR_IP:5173` on phone (same Wi-Fi). |
| Build for deploy              | `npm run build` → deploy `dist` to Vercel / Netlify / Cloudflare Pages. |
