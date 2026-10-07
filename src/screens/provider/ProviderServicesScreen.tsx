import React, { useState } from 'react';
import { Text, View } from 'react-native';
import { useLanguage } from '../../contexts/LanguageContext';
import { useTheme } from '../../contexts/ThemeContext';
import { useToast } from '../../contexts/ToastContext';
import { addService, deleteService, listMyServices, updateService } from '../../api/provider';
import { Badge, Banner, Button, Card, Chip, EmptyState, ErrorState, Header, IconButton, Loading, Muted, Page, Row, Screen, Sheet, TextField, useAsync } from '../../components/ui';
import { formatMoney } from '../../lib/format';
import { errorKey } from '../../lib/errors';
import type { ProviderService } from '../../types';

type Draft = { id: string | null; name: string; description: string; price: string; currency: string; duration: string; active: boolean };
const EMPTY: Draft = { id: null, name: '', description: '', price: '', currency: 'MAD', duration: '', active: true };

export function ProviderServicesScreen({ embedded }: { embedded?: boolean }) {
  const { colors } = useTheme();
  const { t, lang } = useLanguage();
  const toast = useToast();
  const { data, setData, loading, error, reload } = useAsync(() => listMyServices(), []);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const open = (s?: ProviderService) => { setFormError(null); setDraft(s ? { id: s.id, name: s.name, description: s.description ?? '', price: s.price != null ? String(s.price) : '', currency: s.currency, duration: s.duration_minutes ? String(s.duration_minutes) : '', active: s.is_active } : EMPTY); };

  const save = async () => {
    if (!draft) return;
    if (!draft.name.trim()) { setFormError(t('services.nameRequired')); return; }
    const price = draft.price.trim() ? Number(draft.price.replace(',', '.')) : null;
    if (price != null && (!Number.isFinite(price) || price < 0)) { setFormError(t('err.invalidPrice')); return; }
    const duration = draft.duration.trim() ? Number(draft.duration) : null;
    if (duration != null && (!Number.isInteger(duration) || duration <= 0)) { setFormError(t('services.durationInvalid')); return; }
    setBusy(true); setFormError(null);
    try {
      const input = { name: draft.name, description: draft.description, price, currency: draft.currency, durationMinutes: duration, isActive: draft.active };
      const row = draft.id ? await updateService(draft.id, input) : await addService(input);
      setData(prev => (draft.id ? (prev ?? []).map(s => (s.id === row.id ? row : s)) : [...(prev ?? []), row]));
      setDraft(null);
      toast.show(t('common.saved'), 'success');
    } catch (e) { setFormError(t(errorKey(e))); } finally { setBusy(false); }
  };

  const remove = async () => {
    if (!draft?.id) return;
    setBusy(true);
    try { await deleteService(draft.id); setData(prev => (prev ?? []).filter(s => s.id !== draft.id)); setDraft(null); }
    catch (e) { setFormError(t(errorKey(e))); } finally { setBusy(false); }
  };

  return (
    <Screen>
      <Header title={t('services.title')} noBack={embedded} right={<IconButton icon="add" onPress={() => open()} label={t('common.add')} />} />
      {loading && !data ? <Loading /> : error && !data ? <ErrorState error={error} onRetry={reload} /> : (
        <Page>
          <Banner kind="info" text={t('services.hint')} />
          {(data ?? []).length === 0 ? <EmptyState icon="construct-outline" title={t('services.empty')} text={t('services.emptyText')} action={<Button title={t('services.add')} onPress={() => open()} />} /> : (data ?? []).map(s => (
            <Card key={s.id} onPress={() => open(s)} style={{ gap: 6 }}>
              <Row style={{ justifyContent: 'space-between' }}>
                <Text style={{ color: colors.text, fontWeight: '800', fontSize: 16, flex: 1 }}>{s.name}</Text>
                <Badge text={s.is_active ? t('services.active') : t('services.inactive')} tone={s.is_active ? 'success' : 'neutral'} />
              </Row>
              {s.description ? <Muted numberOfLines={2}>{s.description}</Muted> : null}
              <Row gap={14}>
                {s.price != null ? <Text style={{ color: colors.primary, fontWeight: '800' }}>{formatMoney(s.price, s.currency, lang)}</Text> : null}
                {s.duration_minutes ? <Muted>{t('services.minutes', { n: s.duration_minutes })}</Muted> : null}
              </Row>
            </Card>
          ))}
        </Page>
      )}
      <Sheet visible={!!draft} onClose={() => setDraft(null)} title={draft?.id ? t('services.edit') : t('services.add')}>
        {draft ? (
          <View style={{ gap: 14 }}>
            {formError ? <Banner kind="error" text={formError} /> : null}
            <TextField label={t('services.name')} value={draft.name} onChangeText={v => setDraft({ ...draft, name: v })} />
            <TextField label={t('services.description')} value={draft.description} onChangeText={v => setDraft({ ...draft, description: v })} multiline />
            <Row gap={10}>
              <TextField style={{ flex: 2 }} label={t('booking.price')} value={draft.price} onChangeText={v => setDraft({ ...draft, price: v })} keyboardType="decimal-pad" />
              <TextField style={{ flex: 1 }} label={t('provider.currency')} value={draft.currency} onChangeText={v => setDraft({ ...draft, currency: v.toUpperCase() })} maxLength={3} autoCapitalize="characters" />
            </Row>
            <TextField label={t('services.duration')} value={draft.duration} onChangeText={v => setDraft({ ...draft, duration: v })} keyboardType="number-pad" />
            <Row><Chip label={t('services.active')} selected={draft.active} onPress={() => setDraft({ ...draft, active: !draft.active })} /></Row>
            <Button title={t('common.save')} onPress={save} loading={busy} />
            {draft.id ? <Button title={t('common.delete')} variant="danger" onPress={remove} disabled={busy} /> : null}
          </View>
        ) : null}
      </Sheet>
    </Screen>
  );
}
