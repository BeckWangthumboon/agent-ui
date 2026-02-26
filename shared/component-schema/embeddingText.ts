import type { ComponentTopic } from "./types";

type ComponentEmbeddingTextInput = {
  name: string;
  intent: string;
  capabilities: readonly string[];
  synonyms: readonly string[];
  topics: readonly ComponentTopic[];
};

function normalizeText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function normalizeList(values: readonly string[]): string[] {
  const normalized = values
    .map((value) => normalizeText(value))
    .filter((value) => value.length > 0);
  const unique = Array.from(new Set(normalized));
  return unique.sort((left, right) => left.localeCompare(right, "en"));
}

function serializeList(values: readonly string[]): string {
  return values.length > 0 ? values.join(" | ") : "(none)";
}

export function buildComponentEmbeddingText(input: ComponentEmbeddingTextInput): string {
  const name = normalizeText(input.name);
  const intent = normalizeText(input.intent);
  const capabilities = normalizeList(input.capabilities);
  const synonyms = normalizeList(input.synonyms);
  const topics = normalizeList(input.topics);

  return [
    `name: ${name.length > 0 ? name : "(unnamed)"}`,
    `intent: ${intent.length > 0 ? intent : "(none)"}`,
    `capabilities: ${serializeList(capabilities)}`,
    `synonyms: ${serializeList(synonyms)}`,
    `topics: ${serializeList(topics)}`,
  ].join("\n");
}
