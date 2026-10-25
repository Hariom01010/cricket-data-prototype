# Cricket Prediction Prototype

Architecture demo and prototype mapping real cricket fixture data from [CricketData.org](https://cricketdata.org/) directly into the [OpenAPI Prediction Specification](file:///d:/web-dev-projects/cricketdata/predictions-api-endpoints.yaml).

## How Environment Variables Are Handled (No Key Leaks)

GitHub Pages is **purely a static file host** (HTML/JS/CSS). Any environment variable or secret included in client-side code on GitHub Pages is readable by anyone who opens DevTools.

To keep your free CricketData API key 100% private and protected from quota abuse:
1. **The key is read on the backend only** via `process.env.CRICKETDATA_API_KEY` (in [server.js](file:///d:/web-dev-projects/cricketdata/server.js)).
2. [server.js](file:///d:/web-dev-projects/cricketdata/server.js) acts as a reverse proxy, fetching `/matches` and `/match_squad` server-side, stripping any API credentials, and serving only sanitized data to the client frontend.
3. `.env` is listed in [.gitignore](file:///d:/web-dev-projects/cricketdata/.gitignore) so your private key is never pushed to GitHub.

---

## 1. Running Locally with `.env`

1. Create a `.env` file in the root folder (copied from `.env.example`):
   ```env
   CRICKETDATA_API_KEY=your_actual_key_here
   PORT=3000
   ```
2. Start the proxy server:
   ```bash
   node server.js
   ```
3. Open `http://localhost:3000` in your browser.

---

## 2. Hosting Options for Team Sharing

### Option A: Free Cloud Backend (Recommended: Render / Railway / Vercel Serverless)
Because you need `.env` variables to stay hidden from team members / public visitors:
1. Push this repository to a private or public GitHub repo.
2. Link it to **[Render.com](https://render.com/)** or **Railway** (free Web Service, Node.js environment, `node server.js`).
3. In the Render / Railway Dashboard, set the Environment Variable:
   - `CRICKETDATA_API_KEY = <your-api-key>`
4. Share the generated public URL (`https://your-app.onrender.com`) with your team. Your API key remains hidden on the server.

### Option B: GitHub Pages with Static Proxy / Mocking
If your team **must** use GitHub Pages:
- Static GitHub Pages cannot run Node.js or hold secret server environment variables.
- You can either:
  1. Point the frontend `fetch` to your free Render/Cloudflare Worker proxy that holds the secret `CRICKETDATA_API_KEY`.
  2. Or keep the prototype running on a cloud instance like Render / Vercel.
