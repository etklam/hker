import { AppError, apiError } from "@/lib/errors";
export async function catalogResponse(work: () => Promise<unknown>) {
  try {
    return Response.json(await work());
  } catch (e) {
    if (e instanceof AppError) return apiError(e.code, e.message);
    if (e instanceof SyntaxError)
      return apiError("INVALID_REQUEST", "Invalid JSON body");
    const code =
      (e as { code?: string; cause?: { code?: string } })?.code ??
      (e as { cause?: { code?: string } })?.cause?.code;
    if (code === "23505")
      return apiError("CONFLICT", "This slug already exists");
    if (code === "23503")
      return apiError(
        "INVALID_REQUEST",
        "A referenced item does not exist or is still in use",
      );
    if (code === "23514") return apiError("INVALID_REQUEST", "Invalid data");
    throw e;
  }
}
