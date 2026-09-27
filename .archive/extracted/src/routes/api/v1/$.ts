import { createFileRoute } from "@tanstack/react-router";
import { apiErrorResponse } from "@/server/puga/http";
import { handlePugaApi } from "@/server/puga/router";

async function handle({ request }: { request: Request }) {
  try {
    return await handlePugaApi(request);
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export const Route = createFileRoute("/api/v1/$")({
  server: {
    handlers: {
      GET: handle,
      POST: handle,
      PATCH: handle,
      PUT: handle,
      DELETE: handle,
    },
  },
});
