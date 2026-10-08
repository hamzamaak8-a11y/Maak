// Minimal in-memory Supabase + Worker mock used by `npm run test:e2e`.
// It mirrors the contract of the real RPCs the app calls; it never talks to a real project.
export function makeBackend() {
  const uid = { customer: 'c0000000-0000-0000-0000-000000000001', provider: 'p0000000-0000-0000-0000-000000000002', admin: 'a0000000-0000-0000-0000-000000000003', applicant: 'd0000000-0000-0000-0000-000000000004' };
  const users = {
    'customer@t.co': { id: uid.customer, role: 'customer', name: 'Amina Lahrichi' },
    'provider@t.co': { id: uid.provider, role: 'provider', name: 'Karim Benali' },
    'admin@t.co': { id: uid.admin, role: 'admin', name: 'Admin Maak' },
    'applicant@t.co': { id: uid.applicant, role: 'customer', name: 'Youssef Applicant' },
    'spare@t.co': { id: 'e0000000-0000-0000-0000-000000000005', role: 'customer', name: 'Sara Spare' },
  };
  const state = {
    token: new Map(),
    bookings: [],
    notifications: [],
    providerProfiles: { [uid.provider]: { id: uid.provider, verification_status: 'approved', profession: 'Plombier', service_category: 'سباكة', bio: 'x', experience_years: 5, services: ['تسريب الماء'], price_from: 150, service_radius_km: 20, profile_photo_public: false, rejection_reason: null, created_at: '2026-01-01', updated_at: '2026-01-01' } },
    docs: [],
    pendingApp: { id: uid.applicant, profession: 'Electricien', service_category: 'كهرباء', bio: 'Expert', experience_years: 3, verification_status: 'pending', rejection_reason: null, created_at: '2026-09-01', updated_at: '2026-09-02' },
    favorites: [],
    reports: [],
    deleted: [],
    messages: [],
    log: [],
  };
  const providers = [
    { id: 1, name: 'Karim Benali', job: 'Plombier', city: 'Casablanca', price: '150', rating: '4.8', reviews: 12, image: null, available: true, services: ['تسريب الماء', 'تركيب صنابير'], experience: '10 سنوات', intro: 'Plombier professionnel.', provider_profile_id: uid.provider, category: 'سباكة' },
    { id: 2, name: 'Fatima Zahra', job: 'Agent de nettoyage', city: 'Rabat', price: null, rating: null, reviews: 0, image: null, available: true, services: ['تنظيف منزل'], experience: null, intro: null, provider_profile_id: 'f0000000-0000-0000-0000-000000000009', category: 'تنظيف' },
  ];
  const profileFor = u => ({ id: u.id, role: u.role, full_name: u.name, phone: '+212600000000', city: 'Casablanca', avatar_url: null, account_status: 'active', created_at: '2026-01-01', updated_at: '2026-01-01' });
  const userByToken = req => { const t = (req.headers()['authorization'] || '').replace('Bearer ', ''); return state.token.get(t) ? users[state.token.get(t)] : null; };
  const now = () => new Date().toISOString();
  const json = (route, body, status = 200) => route.fulfill({ status, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*', 'content-type': 'application/json' }, body: JSON.stringify(body) });

  async function handleWorker(route) {
    const u = new URL(route.request().url());
    if (u.pathname === '/api/providers') return json(route, providers);
    const m = u.pathname.match(/^\/api\/providers\/(\d+)(\/portfolio)?$/);
    const svg = (a, b) => 'data:image/svg+xml;base64,' + Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs><rect width="800" height="600" fill="url(#g)"/><circle cx="560" cy="200" r="110" fill="rgba(255,255,255,.18)"/></svg>`).toString('base64');
    const photos = [['#0B2F7A', '#1D8FE0'], ['#9A3412', '#FF9A3C'], ['#0F766E', '#34D3A6'], ['#4C1D95', '#8B5CF6']].map(([a, b], i) => ({ id: 'ph' + i, path: 'p/' + i, url: svg(a, b), created_at: null }));
    if (m) return json(route, m[2] ? photos : providers.find(p => p.id === Number(m[1])) ?? null, providers.find(p => p.id === Number(m[1])) || m[2] ? 200 : 404);
    return json(route, {}, 404);
  }

  async function handleSupabase(route) {
    const req = route.request();
    if (req.method() === 'OPTIONS') return json(route, {}, 204);
    const u = new URL(req.url());
    const path = u.pathname;
    const body = (() => { try { return JSON.parse(req.postData() || '{}'); } catch { return {}; } })();
    const user = userByToken(req);
    const wantsObject = (req.headers()['accept'] || '').includes('vnd.pgrst.object');
    const rows = (arr) => (wantsObject ? (arr[0] ? json(route, arr[0]) : json(route, { message: 'none' }, 406)) : json(route, arr));
    state.log.push(`${req.method()} ${path}${u.search.slice(0, 60)}`);

    if (path === '/auth/v1/token') {
      if (u.searchParams.get('grant_type') === 'password') {
        const email = String(body.email).toLowerCase();
        if (!users[email] || body.password !== 'password123') return json(route, { code: 400, error_code: 'invalid_credentials', msg: 'Invalid login credentials', message: 'Invalid login credentials' }, 400);
        const access = `tok-${email}-${Date.now()}`;
        state.token.set(access, email);
        return json(route, { access_token: access, refresh_token: 'r-' + email, token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, user: { id: users[email].id, email, aud: 'authenticated', role: 'authenticated', user_metadata: { full_name: users[email].name }, app_metadata: {}, created_at: '2026-01-01' } });
      }
      if (u.searchParams.get('grant_type') === 'refresh_token') {
        const email = String(body.refresh_token).replace('r-', '');
        const access = `tok-${email}-${Date.now()}`; state.token.set(access, email);
        return json(route, { access_token: access, refresh_token: 'r-' + email, token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, user: { id: users[email].id, email, aud: 'authenticated', role: 'authenticated', user_metadata: {}, app_metadata: {}, created_at: '2026-01-01' } });
      }
    }
    if (path === '/auth/v1/signup') {
      const email = String(body.email).toLowerCase();
      return json(route, { id: 'new-user', email, aud: 'authenticated', role: 'authenticated', identities: [{ id: 'x' }], user_metadata: body.data ?? {}, app_metadata: {}, created_at: now() });
    }
    if (path === '/auth/v1/logout') return json(route, {}, 204);
    if (path === '/auth/v1/user') return user ? json(route, { id: user.id, email: [...state.token.entries()].find(([, e]) => users[e] === user)?.[1], aud: 'authenticated', role: 'authenticated', user_metadata: {}, app_metadata: {} }) : json(route, { msg: 'no' }, 401);

    if (path.startsWith('/rest/v1/rpc/')) {
      const fn = path.split('/').pop();
      switch (fn) {
        case 'get_my_notifications': return json(route, state.notifications.filter(n => n.user_id === user?.id));
        case 'list_my_conversations': return json(route, []);
        case 'get_provider_availability': return json(route, [0, 1, 2, 3, 4, 5, 6].map(d => ({ id: 'a' + d, provider_id: body.p_provider_id, day_of_week: d, start_time: '09:00:00', end_time: '12:00:00', is_available: true, created_at: now(), updated_at: now() })));
        case 'check_availability': return json(route, !state.bookings.some(b => b.service_date === body.p_start_time && ['pending', 'accepted'].includes(b.status)));
        case 'create_booking': {
          if (!user) return json(route, { message: 'not_authenticated' }, 400);
          const b = { id: 'b' + (state.bookings.length + 1), customer_id: user.id, provider_id: uid.provider, provider_listing_id: body.p_provider_listing_id, service_category: body.p_service_category, service_description: body.p_service_description, service_date: body.p_service_date, location_text: body.p_location_text, customer_note: body.p_customer_note, provider_note: '', status: 'pending', rejection_reason: null, customer_name: user.name, created_at: now(), updated_at: now(), accepted_at: null, started_at: null, completed_at: null, cancelled_at: null, price: null, currency: 'USD', payment_status: 'unpaid', payment_method: null, paid_at: null };
          state.bookings.push(b); state.notifications.push({ id: 'n' + state.notifications.length, user_id: uid.provider, type: 'booking_new', title: 'notifications.bookingNewTitle', body: 'notifications.bookingNewBody', is_read: false, created_at: now(), metadata: { booking_id: b.id } });
          return json(route, b);
        }
        case 'accept_booking': case 'start_booking': case 'complete_booking': case 'cancel_booking': case 'reject_booking': {
          const b = state.bookings.find(x => x.id === body.p_booking_id); if (!b) return json(route, { message: 'not_found' }, 400);
          const map = { accept_booking: ['pending', 'accepted'], start_booking: ['accepted', 'in_progress'], complete_booking: ['in_progress', 'completed'], cancel_booking: ['pending', 'cancelled'], reject_booking: ['pending', 'rejected'] }[fn];
          if (b.status !== map[0]) return json(route, { message: 'invalid_transition' }, 400);
          b.status = map[1]; if (fn === 'reject_booking') b.rejection_reason = body.p_reason; return json(route, b);
        }
        case 'set_booking_price': { const b = state.bookings.find(x => x.id === body.p_booking_id); b.price = body.p_price; b.currency = body.p_currency; return json(route, b); }
        case 'get_provider_dashboard_stats': return json(route, { total_completed_bookings: state.bookings.filter(b => b.status === 'completed').length, total_earnings: null, total_earnings_currency: null, average_rating: 4.5, total_reviews: 2, upcoming_bookings: state.bookings.filter(b => ['pending', 'accepted'].includes(b.status)).map(b => ({ ...b, customer_name: b.customer_name, service_date: b.service_date })), recent_activity: [] });
        case 'get_my_provider_listing_id': return json(route, 1);
        case 'get_provider_services': return json(route, []);
        case 'get_provider_reviews': return json(route, { reviews: [], total_count: 0, average_rating: 0 });
        case 'get_admin_dashboard_stats': return json(route, { total_customers: 12, total_providers: 3, approved_providers: 2, total_bookings: state.bookings.length, bookings_by_status: {}, providers_by_status: { pending: 1 }, published_listings: 2 });
        case 'admin_approve_provider': state.pendingApp.verification_status = 'approved'; return json(route, null, 204);
        case 'admin_reject_provider': state.pendingApp.verification_status = 'rejected'; state.pendingApp.rejection_reason = body.reason; return json(route, null, 204);
        case 'get_admin_reviews': return json(route, { reviews: [], total_count: 0 });
        case 'submit_report': {
          if (!user) return json(route, { message: 'not_authenticated' }, 400);
          const r = { id: 'r' + (state.reports.length + 1), target_type: body.p_target_type, target_id: body.p_target_id, reason: body.p_reason, details: body.p_details, status: 'open', resolution_note: null, created_at: now(), reporter_id: user.id, reporter_name: user.name, reported_user_id: uid.provider, reported_name: 'Karim Benali', reported_account_status: 'active', content: null };
          state.reports.push(r); return json(route, r.id);
        }
        case 'admin_overview_stats': return json(route, { customers: 12, providers: 3, approved_providers: 2, pending_applications: 1, open_reports: state.reports.filter(r => r.status === 'open').length, suspended_accounts: 0, total_bookings: state.bookings.length, open_bookings: 1, bookings_7d: 2, bookings_30d: 3, completed_30d: 1, new_users_7d: 4, new_users_30d: 9, unpaid_completed: 0, paid_30d: {}, reviews: 2, daily: [{ day: '2026-10-01', bookings: 1, users: 2 }, { day: '2026-10-02', bookings: 2, users: 1 }] });
        case 'admin_list_users': return json(route, []);
        case 'admin_list_reports': return json(route, state.reports.filter(r => r.status === body.p_status));
        case 'admin_resolve_report': { const r = state.reports.find(x => x.id === body.p_id); r.status = body.p_status; return json(route, null, 204); }
        case 'delete_my_account': {
          if (!user) return json(route, { message: 'not_authenticated' }, 400);
          if (user.role === 'admin') return json(route, { message: 'admin_cannot_delete' }, 400);
          if (state.bookings.some(b => (b.customer_id === user.id || b.provider_id === user.id) && ['pending', 'accepted', 'in_progress'].includes(b.status))) return json(route, { message: 'active_bookings' }, 400);
          state.deleted.push(user.id); const email = state.token.get((req.headers()['authorization'] || '').replace('Bearer ', '')); delete users[email]; return json(route, null, 204);
        }
        default: state.log.push('UNMOCKED RPC ' + fn); return json(route, null);
      }
    }
    if (path === '/rest/v1/profiles') {
      const idEq = u.searchParams.get('id');
      if (req.method() === 'PATCH') return rows([profileFor(user)]);
      if (idEq?.startsWith('eq.')) { const found = Object.values(users).find(x => x.id === idEq.slice(3)); return rows(found ? [profileFor(found)] : []); }
      if (idEq?.startsWith('in.')) return json(route, Object.values(users).map(x => ({ id: x.id, full_name: x.name, phone: '+212600000000', city: 'Casablanca', account_status: 'active' })));
      return json(route, Object.values(users).filter(x => x.role !== 'admin').map(profileFor));
    }
    if (path === '/rest/v1/provider_profiles') {
      if (u.searchParams.get('verification_status')) return json(route, u.searchParams.get('verification_status') === 'eq.pending' && state.pendingApp.verification_status === 'pending' ? [state.pendingApp] : []);
      const id = (u.searchParams.get('id') || '').replace('eq.', '');
      return rows(state.providerProfiles[id] ? [state.providerProfiles[id]] : []);
    }
    if (path === '/rest/v1/provider_documents') return json(route, req.method() === 'GET' ? state.docs : []);
    if (path === '/rest/v1/bookings') { const sel = state.bookings.filter(b => !user || user.role === 'admin' || b.customer_id === user.id || b.provider_id === user.id); const id = (u.searchParams.get('id') || '').replace('eq.', ''); return rows(id ? sel.filter(b => b.id === id) : [...sel].reverse()); }
    if (path === '/rest/v1/reviews') return json(route, []);
    if (path === '/rest/v1/customer_favorites') { if (req.method() === 'POST') { state.favorites.push(body.provider_listing_id); return json(route, null, 201); } if (req.method() === 'DELETE') { state.favorites = []; return json(route, null, 204); } return json(route, state.favorites.map(i => ({ provider_listing_id: i }))); }
    if (path === '/rest/v1/provider_services') return json(route, []);
    if (path === '/rest/v1/admin_audit_log') return json(route, []);
    if (path.startsWith('/storage/')) return json(route, []);
    state.log.push('UNMOCKED ' + req.method() + ' ' + path);
    return json(route, []);
  }
  return { state, handleWorker, handleSupabase, uid };
}
