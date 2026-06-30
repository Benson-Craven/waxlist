export type LimitedJsonResult =
  | {
      ok: true;
      value: unknown;
      bytesRead: number;
    }
  | {
      ok: false;
      status: number;
      code: "request_too_large" | "invalid_json";
      message: string;
      bytesRead: number;
    };

export async function readLimitedJsonRequest(
  request: Request,
  maxBytes: number,
): Promise<LimitedJsonResult> {
  const rawContentLength = request.headers.get("content-length");

  if (rawContentLength) {
    const contentLength = Number.parseInt(rawContentLength, 10);

    if (Number.isFinite(contentLength) && contentLength > maxBytes) {
      return {
        ok: false,
        status: 413,
        code: "request_too_large",
        message: `Request body must be ${maxBytes.toLocaleString()} bytes or smaller.`,
        bytesRead: 0,
      };
    }
  }

  if (!request.body) {
    return {
      ok: false,
      status: 400,
      code: "invalid_json",
      message: "Request body must be valid JSON.",
      bytesRead: 0,
    };
  }

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let bytesRead = 0;

  while (true) {
    const { done, value } = await reader.read();

    if (done) {
      break;
    }

    bytesRead += value.byteLength;

    if (bytesRead > maxBytes) {
      await reader.cancel();

      return {
        ok: false,
        status: 413,
        code: "request_too_large",
        message: `Request body must be ${maxBytes.toLocaleString()} bytes or smaller.`,
        bytesRead,
      };
    }

    chunks.push(value);
  }

  try {
    const rawBody = new TextDecoder().decode(Buffer.concat(chunks));

    return {
      ok: true,
      value: JSON.parse(rawBody),
      bytesRead,
    };
  } catch {
    return {
      ok: false,
      status: 400,
      code: "invalid_json",
      message: "Request body must be valid JSON.",
      bytesRead,
    };
  }
}
