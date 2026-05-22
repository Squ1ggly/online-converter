# Online Converter

A free, unauthenticated file conversion tool for images and video. Upload files, pick an output format, and download the results. Files are automatically deleted within 30 minutes.

## Features

- **Image conversion** — AVIF, BMP, GIF, HEIC, JPEG, PDF, PNG, SVG, TIFF, WebP (via ImageMagick)
- **Video conversion** — AVI, FLV, GIF, M4V, MKV, MOV, MP4, WebM (via FFmpeg)
- Batch uploads with per-file progress
- Download individual files or all as a ZIP
- Advanced options: quality, resize, bitrate, resolution, FPS
- Session-isolated jobs via signed cookies (users can't see each other's files)
- Automatic cleanup — no permanent storage

## Requirements

- [Bun](https://bun.sh) v1.3+
- [ImageMagick](https://imagemagick.org) (`magick` in `PATH`)
- [FFmpeg](https://ffmpeg.org) (`ffmpeg` in `PATH`)

## Setup

```bash
bun install
```

## Development

```bash
bun dev
```

Starts the server with hot reload at `http://localhost:3000`.

## Production

```bash
bun start
```

Set the `SESSION_SECRET` environment variable to a stable random value so sessions survive restarts:

```bash
SESSION_SECRET=$(openssl rand -hex 32) bun start
```

Without it, a random secret is generated at startup and all sessions are invalidated on restart.

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `SESSION_SECRET` | random | HMAC secret for signing session cookies. Set a stable value in production. |
| `PORT` | `3000` | Port to listen on. |
| `NODE_ENV` | — | Set to `production` to enable the `Secure` cookie flag (requires HTTPS). |

## Stack

- **Runtime**: [Bun](https://bun.sh)
- **Frontend**: React 19, Radix UI primitives, plain CSS via Bun's CSS bundler
- **Backend**: Bun `serve()`, ImageMagick, FFmpeg
- **ZIP**: [fflate](https://github.com/101arrowz/fflate)

## Privacy

Files are not encrypted at rest or in transit. Do not upload sensitive or confidential data. See [/terms](/terms) for full details.

## License

MIT — see [LICENSE](LICENSE).
