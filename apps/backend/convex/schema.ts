import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

import {
  componentCodeFields,
  componentFileFields,
  componentMetadataFields,
  componentSearchFields,
} from "./validators";

const userFields = {
  authId: v.string(),
  email: v.string(),
  firstName: v.optional(v.string()),
  lastName: v.optional(v.string()),
  profilePictureUrl: v.optional(v.string()),
  updatedAt: v.number(),
};

export default defineSchema({
  users: defineTable(userFields).index("by_authId", ["authId"]).index("by_email", ["email"]),
  components: defineTable(componentMetadataFields)
    .index("by_component_id", ["id"])
    .index("by_framework", ["framework"])
    .index("by_styling", ["styling"])
    .index("by_motion_level", ["motionLevel"])
    .index("by_primitive_library", ["primitiveLibrary"])
    .index("by_animation_library", ["animationLibrary"])
    .index("by_primitive_motion", ["primitiveLibrary", "motionLevel"])
    .index("by_animation_motion", ["animationLibrary", "motionLevel"]),
  componentCode: defineTable(componentCodeFields).index("by_component_id", ["componentId"]),
  componentFiles: defineTable(componentFileFields)
    .index("by_component_id", ["componentId"])
    .index("by_component_kind", ["componentId", "kind"])
    .index("by_component_path", ["componentId", "path"]),
  componentSearch: defineTable(componentSearchFields).index("by_component_id", ["componentId"]),
});
