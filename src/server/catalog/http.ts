import { ZodError } from "zod";
import { AppError, apiError } from "@/lib/errors";
export async function catalogResponse(work: () => Promise<unknown>) {
  try {
    return Response.json(await work());
  } catch (e) {
    if (e instanceof AppError) {
      const response = apiError(e.code, e.message);
      return Response.json(
        {
          code: e.code,
          message: e.message,
          ...("impact" in e ? { impact: e.impact } : {}),
        },
        { status: response.status },
      );
    }
    if (e instanceof ZodError)
      return apiError("INVALID_REQUEST", "輸入格式不正確");
    if (e instanceof SyntaxError)
      return apiError("INVALID_REQUEST", "Invalid JSON body");
    const code =
      (e as { code?: string; cause?: { code?: string } })?.code ??
      (e as { cause?: { code?: string } })?.cause?.code;
    if (code === "55P03" || code === "40P01")
      return apiError("CONFLICT", "資料正被其他操作更新，請稍後重試。");
    if (code === "57014")
      return Response.json({ code: "SERVICE_UNAVAILABLE", message: "操作逾時，請縮小條件或稍後重試。" }, { status: 503 });
    if (code === "23505")
      return apiError("CONFLICT", "This slug already exists");
    if (code === "23503")
      return apiError(
        "INVALID_REQUEST",
        "A referenced item does not exist or is still in use",
      );
    if (code === "23514") return apiError("INVALID_REQUEST", "Invalid data");
    console.error("Catalog request failed", { code: code ?? "UNKNOWN" });
    return apiError("INTERNAL_ERROR", "暫時無法完成操作，請稍後重試。");
  }
}

export async function readJsonBody(
  req: Request,
  maxBytes = 256_000,
): Promise<unknown> {
  if (Number(req.headers.get("content-length") ?? 0) > maxBytes)
    throw new AppError("INVALID_REQUEST", "Request body too large");
  const reader = req.body?.getReader();
  if (!reader) throw new AppError("INVALID_REQUEST", "Request body required");
  let bytes = 0;
  const chunks: Uint8Array[] = [];
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > maxBytes) {
        await reader.cancel();
        throw new AppError("INVALID_REQUEST", "Request body too large");
      }
      chunks.push(value);
    }
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } finally {
    reader.releaseLock();
  }
}
