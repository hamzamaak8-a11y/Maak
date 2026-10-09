/**
 * Consent and revocation rules for push notifications, free of any React Native import so they can be tested in Node.
 *
 * Two different things must never be confused:
 *  - the phone's system permission (the OS dialog), and
 *  - the user's own choice inside Maak, stored per device AND per account ("opt-in").
 * A phone with the system permission granted receives nothing from an account until that account opted in on this phone,
 * and "Turn off" is remembered locally first, so a failed network call can never switch notifications back on.
 *
 * Revocation: turning off or signing out removes this phone's token on the server. When that fails (offline, expired session)
 * the token is kept in a small local "to revoke" list and revoked later WITHOUT needing a session (revoke_push_token), on the next
 * launch, when the app returns to the foreground, or before this phone registers again.
 */
export type Permission = 'granted' | 'denied' | 'undetermined';
export type PushState = 'unsupported' | 'unavailable' | 'denied' | 'off' | 'on';

export type PushDeps = {
  storage: { get(key: string): Promise<string | null>; set(key: string, value: string): Promise<void>; remove(key: string): Promise<void> };
  os: { available(): boolean; permission(): Promise<{ status: Permission; canAskAgain: boolean }>; request(): Promise<{ status: Permission; canAskAgain: boolean }>; token(): Promise<string | null> };
  api: {
    register(token: string, lang: string): Promise<void>;
    /** Needs the signed-in session. */
    unregister(token: string): Promise<void>;
    /** Works without a session; only the holder of the token can name it. */
    revoke(token: string): Promise<void>;
  };
  /** Longest wait for the network while signing out. */
  signOutTimeoutMs?: number;
};

const optKey = (uid: string) => `maak.push.optin.${uid}`;
const PENDING = 'maak.push.revoke';
const TOKEN = 'maak.push.token'; // last token this phone registered, so it can be revoked without asking the OS or the network

export function createPush(deps: PushDeps) {
  const { storage, os, api } = deps;

  const readPending = async (): Promise<string[]> => {
    try { const v = JSON.parse((await storage.get(PENDING)) ?? '[]'); return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []; } catch { return []; }
  };
  const writePending = async (list: string[]) => { if (list.length) await storage.set(PENDING, JSON.stringify(list.slice(-20))); else await storage.remove(PENDING); };
  const addPending = async (token: string) => { const l = await readPending(); if (!l.includes(token)) await writePending([...l, token]); };
  const dropPending = async (token: string) => { const l = await readPending(); if (l.includes(token)) await writePending(l.filter(x => x !== token)); };
  const knownToken = async (): Promise<string | null> => {
    try { return (await storage.get(TOKEN)) ?? (await os.token()); } catch { return null; }
  };
  const optedIn = async (uid: string) => (await storage.get(optKey(uid))) === '1';

  /** What Settings shows for this account on this phone. */
  async function state(uid: string): Promise<PushState> {
    if (!os.available()) return 'unavailable';
    const p = await os.permission();
    if (p.status === 'denied' && !p.canAskAgain) return 'denied';
    if (p.status === 'granted' && (await optedIn(uid))) return 'on';
    return 'off';
  }

  async function register(uid: string, lang: string): Promise<boolean> {
    const token = await os.token();
    if (!token) return false;
    await dropPending(token); // this phone is (re)registered on purpose: an older revoke for the same token must not undo it
    await api.register(token, lang);
    await storage.set(TOKEN, token);
    await storage.set(optKey(uid), '1');
    return true;
  }

  /** The user pressed "Turn on": system dialog if needed, then register. */
  async function enable(uid: string, lang: string): Promise<PushState> {
    if (!os.available()) return 'unavailable';
    let p = await os.permission();
    if (p.status !== 'granted') p = await os.request();
    if (p.status !== 'granted') return p.canAskAgain === false ? 'denied' : 'off';
    return (await register(uid, lang)) ? 'on' : 'unavailable';
  }

  /** Keeps the registration fresh (language, token rotation). Does NOTHING unless this account opted in on this phone and the system still allows it. */
  async function refresh(uid: string, lang: string): Promise<void> {
    if ((await state(uid)) !== 'on') return;
    await register(uid, lang);
  }

  /** Revokes one token; on failure it is remembered and retried later. Never throws. */
  async function revokeToken(token: string, viaSession: boolean): Promise<boolean> {
    try {
      if (viaSession) { try { await api.unregister(token); return true; } catch { /* expired session or offline: try without a session */ } }
      await api.revoke(token);
      return true;
    } catch {
      await addPending(token).catch(() => undefined);
      return false;
    }
  }

  /** The user pressed "Turn off": the choice is saved FIRST, so nothing can switch it back on. */
  async function disable(uid: string): Promise<{ revoked: boolean }> {
    await storage.remove(optKey(uid));
    const token = await knownToken();
    if (!token) return { revoked: true };
    return { revoked: await revokeToken(token, true) };
  }

  /** Before signing out: same as disable, but bounded in time so signing out can never hang on a bad network. */
  async function disableForSignOut(uid: string): Promise<{ revoked: boolean }> {
    const limit = deps.signOutTimeoutMs ?? 3000;
    await storage.remove(optKey(uid)).catch(() => undefined);
    const token = await Promise.race([knownToken(), new Promise<null>(r => setTimeout(() => r(null), limit))]);
    if (!token) return { revoked: true };
    const done = revokeToken(token, true);
    const result = await Promise.race([done, new Promise<'timeout'>(r => setTimeout(() => r('timeout'), limit))]);
    if (result === 'timeout') { await addPending(token).catch(() => undefined); return { revoked: false }; }
    return { revoked: result };
  }

  /** Retries every remembered revocation (no session needed). Safe to call often. */
  async function flushPending(): Promise<number> {
    const list = await readPending();
    let left = list;
    for (const token of list) {
      try { await api.revoke(token); left = left.filter(x => x !== token); } catch { /* still offline */ }
    }
    if (left.length !== list.length) await writePending(left);
    return left.length;
  }

  return { state, enable, refresh, disable, disableForSignOut, flushPending, pending: readPending };
}
