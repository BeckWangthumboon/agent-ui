import { httpRouter } from "convex/server";

import { workosUserWebhook } from "./users/auth";

const http = httpRouter();

http.route({
  path: "/auth/workos/webhook",
  method: "POST",
  handler: workosUserWebhook,
});

export default http;
