import React, { useState } from 'react';
import { Switch, Text, View } from 'react-native';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { useTheme } from '../../contexts/ThemeContext';
import { useToast } from '../../contexts/ToastContext';
import { updateMarketplaceProfile } from '../../api/provider';
import { invalidateProviders } from '../../api/providers';
import { Banner, Button, Chip, Form, Header, Label, Muted, Page, Row, Screen, TextField } from '../../components/ui';
import { SERVICE_SUGGESTIONS } from '../../constants/categories';
import { errorKey } from '../../lib/errors';
import type { ScreenProps } from '../../navigation/types';

export function ProviderMarketplaceScreen({ navigation }: ScreenProps<'ProviderMarketplace'>) {
  const { colors } = useTheme();
  const { t } = useLanguage();
  const { providerProfile, refresh } = useAuth();
  const toast = useToast();
  const [services, setServices] = useState<string[]>(providerProfile?.services ?? []);
  const [draft, setDraft] = useState('');
  const [price, setPrice] = useState(providerProfile?.price_from != null ? String(providerProfile.price_from) : '');
  const [radius, setRadius] = useState(providerProfile?.service_radius_km != null ? String(providerProfile.service_radius_km) : '');
  const [photoPublic, setPhotoPublic] = useState(providerProfile?.profile_photo_public ?? false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const add = (s: string) => { const v = s.trim(); if (v && !services.includes(v) && services.length < 15) setServices([...services, v]); setDraft(''); };

  const save = async () => {
    setError(null);
    if (services.length === 0) { setError(t('application.servicesRequired')); return; }
    if (price.trim() && !(Number(price) >= 0)) { setError(t('application.priceInvalid')); return; }
    if (radius.trim() && !(Number(radius) > 0)) { setError(t('application.radiusInvalid')); return; }
    setBusy(true);
    try {
      await updateMarketplaceProfile({ services, priceFrom: price.trim() ? Number(price) : null, radiusKm: radius.trim() ? Math.round(Number(radius)) : null, photoPublic });
      invalidateProviders();
      await refresh();
      toast.show(t('common.saved'), 'success');
      navigation.goBack();
    } catch (e) { setError(t(errorKey(e))); } finally { setBusy(false); }
  };

  return (
    <Screen>
      <Header title={t('provider.marketplaceProfile')} />
      <Form>
        <Page contentStyle={{ gap: 14 }}>
          <Muted>{t('marketplace.hint')}</Muted>
          {error ? <Banner kind="error" text={error} /> : null}
          <View style={{ gap: 8 }}>
            <Label>{t('application.services')}</Label>
            <Row style={{ flexWrap: 'wrap' }}>{services.map(s => <Chip key={s} label={`${s}  ✕`} selected onPress={() => setServices(services.filter(x => x !== s))} />)}</Row>
            <TextField value={draft} onChangeText={setDraft} placeholder={t('application.servicePlaceholder')} onSubmitEditing={() => add(draft)} returnKeyType="done" />
            <Button title={t('common.add')} variant="secondary" size="sm" disabled={!draft.trim()} onPress={() => add(draft)} />
            <Row style={{ flexWrap: 'wrap' }}>{SERVICE_SUGGESTIONS.filter(s => !services.includes(s)).slice(0, 8).map(s => <Chip key={s} label={`+ ${s}`} onPress={() => add(s)} />)}</Row>
          </View>
          <TextField label={t('application.priceFrom')} value={price} onChangeText={setPrice} keyboardType="decimal-pad" />
          <TextField label={t('application.radius')} value={radius} onChangeText={setRadius} keyboardType="number-pad" />
          <Row style={{ justifyContent: 'space-between' }}>
            <Text style={{ color: colors.text, fontWeight: '700', flex: 1 }}>{t('marketplace.photoPublic')}</Text>
            <Switch value={photoPublic} onValueChange={setPhotoPublic} trackColor={{ true: colors.primary, false: colors.border }} />
          </Row>
          <Button title={t('common.save')} onPress={save} loading={busy} />
        </Page>
      </Form>
    </Screen>
  );
}
