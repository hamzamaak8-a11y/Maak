import React, { useCallback, useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { useTheme } from '../../contexts/ThemeContext';
import { useToast } from '../../contexts/ToastContext';
import { DOC_RULES, DocType, deleteDocument, ensureProviderDraft, listMyDocuments, retryOrphanDocumentFiles, submitApplication, uploadDocument } from '../../api/provider';
import { Badge, Banner, Button, Card, Chip, ErrorState, Form, Header, Label, Loading, Muted, Page, Row, Screen, StatusBadge, TextField } from '../../components/ui';
import { CATEGORIES, SERVICE_SUGGESTIONS } from '../../constants/categories';
import { pickDocument, pickImage } from '../../lib/pick';
import { errorKey } from '../../lib/errors';
import type { ProviderDocument } from '../../types';
import type { ScreenProps } from '../../navigation/types';

const DOCS: DocType[] = ['national_id', 'profile_photo', 'professional_document'];

export function ProviderApplicationScreen({ navigation }: ScreenProps<'ProviderApplication'>) {
  const { colors } = useTheme();
  const { t, lang } = useLanguage();
  const { user, profile, providerProfile, refresh, clearIntent } = useAuth();
  const toast = useToast();
  const status = providerProfile?.verification_status;
  const editable = !status || status === 'draft' || status === 'rejected';

  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState<unknown>(null);
  const [docs, setDocs] = useState<ProviderDocument[]>([]);
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [fullName, setFullName] = useState(profile?.full_name ?? '');
  const [phone, setPhone] = useState(profile?.phone ?? '');
  const [city, setCity] = useState(profile?.city ?? '');
  const [profession, setProfession] = useState(providerProfile?.profession ?? '');
  const [category, setCategory] = useState(providerProfile?.service_category ?? '');
  const [years, setYears] = useState(providerProfile?.experience_years != null ? String(providerProfile.experience_years) : '');
  const [bio, setBio] = useState(providerProfile?.bio ?? '');
  const [services, setServices] = useState<string[]>(providerProfile?.services ?? []);
  const [serviceDraft, setServiceDraft] = useState('');
  const [price, setPrice] = useState(providerProfile?.price_from != null ? String(providerProfile.price_from) : '');
  const [radius, setRadius] = useState(providerProfile?.service_radius_km != null ? String(providerProfile.service_radius_km) : '');

  const load = useCallback(async () => {
    if (!user) return;
    setLoadError(null);
    try {
      if (editable) await ensureProviderDraft(user.id);
      void retryOrphanDocumentFiles();
      setDocs(await listMyDocuments(user.id));
      setReady(true);
    } catch (e) { setLoadError(e); }
  }, [user, editable]);

  useEffect(() => { void load(); }, [load]);

  if (!user) return <Screen><Header title={t('application.title')} /></Screen>;
  if (loadError && !ready) return <Screen><Header title={t('application.title')} /><ErrorState error={loadError} onRetry={load} /></Screen>;
  if (!ready) return <Screen><Header title={t('application.title')} /><Loading /></Screen>;

  /* ------------------------------ read-only states ------------------------------ */
  if (!editable) {
    const tone = status === 'approved' ? 'success' : status === 'suspended' ? 'error' : 'warning';
    return (
      <Screen>
        <Header title={t('application.title')} />
        <Page>
          <Card style={{ alignItems: 'center', gap: 10 }}>
            <Ionicons name={status === 'approved' ? 'shield-checkmark' : status === 'suspended' ? 'ban' : 'hourglass'} size={52} color={tone === 'success' ? colors.success : tone === 'error' ? colors.error : colors.warning} />
            <StatusBadge status={status!} />
            <Text style={{ color: colors.text, fontSize: 18, fontWeight: '900', textAlign: 'center' }}>{t(`application.${status}Title` as never)}</Text>
            <Muted style={{ textAlign: 'center' }}>{t(`application.${status}Text` as never)}</Muted>
          </Card>
          <Card style={{ gap: 10 }}>
            <Text style={{ color: colors.text, fontWeight: '800' }}>{t('application.documents')}</Text>
            {docs.map(d => <Row key={d.id} style={{ justifyContent: 'space-between' }}><Text style={{ color: colors.textSecondary }}>{t(`doc.${d.document_type}` as never)}</Text><StatusBadge status={d.status} /></Row>)}
          </Card>
          {status === 'approved' ? <Button title={t('application.enterProvider')} onPress={async () => { await refresh(); navigation.navigate('CustomerTabs'); }} /> : null}
        </Page>
      </Screen>
    );
  }

  /* ---------------------------------- the wizard ---------------------------------- */
  const hasDoc = (type: DocType) => docs.some(d => d.document_type === type && d.status !== 'rejected');
  const stepTitles = [t('application.stepPersonal'), t('application.stepWork'), t('application.stepDocs')];

  const addService = (s: string) => {
    const v = s.trim();
    if (v && !services.includes(v) && services.length < 15) setServices([...services, v]);
    setServiceDraft('');
  };

  const validateStep = (): string | null => {
    if (step === 0) {
      if (fullName.trim().length < 2) return t('auth.nameRequired');
      if (!/^[0-9+\s-]{8,15}$/.test(phone.trim())) return t('profile.phoneInvalid');
      if (!city.trim()) return t('application.cityRequired');
    }
    if (step === 1) {
      if (!profession.trim()) return t('application.professionRequired');
      if (!category) return t('application.categoryRequired');
      if (years.trim() && !/^\d{1,2}$/.test(years.trim())) return t('application.yearsInvalid');
      if (!bio.trim()) return t('application.bioRequired');
      if (services.length === 0) return t('application.servicesRequired');
      if (price.trim() && !(Number(price) >= 0)) return t('application.priceInvalid');
      if (radius.trim() && !(Number(radius) > 0)) return t('application.radiusInvalid');
    }
    if (step === 2 && !(hasDoc('national_id') && hasDoc('profile_photo'))) return t('err.documentsRequired');
    return null;
  };

  const next = async () => {
    const problem = validateStep();
    if (problem) { setError(problem); return; }
    setError(null);
    if (step < 2) { setStep(step + 1); return; }
    setBusy('submit');
    try {
      await submitApplication({
        fullName, phone, city, profession, category, bio, services,
        experienceYears: years.trim() ? Number(years) : null, priceFrom: price.trim() ? Number(price) : null, radiusKm: radius.trim() ? Number(radius) : null,
      });
      await clearIntent();
      await refresh();
      toast.show(t('application.submitted'), 'success');
    } catch (e) { setError(t(errorKey(e))); } finally { setBusy(null); }
  };

  const upload = async (type: DocType, source: 'image' | 'file') => {
    setError(null);
    try {
      const file = source === 'image' ? await pickImage() : await pickDocument();
      if (!file) return;
      setBusy(type);
      const row = await uploadDocument(user.id, type, file);
      setDocs(prev => [...prev.filter(d => d.document_type !== type || d.status === 'approved'), row]);
    } catch (e) { setError(t(errorKey(e))); } finally { setBusy(null); }
  };

  const remove = async (d: ProviderDocument) => {
    setBusy(d.id);
    try { await deleteDocument(d); setDocs(prev => prev.filter(x => x.id !== d.id)); }
    catch (e) {
      if (e instanceof Error && e.message === 'document_file_left') setDocs(prev => prev.filter(x => x.id !== d.id)); // the row is gone; only the file clean-up is still to do
      setError(t(errorKey(e)));
    } finally { setBusy(null); }
  };

  return (
    <Screen>
      <Header title={t('application.title')} onBack={() => (step > 0 ? setStep(step - 1) : navigation.goBack())} />
      <Form>
        <Page contentStyle={{ gap: 16 }}>
          <Row gap={6}>
            {stepTitles.map((l, i) => (
              <View key={l} style={{ flex: 1, gap: 4 }}>
                <View style={{ height: 4, borderRadius: 2, backgroundColor: i <= step ? colors.primary : colors.border }} />
                <Text numberOfLines={1} style={{ color: i === step ? colors.primary : colors.textMuted, fontSize: 12, fontWeight: '700' }}>{l}</Text>
              </View>
            ))}
          </Row>
          {status === 'rejected' && providerProfile?.rejection_reason ? <Banner kind="error" text={`${t('application.rejectedReason')}: ${providerProfile.rejection_reason}`} /> : null}
          {error ? <Banner kind="error" text={error} /> : null}

          {step === 0 ? (
            <View style={{ gap: 14 }}>
              <Muted>{t('application.introText')}</Muted>
              <TextField label={t('auth.fullName')} icon="person-outline" value={fullName} onChangeText={setFullName} />
              <TextField label={t('profile.phone')} icon="call-outline" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
              <TextField label={t('provider.city')} icon="location-outline" value={city} onChangeText={setCity} />
            </View>
          ) : null}

          {step === 1 ? (
            <View style={{ gap: 14 }}>
              <TextField label={t('application.profession')} icon="briefcase-outline" value={profession} onChangeText={setProfession} placeholder={t('application.professionPlaceholder')} />
              <View>
                <Label>{t('application.category')}</Label>
                <Row style={{ flexWrap: 'wrap' }}>{CATEGORIES.map(c => <Chip key={c.value} label={c.label[lang]} icon={c.icon} selected={category === c.value} onPress={() => setCategory(c.value)} />)}</Row>
              </View>
              <TextField label={t('application.years')} value={years} onChangeText={setYears} keyboardType="number-pad" maxLength={2} />
              <TextField label={t('application.bio')} value={bio} onChangeText={setBio} multiline placeholder={t('application.bioPlaceholder')} />
              <View style={{ gap: 8 }}>
                <Label>{t('application.services')}</Label>
                <Row style={{ flexWrap: 'wrap' }}>{services.map(s => <Chip key={s} label={`${s}  ✕`} selected onPress={() => setServices(services.filter(x => x !== s))} />)}</Row>
                <TextField value={serviceDraft} onChangeText={setServiceDraft} placeholder={t('application.servicePlaceholder')} onSubmitEditing={() => addService(serviceDraft)} returnKeyType="done" />
                <Button title={t('common.add')} variant="secondary" size="sm" onPress={() => addService(serviceDraft)} disabled={!serviceDraft.trim()} />
                <Row style={{ flexWrap: 'wrap' }}>{SERVICE_SUGGESTIONS.filter(s => !services.includes(s)).slice(0, 8).map(s => <Chip key={s} label={`+ ${s}`} onPress={() => addService(s)} />)}</Row>
              </View>
              <TextField label={t('application.priceFrom')} value={price} onChangeText={setPrice} keyboardType="decimal-pad" />
              <TextField label={t('application.radius')} value={radius} onChangeText={setRadius} keyboardType="number-pad" />
            </View>
          ) : null}

          {step === 2 ? (
            <View style={{ gap: 14 }}>
              <Muted>{t('application.docsText')}</Muted>
              {DOCS.map(type => {
                const mine = docs.filter(d => d.document_type === type);
                const accepts = DOC_RULES[type].mime;
                return (
                  <Card key={type} style={{ gap: 10 }}>
                    <Row style={{ justifyContent: 'space-between' }}>
                      <Text style={{ color: colors.text, fontWeight: '800', flex: 1 }}>{t(`doc.${type}` as never)}</Text>
                      <Badge text={DOC_RULES[type].required ? t('application.required') : t('application.optional')} tone={DOC_RULES[type].required ? 'warning' : 'neutral'} />
                    </Row>
                    {mine.map(d => (
                      <Row key={d.id} style={{ justifyContent: 'space-between' }}>
                        <StatusBadge status={d.status} />
                        {d.status === 'pending' ? <Button title={t('common.remove')} variant="ghost" size="sm" loading={busy === d.id} onPress={() => remove(d)} /> : null}
                      </Row>
                    ))}
                    {mine.length === 0 || mine.every(d => d.status === 'rejected') ? (
                      <Row gap={8} style={{ flexWrap: 'wrap' }}>
                        <Button title={t('application.pickImage')} icon="image-outline" variant="secondary" size="sm" loading={busy === type} onPress={() => upload(type, 'image')} />
                        {accepts.includes('application/pdf') ? <Button title={t('application.pickPdf')} icon="document-outline" variant="secondary" size="sm" onPress={() => upload(type, 'file')} /> : null}
                      </Row>
                    ) : null}
                  </Card>
                );
              })}
              <Banner kind="info" text={t('application.docsPrivacy')} />
            </View>
          ) : null}

          <Button title={step === 2 ? t('application.submit') : t('common.next')} onPress={next} loading={busy === 'submit'} />
        </Page>
      </Form>
    </Screen>
  );
}
