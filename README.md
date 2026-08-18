# ट्रक वाला रेडियो — Build & Launch Guide (Free)

You will not write any real code. You'll fill in **2 things** and click through
some free signup screens. Total cost: **₹0**, unless you later want a custom
domain name (~₹800/year, optional).

There are two files you touch:
1. `backend/playlist.js` — your songs
2. `frontend/app.js` — one line, the backend's web address

---

## Step 1 — Connect your playlist (free API key, one-time setup)

Ab tumhe gaane ek-ek karke paste nahi karne — bas ek playlist link connect karo.
Jo bhi gaana us playlist mein future mein add/remove karoge, site khud-ba-khud
pick kar legi (har 10 minute mein refresh hoti hai).

### A) Playlist ID nikalna
1. Apni YouTube/YT Music playlist ko YouTube.com pe (browser mein) kholo — share/URL
   kuch aisa dikhega: `youtube.com/playlist?list=XXXXXXXXXXXXXXXXX`
2. `list=` ke baad wala part copy karo — yahi tumhara **Playlist ID** hai
3. Playlist **Public ya Unlisted** honi chahiye (Private se kaam nahi karega)

### B) Free API key lena (Google deta hai, credit card nahi lagta)
1. **[console.cloud.google.com](https://console.cloud.google.com)** pe jaao, Google account se login karo
2. Upar left mein "Select a project" → **New Project** → koi bhi naam do (jaise `truckwala-radio`) → Create
3. Left menu se **APIs & Services → Library** kholo
4. Search karo **"YouTube Data API v3"** → click karo → **Enable** dabao
5. Left menu se **APIs & Services → Credentials** kholo
6. **Create Credentials → API key** pe click karo
7. Ek key generate hogi jaisi: `AIzaSyD-XXXXXXXXXXXXXXXXXXXXXXXXXXXXXX` — **copy kar lo**

*(Free tier: roughly 10,000 requests/day — apne is chhote project ke liye kaafi zyada hai, kabhi bill nahi aayega jab tak tum khud paid plan on na karo.)*

### C) Dono values file mein daalna
Open `backend/playlist.js`, aur ye 2 lines edit karo:
```js
const YOUTUBE_API_KEY = "PASTE_YOUR_API_KEY_HERE";       // ← apni API key yahan
const PLAYLIST_ID = "PASTE_YOUR_PLAYLIST_ID_HERE";        // ← apna playlist ID yahan
```

Bas — ab jab bhi playlist mein gaana add/hatao, site khud update ho jayegi.

---

## Step 2 — Put the backend online (free)

The "backend" is the small program that keeps everyone in sync. It needs to run
somewhere 24/7, which is why it can't just live on your phone.

1. Go to **[render.com](https://render.com)** → sign up free (use your GitHub or Google account)
2. Go to **[github.com](https://github.com)** → sign up free if you don't have an account
3. On GitHub, create a new repository (button "New") → name it e.g. `truckwala-radio` → upload the `backend` folder's files into it
4. Back on Render: click **New → Web Service** → connect your GitHub repo
5. Render will ask a few settings:
   - **Build command:** `npm install`
   - **Start command:** `npm start`
   - **Instance type:** Free
6. Click **Deploy**. Wait ~2 minutes. Render gives you a URL like:
   `https://truckwala-radio.onrender.com`
   **Copy this URL** — you need it in Step 3.

> Free-tier note: Render's free web services "sleep" after 15 minutes with no
> visitors, and take ~30 seconds to wake up on the next visit. Totally fine for
> a personal/shared project; if you later get heavy traffic you can upgrade.

---

## Step 3 — Fill in the backend URL on the frontend

Open `frontend/app.js`. Right at the top, find this line:

```js
const BACKEND_URL = "https://PASTE-YOUR-BACKEND-URL-HERE.onrender.com";
```

Replace the text inside the quotes with the URL you copied from Render in Step 2.
That's the second and last thing you edit.

---

## Step 4 — Put the frontend (the actual website) online (free)

1. Go to **[vercel.com](https://vercel.com)** → sign up free with GitHub
2. Create another GitHub repo (e.g. `truckwala-radio-site`) and upload the
   `frontend` folder's files (`index.html`, `style.css`, `app.js`)
3. On Vercel: **New Project** → import that repo → leave all settings default → **Deploy**
4. Vercel gives you a free live link like `https://truckwala-radio-site.vercel.app`

**That link is your public website.** Anyone can open it, and everyone who
does will hear the same song at the same moment, with a live count of how
many people are on the page.

---

## Step 5 (optional) — Your own domain name

Free links (`.vercel.app`, `.onrender.com`) work perfectly and cost nothing.
If you'd rather have something like `truckwalaradio.com`:
1. Buy the domain from Namecheap or GoDaddy (~₹700–900/year — this is the
   only part of the whole project that isn't free)
2. In Vercel: Project → Settings → Domains → add your domain → follow the
   on-screen DNS instructions

---

## Quick troubleshooting

| Problem | Likely cause |
|---|---|
| Site loads but nothing plays | Check `app.js` has your real Render URL, not the placeholder |
| Counter always shows 0 or "–" | Backend might still be waking up (free tier) — refresh after 30 sec |
| Song doesn't start | You must tap the "Tap to join" button once — browsers block autoplay with sound |
| Everyone hears different songs | Playlist not filled in — check `playlist.js` has real video IDs, not placeholders |
