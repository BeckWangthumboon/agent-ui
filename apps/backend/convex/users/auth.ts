import {
  type Event,
  type UserCreatedEvent,
  type UserDeletedEvent,
  type UserUpdatedEvent,
  WorkOS,
} from "@workos-inc/node";
import { internal } from "../_generated/api";
import { httpAction, type ActionCtx } from "../_generated/server";
import { getWorkosWebhookSecret } from "../env";
import type { WorkosUserData } from "./workos";

type SupportedUserWebhookEvent = UserCreatedEvent | UserUpdatedEvent | UserDeletedEvent;

const WORKOS_SIGNATURE_HEADER = "workos-signature";

function getWorkOS(): WorkOS {
  return new WorkOS();
}

function json(data: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isSupportedUserWebhookEvent(event: Event): event is SupportedUserWebhookEvent {
  return (
    event.event === "user.created" ||
    event.event === "user.updated" ||
    event.event === "user.deleted"
  );
}

function toWorkosUserData(event: UserCreatedEvent | UserUpdatedEvent): WorkosUserData {
  return {
    email: event.data.email,
    firstName: event.data.firstName ?? undefined,
    lastName: event.data.lastName ?? undefined,
    profilePictureUrl: event.data.profilePictureUrl ?? undefined,
  };
}

async function handleUserWebhookEvent(
  ctx: ActionCtx,
  event: SupportedUserWebhookEvent,
) {
  switch (event.event) {
    case "user.created":
    case "user.updated":
      await ctx.runMutation(internal.users.index.upsertUserFromWorkosInternal, {
        authId: event.data.id,
        userData: toWorkosUserData(event),
      });
      return;
    case "user.deleted":
      await ctx.runMutation(internal.users.index.deleteUserByAuthIdInternal, {
        authId: event.data.id,
      });
      return;
  }
}

/**
 * Receives WorkOS user lifecycle webhooks at `/auth/workos/webhook`.
 * Signature verification happens before any Convex mutation is invoked.
 */
export const workosUserWebhook = httpAction(async (ctx, request) => {
  const signatureHeader = request.headers.get(WORKOS_SIGNATURE_HEADER);
  if (!signatureHeader) {
    return json({ error: "Missing WorkOS signature header." }, 400);
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return json({ error: "Invalid JSON payload." }, 400);
  }

  if (!isRecord(payload)) {
    return json({ error: "Webhook payload must be a JSON object." }, 400);
  }

  let event: Event;
  try {
    event = await getWorkOS().webhooks.constructEvent({
      payload,
      sigHeader: signatureHeader,
      secret: getWorkosWebhookSecret(),
    });
  } catch {
    return json({ error: "Invalid WorkOS webhook signature." }, 401);
  }

  if (!isSupportedUserWebhookEvent(event)) {
    return json({ ok: true, ignored: true });
  }

  await handleUserWebhookEvent(ctx, event);
  return json({ ok: true });
});
