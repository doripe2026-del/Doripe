export const defaultPhotoHost = "storage.tally.so";

export function webhookAuthenticationConfigured(headerSecret: string, signingSecret: string): boolean {
  return Boolean(headerSecret.trim() || signingSecret.trim());
}

function normalizeHostname(value: string): string {
  const trimmed = value.trim().toLowerCase().replace(/\.$/, "");
  if (!trimmed) return "";

  try {
    return new URL(trimmed.includes("://") ? trimmed : `https://${trimmed}`).hostname
      .toLowerCase()
      .replace(/^\[|\]$/g, "")
      .replace(/\.$/, "");
  } catch {
    return "";
  }
}

function isBlockedIpv4(hostname: string): boolean {
  const parts = hostname.split(".");
  if (parts.length !== 4 || parts.some((part) => !/^\d{1,3}$/.test(part))) return false;

  const octets = parts.map(Number);
  if (octets.some((octet) => octet > 255)) return true;

  const [first, second] = octets;
  return (
    first === 0 ||
    first === 10 ||
    first === 127 ||
    (first === 100 && second >= 64 && second <= 127) ||
    (first === 169 && second === 254) ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 0) ||
    (first === 192 && second === 168) ||
    (first === 198 && (second === 18 || second === 19)) ||
    first >= 224
  );
}

export function isPrivateOrLocalHostname(value: string): boolean {
  const hostname = normalizeHostname(value);
  if (!hostname) return true;

  if (
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    hostname.endsWith(".local") ||
    hostname.endsWith(".internal")
  ) {
    return true;
  }

  if (isBlockedIpv4(hostname)) return true;

  if (hostname.includes(":")) {
    const compact = hostname.toLowerCase();
    return (
      compact === "::" ||
      compact === "::1" ||
      compact.startsWith("fc") ||
      compact.startsWith("fd") ||
      compact.startsWith("fe8") ||
      compact.startsWith("fe9") ||
      compact.startsWith("fea") ||
      compact.startsWith("feb") ||
      compact.startsWith("ff") ||
      compact.startsWith("::ffff:127.") ||
      compact.startsWith("::ffff:10.") ||
      compact.startsWith("::ffff:192.168.")
    );
  }

  return false;
}

export function buildAllowedPhotoHosts(configuredHosts = ""): Set<string> {
  const hosts = new Set([defaultPhotoHost]);

  for (const value of configuredHosts.split(",")) {
    const hostname = normalizeHostname(value);
    if (hostname && !isPrivateOrLocalHostname(hostname)) hosts.add(hostname);
  }

  return hosts;
}

export function validatePhotoUrl(value: string, allowedHosts: ReadonlySet<string>): URL | null {
  try {
    const url = new URL(value);
    const hostname = normalizeHostname(url.hostname);
    if (
      url.protocol !== "https:" ||
      (url.port !== "" && url.port !== "443") ||
      url.username ||
      url.password ||
      !hostname ||
      isPrivateOrLocalHostname(hostname) ||
      !allowedHosts.has(hostname)
    ) {
      return null;
    }

    return url;
  } catch {
    return null;
  }
}

export async function mapWithConcurrency<T, R>(
  values: readonly T[],
  concurrency: number,
  mapper: (value: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(values.length);
  const workerCount = Math.max(1, Math.min(Math.floor(concurrency), values.length));
  let nextIndex = 0;

  await Promise.all(
    Array.from({ length: workerCount }, async () => {
      while (nextIndex < values.length) {
        const index = nextIndex;
        nextIndex += 1;
        results[index] = await mapper(values[index], index);
      }
    }),
  );

  return results;
}

export async function readBodyWithLimit(request: Request, maxBytes: number): Promise<string> {
  const declaredLength = Number(request.headers.get("content-length") ?? 0);
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    throw new Error("PAYLOAD_TOO_LARGE");
  }

  if (!request.body) return "";

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > maxBytes) {
        await reader.cancel();
        throw new Error("PAYLOAD_TOO_LARGE");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const body = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return new TextDecoder("utf-8", { fatal: true }).decode(body);
}
