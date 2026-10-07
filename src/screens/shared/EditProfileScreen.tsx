import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { useToast } from '../../contexts/ToastContext';
import { updateProfile } from '../../api/profile';
import { Banner, Button, Form, Header, Page, Screen, TextField } from '../../components/ui';
import { errorKey } from '../../lib/errors';
import type { ScreenProps } from '../../navigation/types';

export function EditProfileScreen({ navigation }: ScreenProps<'EditProfile'>) {
  const { t } = useLanguage();
  const { user, profile, refresh } = useAuth();
  const toast = useToast();
  const [name, setName] = useState(profile?.full_name ?? '');
  const [phone, setPhone] = useState(profile?.phone ?? '');
  const [city, setCity] = useState(profile?.city ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    if (!user) return;
    setError(null);
    if (name.trim().length < 2) { setError(t('auth.nameRequired')); return; }
    if (phone.trim() && !/^[0-9+\s-]{8,15}$/.test(phone.trim())) { setError(t('profile.phoneInvalid')); return; }
    setBusy(true);
    try { await updateProfile(user.id, { full_name: name, phone, city }); await refresh(); toast.show(t('common.saved'), 'success'); navigation.goBack(); }
    catch (e) { setError(t(errorKey(e))); } finally { setBusy(false); }
  };

  return (
    <Screen>
      <Header title={t('profile.edit')} />
      <Form>
        <Page contentStyle={{ gap: 14 }}>
          {error ? <Banner kind="error" text={error} /> : null}
          <TextField label={t('auth.fullName')} icon="person-outline" value={name} onChangeText={setName} />
          <TextField label={t('auth.email')} icon="mail-outline" value={user?.email ?? ''} editable={false} />
          <TextField label={t('profile.phone')} icon="call-outline" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
          <TextField label={t('provider.city')} icon="location-outline" value={city} onChangeText={setCity} />
          <Button title={t('common.save')} onPress={save} loading={busy} />
        </Page>
      </Form>
    </Screen>
  );
}
