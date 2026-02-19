import { defineSchema, defineTable } from "convex/server";

import { componentCodeFields, componentMetadataFields, componentSearchFields } from "./validators";

export default defineSchema({
  components: defineTable({
    ...componentMetadataFields,
  })
    .index("by_component_id", ["id"])
    .index("by_legacy_component_id", ["legacyId"])
    .index("by_framework", ["framework"])
    .index("by_styling", ["styling"])
    .index("by_motion_level", ["motionLevel"])
    .index("by_primitive_library", ["primitiveLibrary"])
    .index("by_animation_library", ["animationLibrary"]),
  componentCode: defineTable(componentCodeFields).index("by_component_id", ["componentId"]),
  componentSearch: defineTable(componentSearchFields)
    .index("by_component_id", ["componentId"])
    .index("by_framework", ["framework"])
    .index("by_styling", ["styling"])
    .index("by_motion_level", ["motionLevel"])
    .index("by_primitive_library", ["primitiveLibrary"])
    .index("by_animation_library", ["animationLibrary"]),
});
