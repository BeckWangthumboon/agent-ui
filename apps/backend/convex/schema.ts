import { defineSchema, defineTable } from "convex/server";

import { componentDocumentFields } from "./validators";

export default defineSchema({
  components: defineTable(componentDocumentFields).index("by_component_id", ["id"]),
});
