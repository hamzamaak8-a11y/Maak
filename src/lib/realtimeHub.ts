/**
 * Shares one Supabase Realtime channel between every listener of the same stream.
 *
 * supabase-js returns the already-subscribed channel when `channel(topic)` is called twice with the same
 * topic, and adding `postgres_changes` callbacks to a subscribed channel throws
 * ("cannot add `postgres_changes` callbacks ... after `subscribe()`"). The bell icon, the notifications
 * screen and the chat all subscribe, often at the same time, so each stream gets ONE channel:
 * callbacks are registered before `subscribe()` and fan out to a listener set.
 */
export type HubClient = {
  channel(topic: string): {
    on(type: 'postgres_changes', filter: Record<string, unknown>, cb: (payload: { new: unknown }) => void): unknown;
    subscribe(): unknown;
  };
  removeChannel(channel: unknown): unknown;
};

type Entry = { channel: ReturnType<HubClient['channel']>; listeners: Set<(row: unknown) => void> };

export function createRealtimeHub(client: HubClient) {
  const entries = new Map<string, Entry>();
  let seq = 0;

  return function subscribe<T>(key: string, filter: Record<string, unknown>, listener: (row: T) => void): () => void {
    let entry = entries.get(key);
    if (!entry) {
      const listeners = new Set<(row: unknown) => void>();
      const channel = client.channel(`${key}#${++seq}`);
      channel.on('postgres_changes', filter, payload => { for (const l of [...listeners]) l(payload.new); });
      channel.subscribe();
      entry = { channel, listeners };
      entries.set(key, entry);
    }
    const fn = listener as (row: unknown) => void;
    entry.listeners.add(fn);
    const owner = entry;
    let active = true;
    return () => {
      if (!active) return;
      active = false;
      owner.listeners.delete(fn);
      if (owner.listeners.size === 0 && entries.get(key) === owner) {
        entries.delete(key);
        void client.removeChannel(owner.channel);
      }
    };
  };
}
