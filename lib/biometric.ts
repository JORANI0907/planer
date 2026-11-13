// 간편 생체 잠금(B안): WebAuthn 플랫폼 인증기(지문/Face/Windows Hello)로
// 비밀번호를 암호화해 로컬에 저장하고, 지문 인증 시 복호화해 기존 로그인에 재사용.
// - 서버 변경/DB 불필요. 기존 비밀번호 로그인은 백업으로 유지.
// - 비밀번호는 PRF(인증기에서 파생한 키)로 AES-GCM 암호화해 저장 → 지문 없이는 복호화 불가.

const LS_KEY = 'planner-biometric-v1'
const SALT = new TextEncoder().encode('planner-prf-salt-v1') as Uint8Array<ArrayBuffer>

type PrfInputs = { prf: { eval: { first: BufferSource } } }
type PrfOutputs = { prf?: { results?: { first?: ArrayBuffer } } }

export function hasBiometric(): boolean {
  try { return !!localStorage.getItem(LS_KEY) } catch { return false }
}

export async function biometricSupported(): Promise<boolean> {
  if (typeof window === 'undefined' || !('PublicKeyCredential' in window)) return false
  try {
    return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()
  } catch {
    return false
  }
}

function b64e(buf: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buf)))
}
function b64d(s: string): Uint8Array<ArrayBuffer> {
  const bin = atob(s)
  const a = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) a[i] = bin.charCodeAt(i)
  return a
}
function rand(n: number): Uint8Array<ArrayBuffer> {
  const a = new Uint8Array(n)
  crypto.getRandomValues(a)
  return a
}

async function deriveKey(prf: ArrayBuffer): Promise<CryptoKey> {
  return crypto.subtle.importKey('raw', prf, 'AES-GCM', false, ['encrypt', 'decrypt'])
}

async function evalPrf(credentialId: BufferSource): Promise<ArrayBuffer | null> {
  const assertion = (await navigator.credentials.get({
    publicKey: {
      challenge: rand(32),
      allowCredentials: [{ id: credentialId, type: 'public-key' }],
      userVerification: 'required',
      timeout: 60000,
      extensions: ({ prf: { eval: { first: SALT } } } as unknown) as AuthenticationExtensionsClientInputs,
    },
  })) as PublicKeyCredential | null
  if (!assertion) return null
  const ext = assertion.getClientExtensionResults() as AuthenticationExtensionsClientOutputs & PrfOutputs
  return ext.prf?.results?.first ?? null
}

export async function registerBiometric(password: string): Promise<{ ok: boolean; reason?: string }> {
  if (!(await biometricSupported())) return { ok: false, reason: '이 기기는 생체인증을 지원하지 않습니다.' }
  try {
    const cred = (await navigator.credentials.create({
      publicKey: {
        challenge: rand(32),
        rp: { name: '인생 플래너', id: location.hostname },
        user: { id: rand(16), name: 'owner', displayName: '인생 플래너' },
        pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
        authenticatorSelection: {
          authenticatorAttachment: 'platform',
          userVerification: 'required',
          residentKey: 'preferred',
        },
        timeout: 60000,
        extensions: ({ prf: {} } as unknown) as AuthenticationExtensionsClientInputs,
      },
    })) as PublicKeyCredential | null
    if (!cred) return { ok: false, reason: '등록이 취소되었습니다.' }

    const credId = new Uint8Array(cred.rawId)
    const prf = await evalPrf(credId)
    if (!prf) return { ok: false, reason: '이 기기/브라우저는 지문 기반 암호화(PRF)를 지원하지 않습니다.' }

    const key = await deriveKey(prf)
    const iv = rand(12)
    const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(password))
    localStorage.setItem(LS_KEY, JSON.stringify({ id: b64e(credId.buffer), iv: b64e(iv.buffer), ct: b64e(ct) }))
    return { ok: true }
  } catch (e) {
    return { ok: false, reason: e instanceof Error ? e.message : '등록에 실패했습니다.' }
  }
}

// 지문 인증 → 저장된 비밀번호 복호화 반환(실패 시 null)
export async function unlockBiometric(): Promise<string | null> {
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (!raw) return null
    const { id, iv, ct } = JSON.parse(raw) as { id: string; iv: string; ct: string }
    const prf = await evalPrf(b64d(id))
    if (!prf) return null
    const key = await deriveKey(prf)
    const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: b64d(iv) }, key, b64d(ct))
    return new TextDecoder().decode(pt)
  } catch {
    return null
  }
}

export function clearBiometric(): void {
  try { localStorage.removeItem(LS_KEY) } catch { /* noop */ }
}
