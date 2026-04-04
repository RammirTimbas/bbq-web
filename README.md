# LAN Media Queue

Collaborative LAN music/video queue built with Express, Socket.IO, Multer, React, and the YouTube Data API.

## Features

- Join instantly with a nickname
- Shared queue for local uploads and YouTube videos
- Host-only playback view for local files and YouTube items
- Real-time queue sync and skip voting
- Upload limits, spam limits, and duplicate vote protection
- Local IP and QR code display for easy LAN access

## Setup

1. Install dependencies:

```bash
npm install
```

2. Create `.env` from `.env.example` and set `YOUTUBE_API_KEY` for YouTube search.

3. Start development:

```bash
npm run dev
```

4. Open `http://localhost:5173/` and choose whether to host a room or join one.

If the QR code points to the wrong LAN address on a machine with multiple adapters, set `PUBLIC_HOST_URL` or `LOCAL_IP_OVERRIDE` in `.env`.

For a single-server deployment:

```bash
npm run build
npm start
```

Then open `http://<host-local-ip>:3001/` on devices in the same LAN.

## Notes

- Local playback works offline once the app is loaded.
- YouTube search and metadata require internet access and a valid API key.
- YouTube quota protection is enabled with server-side caching, minimum search length, and per-client rate limits configurable via `.env`.
- Uploaded files are stored in `uploads/` temporarily and are deleted after playback/removal by default.
