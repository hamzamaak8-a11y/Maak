# Maak

منصة لاكتشاف وحجز خدمات منزلية موثوقة، تربط العملاء بمقدّمي الخدمات المعتمدين.

## الحالة الحالية

- **V1:** اكتشاف مقدّمي الخدمات، عرض الملفات، إنشاء طلبات الحجز، وإدارة دورة الحجز.
- **Chat:** مخفية في V1 حتى تكتمل طبقة Realtime والتحقق الإنتاجي. كود واجهة الشات غير جزء من الـfrontend الحالي.
- **Appointment conflicts:** الحجز في V1 هو **طلب موعد** وليس قفلًا صارمًا للتقويم؛ مقدم الخدمة يقبل أو يرفض الطلب يدوياً.
- **Admin:** لوحة الإدارة محمية بالدور والحالة وتستخدم العمليات الآمنة المخصصة للتغييرات الحساسة.

## Architecture

```text
Browser (React/Vite/TypeScript)
        |
        +--> Supabase Auth / RPCs / RLS
        |
        +--> Cloudflare Worker --> Supabase REST (public provider reads)
        |
        +--> GitHub Pages (static frontend + PWA)
```

### Frontend

- React 18 + TypeScript + Vite 6
- React Router الداخلي يعتمد History API ويدعم التشغيل من `/` أو `/Maak/`.
- `VITE_API_URL` يحدد Worker العام في production.
- `VITE_SUPABASE_URL` و`VITE_SUPABASE_PUBLISHABLE_KEY` مخصصان للمتصفح فقط.
- `VITE_BASE=/Maak/` هو مسار GitHub Pages الحالي، ويمكن تغييره عند النشر تحت مسار آخر.
- PWA assets و`404.html` وService Worker تستخدم مسارات متوافقة مع base path.

### Backend / Security

- Supabase للمصادقة، PostgreSQL، Storage وRLS.
- العمليات الحساسة مثل الحجز، تغيير حالة الحجز، واعتماد مقدّم الخدمة تتم عبر RPCs بدلاً من mutations مباشرة على الجداول.
- قراءات مقدّمي الخدمات العامة تمر عبر Cloudflare Worker.
- لا يجب وضع `service_role` أو أي secret في كود المتصفح.
- أسرار Worker مثل `SUPABASE_SERVICE_ROLE_KEY` و`ADMIN_TOKEN` تُضبط عبر Cloudflare/Wrangler secrets ولا تُحفظ في المستودع.

### Deployment

يوجد مساران في GitHub Actions:

1. **Build:** `typecheck` للواجهة، `npm run build`، ثم `qa:smoke`، ثم typecheck/build للـWorker.
2. **Deploy Pages:** يبني `dist` ثم يرفعه إلى GitHub Pages ويقوم بالنشر.

البيئة الإنتاجية الحالية تستخدم Worker:

```text
https://maak.i36508871.workers.dev
```

وGitHub Pages تحت:

```text
https://hamzamaak8-a11y.github.io/Maak/
```

## Environment setup

للتطوير المحلي:

```bash
cp .env.example .env.development
```

لـproduction:

```bash
cp .env.production.example .env.production
```

ثم اضبط القيم العامة المطلوبة. استخدم `.env.example` كمرجع لأسرار Worker، لكن لا تضع الأسرار نفسها في ملفات committed.

## E2E seed tool

لإنشاء حساب عميل وحساب مقدم خدمة موثق ومنشور، توفر أسبوعي `09:00-17:00`، ومحادثة اختبار قابلة لإعادة التشغيل:

```bash
node scripts/seed-e2e.mjs
```

ضع القيم التالية في ملف `.env.local` أو `.env.development` محلياً فقط:

```env
SUPABASE_SERVICE_ROLE_KEY=<local-secret-only>
VITE_SUPABASE_URL=https://<project>.supabase.co
MAAK_E2E_PROVIDER_PASSWORD=<strong-local-password>
MAAK_E2E_CUSTOMER_PASSWORD=<strong-local-password>
```

اختيارياً يمكن تغيير البريدين عبر:

```env
MAAK_E2E_PROVIDER_EMAIL=e2e-provider@maak.test
MAAK_E2E_CUSTOMER_EMAIL=e2e-customer@maak.test
```

إعادة التشغيل آمنة: السكربت يتعرف على حساباته عبر `app_metadata.maak_e2e_seed` ويحدّثها بدلاً من إنشاء نسخ مكررة، ويرفض تعديل حساب موجود يحمل البريد نفسه من دون هذه العلامة.

لإزالة بيانات E2E:

```bash
node scripts/seed-e2e.mjs --cleanup
```

لا يطبع السكربت كلمات المرور، ولا تُحفظ أي مفاتيح سرية في المستودع؛ `.env`, `.env.*`, و`.env.local` ضمن `.gitignore`.

## Commands

```bash
npm ci
npm run typecheck
npm run build
npm run qa:smoke
```

لـWorker:

```bash
npm ci --prefix worker
npm run typecheck --prefix worker
npm run build --prefix worker
```

## Smoke test

`scripts/smoke.mjs` يتحقق من وجود أهم artifacts الإنتاجية:

- `index.html`
- `404.html`
- `admin/index.html`
- `admin/login/index.html`
- `manifest.webmanifest`
- `sw.js`

كما يتحقق من المسارات النسبية للـPWA وService Worker وعدم اعتراض طلبات `/api/`.

## Languages

العربية الفصحى مع RTL، والفرنسية المهنية مع LTR.
