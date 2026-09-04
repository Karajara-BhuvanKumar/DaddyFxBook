/**
 * Helper to parse Supabase Edge Function errors and return human-readable Error objects.
 * Handles network/DNS/paused project errors, HttpError JSON contexts, and custom error payloads.
 */
export async function parseEdgeFunctionError(error: any, data: any): Promise<Error> {
  if (error) {
    const msg = error.message || "";
    // Handle network, DNS, CORS, or paused project errors
    if (
      msg.includes("Failed to send a request") ||
      msg.includes("Failed to fetch") ||
      msg.includes("NetworkError") ||
      msg.includes("Failed to execute 'fetch'")
    ) {
      return new Error(
        "Unable to connect to Supabase Edge Function. Please verify that your Supabase project is active and unpaused in your Supabase dashboard."
      );
    }

    // Try parsing response JSON context if available (FunctionsHttpError)
    if (error.context && typeof error.context.clone === "function") {
      try {
        const body = await error.context.clone().json();
        if (body?.error) {
          const detail = body.detail ? `: ${body.detail}` : "";
          return new Error(`${body.error}${detail}`);
        }
      } catch (_) {}
    }

    return new Error(msg || "An unknown error occurred while calling the Edge Function.");
  }

  if (data?.error) {
    const detail = data.detail ? `: ${data.detail}` : "";
    return new Error(`${data.error}${detail}`);
  }

  return new Error("Unknown error calling Edge Function.");
}
