import OpenAI from "openai";

type EmbeddingRequest = {
  input: string;
  model: string;
  dimensions: number;
};

export function createEmbeddingClient(apiKey: string, baseURL?: string): OpenAI {
  return new OpenAI({
    apiKey,
    baseURL,
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
