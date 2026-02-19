import { defineSchema, defineTable } from "convex/server";

import { componentDocumentFields } from "./validators";

export default defineSchema({
  components: defineTable(componentDocumentFields)
    .index("by_component_id", ["id"])
    .index("by_framework", ["framework"])
    .index("by_styling", ["styling"])
    .index("by_motion_level", ["motionLevel"]),
});
