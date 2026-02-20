import type {
  ComponentAnimationLibrary,
  ComponentCodeDocument,
  ComponentDocument,
  ComponentMetadataDocument,
  ComponentPrimitiveLibrary,
  ComponentSearchDocument,
} from "./types";

const ID_HASH_LENGTH = 8;

function dependencyNames(component: Pick<ComponentDocument, "dependencies">): string[] {
  return component.dependencies.map((dependency) => dependency.name.toLowerCase());
}

export function detectPrimitiveLibrary(component: ComponentDocument): ComponentPrimitiveLibrary {
  if (component.primitiveLibrary) {
    return component.primitiveLibrary;
  }

  const names = dependencyNames(component);

  if (names.some((name) => name.startsWith("@radix-ui/"))) {
    return "radix";
  }

  if (names.some((name) => name.startsWith("@base-ui/") || name.includes("base-ui"))) {
    return "base-ui";
  }

  if (
    names.some(
      (name) =>
        name.startsWith("@headlessui/") || name.includes("headlessui") || name.includes("ariakit"),
    )
  ) {
    return "other";
  }

  return "none";
}

export function detectAnimationLibrary(component: ComponentDocument): ComponentAnimationLibrary {
  if (component.animationLibrary) {
    return component.animationLibrary;
  }

  const names = dependencyNames(component);

  if (
    names.some(
      (name) =>
        name === "motion" ||
        name === "motion/react" ||
        name.startsWith("motion/") ||
        name.includes("motion/react"),
    )
  ) {
    return "motion";
  }

  if (names.some((name) => name === "framer-motion" || name.includes("framer-motion"))) {
    return "framer-motion";
  }

  return "none";
}

function toIdSlug(value: string): string {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");

  return slug.length > 0 ? slug : "component";
}

async function sha256Hex(value: string): Promise<string> {
  const encoded = new TextEncoder().encode(value);
  const hashBuffer = await crypto.subtle.digest("SHA-256", encoded);
  const bytes = Array.from(new Uint8Array(hashBuffer));
  return bytes.map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function buildPublicComponentId(component: ComponentDocument): Promise<string> {
  const sourceLibrary = component.source.library?.trim();
  const slug = toIdSlug(`${component.name}-${sourceLibrary ?? "component"}`);
  const fingerprint = `${component.id}|${component.source.url}|${component.framework}|${component.styling}`;
  const hash = await sha256Hex(fingerprint);
  return `${slug}-${hash.slice(0, ID_HASH_LENGTH)}`;
}

export async function buildSplitComponentRecords(component: ComponentDocument): Promise<{
  metadata: ComponentMetadataDocument;
  code: ComponentCodeDocument;
  search: ComponentSearchDocument;
}> {
  const id = await buildPublicComponentId(component);
  const primitiveLibrary = detectPrimitiveLibrary(component);
  const animationLibrary = detectAnimationLibrary(component);

  const metadata: ComponentMetadataDocument = {
    schemaVersion: 4,
    id,
    name: component.name,
    source: component.source,
    framework: component.framework,
    styling: component.styling,
    dependencies: component.dependencies,
    motionLevel: component.motionLevel,
    primitiveLibrary,
    animationLibrary,
    constraints: component.constraints,
  };

  const code: ComponentCodeDocument = {
    schemaVersion: 4,
    componentId: id,
    entryFile: component.code.entryFile,
    files: component.code.files,
  };

  const search: ComponentSearchDocument = {
    schemaVersion: 4,
    componentId: id,
    intent: component.intent,
    capabilities: component.capabilities,
    synonyms: component.synonyms,
    topics: component.topics,
  };

  return {
    metadata,
    code,
    search,
  };
}
