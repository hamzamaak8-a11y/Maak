# Push notifications for a closed app (free path, off until you switch it on)

Today a booking creates a database notification that reaches an **open** app through Realtime. This release adds the missing part
for a **closed** app, using only free services: the Expo Push Service (no cost) delivering through Firebase Cloud Messaging on Android.

```
notifications INSERT -> trigger private.dispatch_push() -> Worker POST /push/notify -> Expo Push -> FCM -> phone
```

Everything is **dormant** until you do the steps below. Nothing is sent, no secret is in the repository, and a failure never blocks a notification.

## Why Android only for now
iOS notifications need an Apple Developer account (paid) with an APNs key. The code is ready for it (same Expo path), but the store accounts and
payments are yours to decide.

## Steps for the owner
1. **Firebase (free):** create a Firebase project, add an Android app with package `com.maak.app`, download `google-services.json`.
   Upload it to EAS as a file variable named `GOOGLE_SERVICES_JSON` (`eas env:create`). `app.config.ts` picks it up; without it the build still works but
   Android push cannot register.
2. **Expo credentials:** `eas credentials` -> Android -> upload the FCM v1 service-account key (Firebase -> Project settings -> Service accounts).
3. **Supabase:** run `20261008140000_push_notifications.sql`, enable the `pg_net` extension (Database -> Extensions), then in the SQL editor:
   `insert into private.push_config(worker_url, secret) values ('https://maak.hamzamaak8.workers.dev/push/notify', '<a random 32+ character secret>');`
4. **Worker:** `npx wrangler secret put PUSH_WEBHOOK_SECRET` with the same secret, then `npx wrangler deploy`.
5. **A new Android build** (EAS) is needed because a native module was added (`expo-notifications`). Not built by me.
6. On the phone: Settings -> Notifications on this phone -> Turn on. The system permission dialog appears only then.

## Behaviour
* The user chooses: nothing is requested at start-up. Signing out removes this phone's token. A phone that signs in with another account moves to it.
* Text is localised (Arabic, French, English) from the language stored with the token; announcements are sent as written.
* Tapping a notification opens the booking or the chat.
* Limits: Expo delivery is best effort; a user keeps at most 10 devices; tokens Expo reports as dead are deleted.

## Tests
`supabase/ci/push-notifications-test.sql` (RLS, RPC rules, dormant trigger, dispatch payload, failure isolation), `worker/test/push.test.mjs`
(secret, validation, localisation, cleanup). Not testable here: a real device, FCM delivery.
