import { serve } from "bun";
import index from "../client/index.html";
import { createJob, getJob, downloadFile, downloadAll, deleteJob } from "./routes/jobs";
import { receiveChunk } from "./routes/upload";
import { termsPage } from "./routes/terms";
import { startCleanup } from "./services/cleanup";
import { logger } from "./services/logger";

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

  development: process.env.NODE_ENV !== "production" && {
    hmr: true,
    console: true,
  },
});

logger.info(`server started`, { url: server.url.toString(), env: process.env.NODE_ENV ?? "development" });
