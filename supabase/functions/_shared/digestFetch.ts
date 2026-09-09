import md5 from 'npm:blueimp-md5@2.19.0';

export interface CameraCredentials {
  username?: string;
  password?: string;
}

function parseAuthParams(header: string): Record<string, string> {
  const out: Record<string, string> = {};
  const body = header.replace(/^Digest\s+/i, '');
  const re = /(\w+)=("([^"]*)"|[^,]*)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(body))) out[m[1].toLowerCase()] = m[3] ?? m[2];
  return out;
}

function digestHeader(
  method: string,
  url: string,
  challenge: string,
  username: string,
  password: string,
): string {
  const p = parseAuthParams(challenge);
  const uri = new URL(url).pathname + new URL(url).search;
  const realm = p.realm ?? '';
  const nonce = p.nonce ?? '';
  const qop = (p.qop ?? '').split(',')[0].trim();
  const cnonce = crypto.randomUUID().replace(/-/g, '').slice(0, 16);
  const nc = '00000001';
  const ha1 = md5(`${username}:${realm}:${password}`);
  const ha2 = md5(`${method}:${uri}`);
  const response = qop
    ? md5(`${ha1}:${nonce}:${nc}:${cnonce}:${qop}:${ha2}`)
    : md5(`${ha1}:${nonce}:${ha2}`);
  const parts = [
    `username="${username}"`,
    `realm="${realm}"`,
    `nonce="${nonce}"`,
    `uri="${uri}"`,
    `response="${response}"`,
  ];
  if (p.opaque) parts.push(`opaque="${p.opaque}"`);
  if (qop) parts.push(`qop=${qop}`, `nc=${nc}`, `cnonce="${cnonce}"`);
  return `Digest ${parts.join(', ')}`;
}

/**
 * Fetch that transparently handles Basic and Digest auth (Hikvision/Dahua
 * recorders default to Digest, which `fetch` does not implement).
 */
export async function fetchWithAuth(
  url: string,
  credentials: CameraCredentials | null | undefined,
  init: RequestInit = {},
): Promise<Response> {
  const method = init.method ?? 'GET';
  const first = await fetch(url, init);
  if (first.status !== 401 || !credentials?.username) return first;

  const challenge = first.headers.get('www-authenticate') ?? '';
  await first.body?.cancel();
  const headers = new Headers(init.headers);

  if (/^digest/i.test(challenge)) {
    headers.set(
      'Authorization',
      digestHeader(method, url, challenge, credentials.username, credentials.password ?? ''),
    );
  } else {
    headers.set('Authorization', `Basic ${btoa(`${credentials.username}:${credentials.password ?? ''}`)}`);
  }
  return await fetch(url, { ...init, headers });
}
