"use node";

import { WorkOS } from "@workos-inc/node";
import { v } from "convex/values";
import { internalAction } from "../_generated/server";
import { assertWorkosClientIdConfigured, getWorkosApiKey } from "../env";

export interface WorkosUserData {
  email: string;
  firstName?: string;
  lastName?: string;
  profilePictureUrl?: string;
}

export type WorkosUserFetchResult =
  | { kind: "user"; userData: WorkosUserData }
  | { kind: "not_found" };

function getWorkOS(): WorkOS {
  assertWorkosClientIdConfigured();
  return new WorkOS(getWorkosApiKey());
}

export const fetchWorkosUser = internalAction({
  args: { authId: v.string() },
  handler: async (_ctx, args): Promise<WorkosUserFetchResult> => {
    const workos = getWorkOS();

    try {
      const workosUser = await workos.userManagement.getUser(args.authId);
      return {
        kind: "user",
        userData: {
          email: workosUser.email,
          firstName: workosUser.firstName ?? undefined,
          lastName: workosUser.lastName ?? undefined,
          profilePictureUrl: workosUser.profilePictureUrl ?? undefined,
        },
      };
    } catch (error) {
      const workosError = error as { status?: number; message?: string };
      if (workosError.status === 404 || workosError.message?.toLowerCase().includes("not found")) {
        return { kind: "not_found" };
      }
      throw error;
    }
  },
});
