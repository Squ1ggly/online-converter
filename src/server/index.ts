import { serve } from "bun";
import type { ServerWebSocket } from "bun";
import index from "../client/index.html";
import { createJob, getJob, downloadFile, downloadAll, deleteJob } from "./routes/jobs";
import { receiveChunk } from "./routes/upload";
import { termsPage } from "./routes/terms";
import { startCleanup } from "./services/cleanup";
import { parseSession } from "./services/session";
import { store } from "./services/store";
import { registerServer } from "./services/pubsub";
import { logger } from "./services/logger";

type WSData = { jobId: string };

startCleanup();

const server = serve({
  routes: {
    "/*": index,

    "/terms": { GET: termsPage },

    "/api/upload": {
      POST: receiveChunk,
    },

    "/api/jobs": {
      POST: createJob,
    },

    "/api/jobs/:id": {
      async GET(req) {
        const { id = "" } = (req as Request & { params: Record<string, string | undefined> }).params;
        return getJob(id, req);
      },
      async DELETE(req) {
        const { id = "" } = (req as Request & { params: Record<string, string | undefined> }).params;
        return deleteJob(id, req);
      },
    },

    "/api/jobs/:id/download": {
      async GET(req) {
        const { id = "" } = (req as Request & { params: Record<string, string | undefined> }).params;
        return downloadAll(id, req);
      },
    },

    "/api/jobs/:id/files/:fileId": {
      async GET(req) {
        const { id = "", fileId = "" } = (req as Request & { params: Record<string, string | undefined> }).params;
        return downloadFile(id, fileId, req);
      },
    },
  },

  // Handles WebSocket upgrades for job progress — routes don't support WS upgrades directly
  fetch(req, srv) {
    const url = new URL(req.url);
    const match = url.pathname.match(/^\/api\/jobs\/([^/]+)\/ws$/);
    if (!match) return new Response("Not found", { status: 404 });

    const jobId = match[1] ?? "";
    const sessionId = parseSession(req);
    const job = store.get(jobId);

    if (!job || job.sessionId !== sessionId) {
      return new Response(null, { status: 404 });
    }

    const ok = srv.upgrade(req, { data: { jobId } });
    if (!ok) return new Response("WebSocket upgrade failed", { status: 500 });
    // undefined return tells Bun the upgrade was handled
  },

  websocket: {
    open(ws: ServerWebSocket<WSData>) {
      ws.subscribe(`job:${ws.data.jobId}`);
      // Send current state immediately so client is in sync from the start
      const job = store.get(ws.data.jobId);
      if (job) ws.send(JSON.stringify(job));
      logger.info("ws open", { jobId: ws.data.jobId });
    },
    message() {},
    close(ws: ServerWebSocket<WSData>) {
      ws.unsubscribe(`job:${ws.data.jobId}`);
      logger.info("ws close", { jobId: ws.data.jobId });
    },
  },

  development: process.env.NODE_ENV !== "production" && {
    hmr: true,
    console: true,
  },
});

registerServer(server);
logger.info("server started", { url: server.url.toString(), env: process.env.NODE_ENV ?? "development" });
