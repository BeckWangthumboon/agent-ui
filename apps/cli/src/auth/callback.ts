export type ParsedAuthCallback = {
  code: string;
  state?: string;
  source: "url" | "params" | "code";
};

function readParam(
  params: URLSearchParams,
  hashParams: URLSearchParams,
  name: string,
): string | undefined {
  return params.get(name) ?? hashParams.get(name) ?? undefined;
}

function parseUrlLikeInput(input: string): ParsedAuthCallback | null {
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    return null;
  }

  const hash = url.hash.startsWith("#") ? url.hash.slice(1) : url.hash;
  const hashParams = new URLSearchParams(hash);
  const code = readParam(url.searchParams, hashParams, "code");
  const error = readParam(url.searchParams, hashParams, "error");
  const errorDescription = readParam(url.searchParams, hashParams, "error_description");

  if (error) {
    const details = errorDescription ? ` ${errorDescription}` : "";
    throw new Error(`Authentication failed: ${error}.${details}`.trim());
  }

  if (!code) {
    throw new Error("Callback URL did not include a 'code' parameter.");
  }

  return {
    code,
    state: readParam(url.searchParams, hashParams, "state"),
    source: "url",
  };
}

function parseParamsLikeInput(input: string): ParsedAuthCallback | null {
  if (!input.startsWith("?") && !input.startsWith("code=") && !input.includes("&code=")) {
    return null;
  }

  const params = new URLSearchParams(input.startsWith("?") ? input.slice(1) : input);
  const code = params.get("code");
  const error = params.get("error");
  const errorDescription = params.get("error_description");

  if (error) {
    const details = errorDescription ? ` ${errorDescription}` : "";
    throw new Error(`Authentication failed: ${error}.${details}`.trim());
  }

  if (!code) {
    throw new Error("Pasted callback parameters did not include a 'code' value.");
  }

  return {
    code,
    state: params.get("state") ?? undefined,
    source: "params",
  };
}

export function parseAuthCallbackInput(input: string): ParsedAuthCallback {
  const trimmed = input.trim();
  if (trimmed.length === 0) {
    throw new Error("No callback URL or authorization code was provided.");
  }

  const parsedUrl = parseUrlLikeInput(trimmed);
  if (parsedUrl) {
    return parsedUrl;
  }

  const parsedParams = parseParamsLikeInput(trimmed);
  if (parsedParams) {
    return parsedParams;
  }

  return {
    code: trimmed,
    source: "code",
  };
}

export function validateCallbackState(expectedState: string, actualState?: string): void {
  if (!actualState) {
    return;
  }

  if (actualState !== expectedState) {
    throw new Error("The pasted callback state did not match the active login attempt.");
  }
}
