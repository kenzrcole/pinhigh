# Testing the app (Desktop, Tablet, Mobile)

## 1. Three viewport targets

The app is built to work across three viewport ranges. Use Tailwind’s breakpoints when you add or change layout:

| Version   | Tailwind breakpoints | Approx. width |
|----------|----------------------|--------------|
| **Mobile**  | default, `sm:` (640px+)  | Phones (portrait/landscape) |
| **Tablet**  | `md:` (768px+), `lg:` (1024px+) | iPad, small laptops |
| **Desktop** | `xl:` (1280px+)       | Laptops, monitors |

- **Mobile-first:** Write base styles for small screens, then use `md:`, `lg:`, `xl:` to adjust for larger ones.
- **Examples:** Hide a sidebar on mobile and show it from `lg:` up; use `grid-cols-1 md:grid-cols-2 xl:grid-cols-3` for responsive grids.

Your `index.html` already has a viewport meta tag, so the layout will scale on real devices.

---

## 2. Testing on your iPhone

### Option A: Dev server over Wi‑Fi (recommended)

1. **Start the dev server so it’s reachable on your network:**
   ```bash
   npm run dev:network
   ```
   This runs Vite with `--host`, so it listens on your machine’s LAN IP, not only `localhost`.

2. **Find your computer’s IP address:**
   - **Mac:** System Settings → Network → Wi‑Fi → Details (or run in Terminal: `ipconfig getifaddr en0`).
   - **Windows:** `ipconfig` and look for “IPv4 Address” under your Wi‑Fi adapter.

3. **On your iPhone:**
   - Connect to the **same Wi‑Fi** as your computer.
   - Open **Safari** and go to: `http://<YOUR_IP>:5173`  
     Example: if your IP is `192.168.1.5`, use `http://192.168.1.5:5173`.

4. **If it doesn’t load:**
   - Confirm the dev server is running and shows a line like `Local: http://192.168.1.x:5173/`.
   - Check that your Mac firewall allows incoming connections on that port (or temporarily disable it to test).
   - Make sure you’re using `http` (not `https`) unless you’ve set up HTTPS.

### Option B: Build and preview

```bash
npm run build
npm run preview -- --host
```

Then on your iPhone, open `http://<YOUR_IP>:4173` (Vite preview usually uses port 4173). Use this to test the production build on the phone.

### Option C: Capacitor (native iOS app)

The project includes Capacitor. To run the app as a native iOS app in the simulator or on a device:

```bash
npm run build
npx cap sync ios
npx cap open ios
```

Then run from Xcode on a simulator or a connected iPhone. This tests the same web app inside a native shell.

---

## 3. Quick device check in the browser

- **Chrome/Edge:** DevTools (F12) → device toolbar (phone/tablet icon) → pick “iPhone 14” or “iPad” to approximate mobile/tablet.
- **Safari:** Develop → Enter Responsive Design Mode (if enabled in Preferences).

Use these for fast layout checks; still test on a real iPhone for touch and performance.

---

## 4. Desktop Chrome vs Cursor / “Failed to reload” or 500 on CourseEditorHoleView

If **desktop Chrome** shows errors that **Cursor** (or another browser) does not, e.g.:

- `GET .../CourseEditorHoleView.tsx net::ERR_ABORTED 500 (Internal Server Error)`
- `[hmr] Failed to reload /src/components/CourseEditorHoleView.tsx. This could be due to syntax errors or importing non-existent modules.`

but the app works in Cursor or after a full reload, try:

1. **Restart the Vite dev server**  
   Stop it (Ctrl+C), then run `npm run dev` again. HMR state can get stuck and a clean server often fixes it.

2. **Hard refresh in Chrome**  
   - Windows/Linux: `Ctrl+Shift+R` or `Ctrl+F5`  
   - Mac: `Cmd+Shift+R`  
   Or: DevTools (F12) → right‑click the refresh button → **Empty cache and hard reload**.

3. **Same URL in both**  
   Use `http://localhost:5173` (or the same host/port) in Chrome and Cursor so they share the same dev server.

4. **If it still fails in Chrome only**  
   Open the same URL in a **Chrome Incognito** window (no extensions, clean cache). If it works there, an extension or cached bundle in the normal profile is likely the cause.
