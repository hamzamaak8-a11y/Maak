import React, { useState } from 'react';
import { Text, View } from 'react-native';
import { useLanguage } from '../../contexts/LanguageContext';
import { useTheme } from '../../contexts/ThemeContext';
import { useToast } from '../../contexts/ToastContext';
import { CreatedUser, NewUser, createUser, createUsersBulk } from '../../api/adminOps';
import { Badge, Banner, Button, Card, Chip, Form, Header, Label, Muted, Page, Row, Screen, TextField } from '../../components/ui';
import { CATEGORIES, SERVICE_SUGGESTIONS } from '../../constants/categories';
import { copyText, parseCsv, saveTextFile, toCsv } from '../../lib/csv';
import { errorKey } from '../../lib/errors';
import { pickCsvText } from '../../lib/pick';
import type { ScreenProps } from '../../navigation/types';

const TEMPLATE = toCsv(
  ['email', 'full_name', 'phone', 'city', 'role', 'profession', 'category', 'services', 'bio', 'price_from', 'experience_years'],
  [
    { email: 'amina@example.com', full_name: 'Amina Lahrichi', phone: '+212600000001', city: 'Casablanca', role: 'customer' },
    { email: 'karim@example.com', full_name: 'Karim Benali', phone: '+212600000002', city: 'Casablanca', role: 'provider', profession: 'Plombier', category: 'سباكة', services: 'تسريب الماء;تركيب صنابير', bio: '10 ans d\'expérience', price_from: 150, experience_years: 10 },
  ],
);

function rowsToUsers(text: string): { users: NewUser[]; problems: string[] } {
  const rows = parseCsv(text);
  const problems: string[] = [];
  if (rows.length < 2) return { users: [], problems: ['empty'] };
  const head = rows[0].map(h => h.trim().toLowerCase());
  const col = (r: string[], name: string) => (r[head.indexOf(name)] ?? '').trim();
  const users: NewUser[] = [];
  rows.slice(1).forEach((r, i) => {
    const role = col(r, 'role').toLowerCase() === 'provider' ? 'provider' : 'customer';
    const u: NewUser = { email: col(r, 'email'), fullName: col(r, 'full_name'), phone: col(r, 'phone'), city: col(r, 'city'), role, mode: 'password' };
    if (role === 'provider') {
      u.provider = {
        profession: col(r, 'profession'), category: col(r, 'category'), bio: col(r, 'bio'),
        services: col(r, 'services').split(/[;|]/).map(s => s.trim()).filter(Boolean),
        priceFrom: col(r, 'price_from') ? Number(col(r, 'price_from')) : null, experienceYears: col(r, 'experience_years') ? Number(col(r, 'experience_years')) : null,
      };
    }
    if (!u.email) problems.push(`#${i + 2}`); else users.push(u);
  });
  return { users, problems };
}

export function AdminCreateUserScreen({ route }: ScreenProps<'AdminCreateUser'>) {
  const { colors } = useTheme();
  const { t, lang } = useLanguage();
  const toast = useToast();
  const [tab, setTab] = useState<'single' | 'csv'>(route.params?.mode ?? 'single');

  // single
  const [role, setRole] = useState<'customer' | 'provider'>('customer');
  const [mode, setMode] = useState<'password' | 'invite'>('password');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [city, setCity] = useState('');
  const [password, setPassword] = useState('');
  const [profession, setProfession] = useState('');
  const [category, setCategory] = useState('');
  const [bio, setBio] = useState('');
  const [services, setServices] = useState<string[]>([]);
  const [draft, setDraft] = useState('');
  const [price, setPrice] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<CreatedUser | null>(null);

  // csv
  const [csvUsers, setCsvUsers] = useState<NewUser[]>([]);
  const [csvProblems, setCsvProblems] = useState<string[]>([]);
  const [results, setResults] = useState<CreatedUser[] | null>(null);

  const addService = (s: string) => { const v = s.trim(); if (v && !services.includes(v) && services.length < 15) setServices([...services, v]); setDraft(''); };

  const submit = async () => {
    setError(null);
    if (fullName.trim().length < 2) { setError(t('auth.nameRequired')); return; }
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) { setError(t('auth.emailInvalid')); return; }
    if (mode === 'password' && password && password.length < 8) { setError(t('auth.passwordShort')); return; }
    if (role === 'provider' && (!profession.trim() || !category || !bio.trim() || services.length === 0)) { setError(t('admin.providerFieldsRequired')); return; }
    setBusy(true);
    try {
      const r = await createUser({
        email: email.trim(), fullName: fullName.trim(), phone: phone.trim(), city: city.trim(), role, mode, password: mode === 'password' ? password : undefined,
        provider: role === 'provider' ? { profession: profession.trim(), category, bio: bio.trim(), services, priceFrom: price.trim() ? Number(price) : null } : undefined,
      });
      setCreated(r);
    } catch (e) { setError(t(errorKey(e))); } finally { setBusy(false); }
  };

  const reset = () => { setCreated(null); setFullName(''); setEmail(''); setPhone(''); setCity(''); setPassword(''); setProfession(''); setCategory(''); setBio(''); setServices([]); setPrice(''); setError(null); };

  const pick = async () => {
    try {
      const text = await pickCsvText();
      if (!text) return;
      const { users, problems } = rowsToUsers(text);
      setCsvUsers(users); setCsvProblems(problems); setResults(null);
      if (users.length === 0) setError(t('admin.csvEmpty')); else setError(null);
    } catch (e) { setError(t(errorKey(e))); }
  };

  const runImport = async () => {
    setBusy(true); setError(null);
    try { setResults(await createUsersBulk(csvUsers)); }
    catch (e) { setError(t(errorKey(e))); } finally { setBusy(false); }
  };

  const okCount = results?.filter(r => r.ok).length ?? 0;

  return (
    <Screen>
      <Header title={t('admin.addUser')} />
      <Form>
        <Page>
          <Row>
            <Chip label={t('admin.addOne')} icon="person-add-outline" selected={tab === 'single'} onPress={() => setTab('single')} />
            <Chip label={t('admin.importCsv')} icon="cloud-upload-outline" selected={tab === 'csv'} onPress={() => setTab('csv')} />
          </Row>
          {error ? <Banner kind="error" text={error} /> : null}

          {tab === 'single' ? (
            created ? (
              <Card style={{ gap: 14 }}>
                <Banner kind="success" text={t('admin.userCreated')} />
                <Text style={{ color: colors.text, fontWeight: '800', fontSize: 17 }}>{created.email}</Text>
                {created.password ? (
                  <View style={{ gap: 8 }}>
                    <Banner kind="warning" text={t('admin.passwordShownOnce')} />
                    <Text selectable style={{ color: colors.text, fontSize: 22, fontWeight: '900', letterSpacing: 1 }}>{created.password}</Text>
                    <Button title={t('admin.copyCredentials')} icon="copy-outline" variant="secondary" onPress={async () => { await copyText(`${created.email}\n${created.password}`); toast.show(t('admin.copied'), 'success'); }} />
                  </View>
                ) : <Muted>{t('admin.inviteSent')}</Muted>}
                <Button title={t('admin.addAnother')} onPress={reset} />
              </Card>
            ) : (
              <Card style={{ gap: 16 }}>
                <Row>
                  <Chip label={t('auth.roleCustomer')} icon="person-outline" selected={role === 'customer'} onPress={() => setRole('customer')} />
                  <Chip label={t('auth.roleProvider')} icon="briefcase-outline" selected={role === 'provider'} onPress={() => setRole('provider')} />
                </Row>
                <TextField label={t('auth.fullName')} icon="person-outline" value={fullName} onChangeText={setFullName} />
                <TextField label={t('auth.email')} icon="mail-outline" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
                <TextField label={t('profile.phone')} icon="call-outline" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
                <TextField label={t('provider.city')} icon="location-outline" value={city} onChangeText={setCity} />
                {role === 'provider' ? (
                  <View style={{ gap: 14 }}>
                    <Banner kind="info" text={t('admin.providerDraftNote')} />
                    <TextField label={t('application.profession')} icon="briefcase-outline" value={profession} onChangeText={setProfession} />
                    <View><Label>{t('application.category')}</Label><Row style={{ flexWrap: 'wrap' }}>{CATEGORIES.map(c => <Chip key={c.value} label={c.label[lang]} icon={c.icon} selected={category === c.value} onPress={() => setCategory(c.value)} />)}</Row></View>
                    <TextField label={t('application.bio')} value={bio} onChangeText={setBio} multiline />
                    <View style={{ gap: 8 }}>
                      <Label>{t('application.services')}</Label>
                      <Row style={{ flexWrap: 'wrap' }}>{services.map(s => <Chip key={s} label={`${s}  ✕`} selected onPress={() => setServices(services.filter(x => x !== s))} />)}</Row>
                      <TextField value={draft} onChangeText={setDraft} placeholder={t('application.servicePlaceholder')} onSubmitEditing={() => addService(draft)} />
                      <Button title={t('common.add')} variant="secondary" size="sm" disabled={!draft.trim()} onPress={() => addService(draft)} />
                      <Row style={{ flexWrap: 'wrap' }}>{SERVICE_SUGGESTIONS.filter(s => !services.includes(s)).slice(0, 6).map(s => <Chip key={s} label={`+ ${s}`} onPress={() => addService(s)} />)}</Row>
                    </View>
                    <TextField label={t('application.priceFrom')} value={price} onChangeText={setPrice} keyboardType="decimal-pad" />
                  </View>
                ) : null}
                <View style={{ gap: 10 }}>
                  <Label>{t('admin.access')}</Label>
                  <Row style={{ flexWrap: 'wrap' }}>
                    <Chip label={t('admin.setPassword')} icon="key-outline" selected={mode === 'password'} onPress={() => setMode('password')} />
                    <Chip label={t('admin.sendInvite')} icon="mail-outline" selected={mode === 'invite'} onPress={() => setMode('invite')} />
                  </Row>
                  {mode === 'password' ? <TextField value={password} onChangeText={setPassword} placeholder={t('admin.passwordAuto')} autoCapitalize="none" secure /> : <Muted>{t('admin.inviteHint')}</Muted>}
                </View>
                <Button title={t('admin.createUser')} icon="person-add-outline" loading={busy} onPress={submit} />
              </Card>
            )
          ) : (
            <Card style={{ gap: 14 }}>
              <Muted>{t('admin.csvHelpDraft')}</Muted>
              <Row style={{ flexWrap: 'wrap' }}>
                <Button title={t('admin.csvTemplate')} icon="download-outline" variant="outline" size="sm" onPress={() => saveTextFile('maak-users-template.csv', TEMPLATE)} />
                <Button title={t('admin.csvChoose')} icon="document-attach-outline" size="sm" onPress={pick} />
              </Row>
              {csvUsers.length > 0 && !results ? (
                <>
                  <Banner kind="info" text={t('admin.csvReady', { n: csvUsers.length })} />
                  {csvProblems.length ? <Banner kind="warning" text={t('admin.csvSkipped', { rows: csvProblems.join(', ') })} /> : null}
                  {csvUsers.slice(0, 5).map(u => <Muted key={u.email}>{u.email} · {u.fullName} · {t(`admin.role.${u.role}` as never)}</Muted>)}
                  {csvUsers.length > 5 ? <Muted>…</Muted> : null}
                  <Button title={t('admin.csvImport', { n: csvUsers.length })} icon="cloud-upload-outline" loading={busy} onPress={runImport} />
                </>
              ) : null}
              {results ? (
                <View style={{ gap: 10 }}>
                  <Banner kind={okCount === results.length ? 'success' : 'warning'} text={t('admin.csvDone', { ok: okCount, total: results.length })} />
                  {results.map(r => (
                    <Row key={r.email} style={{ justifyContent: 'space-between' }}>
                      <Text numberOfLines={1} style={{ color: colors.text, flex: 1, fontSize: 14 }}>{r.email}</Text>
                      <Badge text={r.ok ? (r.status === 'draft' ? t('admin.createdDraft') : t('admin.created')) : t(errorKey(new Error(r.error ?? 'err.generic')))} tone={r.ok ? (r.status === 'draft' ? 'warning' : 'success') : 'error'} />
                    </Row>
                  ))}
                  <Banner kind="warning" text={t('admin.passwordShownOnce')} />
                  <Button title={t('admin.csvDownloadResults')} icon="download-outline" variant="secondary" onPress={() => saveTextFile('maak-import-results.csv', toCsv(['email', 'ok', 'password', 'error'], results as unknown as Array<Record<string, unknown>>))} />
                </View>
              ) : null}
            </Card>
          )}
        </Page>
      </Form>
    </Screen>
  );
}
