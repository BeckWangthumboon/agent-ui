import { v } from "convex/values";
import { internal } from "../_generated/api";
import type { Doc } from "../_generated/dataModel";
import { action, internalMutation, internalQuery, query } from "../_generated/server";
import type { WorkosUserFetchResult } from "./workos";

type User = Doc<"users">;

type UserUpsertData = {
  email: string;
  firstName?: string;
  lastName?: string;
  profilePictureUrl?: string;
};

function getChangedUserFields(existing: User, next: UserUpsertData) {
  const changed: Partial<UserUpsertData> = {};
  if (existing.email !== next.email) {
    changed.email = next.email;
  }
  if ((existing.firstName ?? undefined) !== (next.firstName ?? undefined)) {
    changed.firstName = next.firstName;
  }
  if ((existing.lastName ?? undefined) !== (next.lastName ?? undefined)) {
    changed.lastName = next.lastName;
  }
  if ((existing.profilePictureUrl ?? undefined) !== (next.profilePictureUrl ?? undefined)) {
    changed.profilePictureUrl = next.profilePictureUrl;
  }
  return changed;
}

export const getAccountOrNull = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return null;
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_authId", (q) => q.eq("authId", identity.subject))
      .unique();

    return user ?? null;
  },
});

export const ensureAccount = action({
  args: {},
  handler: async (ctx): Promise<User> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated.");
    }

    const authId = identity.subject;
    const existingUser: User | null = await ctx.runQuery(internal.users.index.getUserByAuthIdInternal, {
      authId,
    });
    const workosResult: WorkosUserFetchResult = await ctx.runAction(
      internal.users.workos.fetchWorkosUser,
      { authId },
    );

    if (workosResult.kind === "not_found") {
      if (existingUser) {
        return existingUser;
      }
      throw new Error("Could not find authenticated WorkOS user.");
    }

    return ctx.runMutation(internal.users.index.upsertUserFromWorkosInternal, {
      authId,
      userData: workosResult.userData,
    });
  },
});

export const getUserByAuthIdInternal = internalQuery({
  args: { authId: v.string() },
  handler: async (ctx, args) => {
    return ctx.db
      .query("users")
      .withIndex("by_authId", (q) => q.eq("authId", args.authId))
      .unique();
  },
});

export const upsertUserFromWorkosInternal = internalMutation({
  args: {
    authId: v.string(),
    userData: v.object({
      email: v.string(),
      firstName: v.optional(v.string()),
      lastName: v.optional(v.string()),
      profilePictureUrl: v.optional(v.string()),
    }),
  },
  handler: async (ctx, args) => {
    const existingUser = await ctx.db
      .query("users")
      .withIndex("by_authId", (q) => q.eq("authId", args.authId))
      .unique();

    if (!existingUser) {
      const userId = await ctx.db.insert("users", {
        authId: args.authId,
        email: args.userData.email,
        firstName: args.userData.firstName ?? undefined,
        lastName: args.userData.lastName ?? undefined,
        profilePictureUrl: args.userData.profilePictureUrl ?? undefined,
        updatedAt: Date.now(),
      });
      const insertedUser = await ctx.db.get(userId);
      if (!insertedUser) {
        throw new Error("Failed to load inserted user.");
      }
      return insertedUser;
    }

    const changedFields = getChangedUserFields(existingUser, args.userData);
    if (Object.keys(changedFields).length === 0) {
      return existingUser;
    }

    await ctx.db.patch(existingUser._id, {
      ...changedFields,
      updatedAt: Date.now(),
    });

    return {
      ...existingUser,
      ...changedFields,
      updatedAt: Date.now(),
    };
  },
});

export const deleteUserByAuthIdInternal = internalMutation({
  args: { authId: v.string() },
  handler: async (ctx, args) => {
    const existingUser = await ctx.db
      .query("users")
      .withIndex("by_authId", (q) => q.eq("authId", args.authId))
      .unique();

    if (!existingUser) {
      return null;
    }

    await ctx.db.delete(existingUser._id);
    return null;
  },
});
