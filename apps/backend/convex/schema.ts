import { defineSchema, defineTable } from "convex/server";

import {
  componentCodeFields,
  componentFileFields,
  componentMetadataFields,
  componentSearchFields,
} from "./validators";

export default defineSchema({
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
