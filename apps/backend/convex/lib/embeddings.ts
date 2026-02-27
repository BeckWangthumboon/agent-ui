import OpenAI from "openai";

type EmbeddingRequest = {
  input: string;
  model: string;
  dimensions: number;
};

export function createEmbeddingClientFromEnv(purpose: string): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error(`OPENAI_API_KEY is required for ${purpose}.`);
  }

  return new OpenAI({
    apiKey,
    baseURL: process.env.OPENAI_BASE_URL,
  });
}

export async function createEmbedding(client: OpenAI, request: EmbeddingRequest) {
  const response = await client.embeddings.create({
    model: request.model,
    input: request.input,
    dimensions: request.dimensions,
    encoding_format: "float",
  });

  const embedding = response.data[0]?.embedding;
  if (!Array.isArray(embedding)) {
    throw new Error("Embeddings response did not include a valid vector.");
  }

  return embedding.map((value) => Number(value));
}
