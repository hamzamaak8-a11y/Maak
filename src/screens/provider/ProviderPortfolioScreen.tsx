import React, { useState } from 'react';
import { Image, Pressable, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { useTheme } from '../../contexts/ThemeContext';
import { useToast } from '../../contexts/ToastContext';
import { addPortfolioImage, deletePortfolioImage, listMyPortfolio } from '../../api/provider';
import { invalidateProviders } from '../../api/providers';
import { Banner, Button, EmptyState, ErrorState, Header, Loading, Page, Screen, useAsync } from '../../components/ui';
import { pickImage } from '../../lib/pick';
import { errorKey } from '../../lib/errors';

export function ProviderPortfolioScreen() {
  const { colors } = useTheme();
  const { t } = useLanguage();
  const { user } = useAuth();
  const toast = useToast();
  const { data, loading, error, reload } = useAsync(() => (user ? listMyPortfolio(user.id) : Promise.resolve([])), [user?.id]);
  const [busy, setBusy] = useState<string | null>(null);

  const add = async () => {
    if (!user) return;
    try {
      const file = await pickImage();
      if (!file) return;
      setBusy('add');
      await addPortfolioImage(user.id, file);
      invalidateProviders();
      await reload();
    } catch (e) { toast.show(t(errorKey(e)), 'error'); } finally { setBusy(null); }
  };

  const remove = async (path: string) => {
    setBusy(path);
    try { await deletePortfolioImage(path); invalidateProviders(); await reload(); }
    catch (e) { toast.show(t(errorKey(e)), 'error'); } finally { setBusy(null); }
  };

  return (
    <Screen>
      <Header title={t('provider.portfolio')} />
      {loading && !data ? <Loading /> : error && !data ? <ErrorState error={error} onRetry={reload} /> : (
        <Page>
          <Banner kind="info" text={t('portfolio.hint')} />
          <Button title={t('portfolio.add')} icon="add" loading={busy === 'add'} onPress={add} />
          {(data ?? []).length === 0 ? <EmptyState icon="images-outline" title={t('portfolio.empty')} /> : (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
              {(data ?? []).map(img => (
                <View key={img.path} style={{ width: '48%', aspectRatio: 1.2, borderRadius: 14, overflow: 'hidden', backgroundColor: colors.surfaceAlt }}>
                  <Image source={{ uri: img.url }} style={{ width: '100%', height: '100%' }} />
                  <Pressable onPress={() => remove(img.path)} disabled={busy === img.path} style={{ position: 'absolute', top: 6, end: 6, width: 32, height: 32, borderRadius: 16, backgroundColor: colors.overlay, alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name="trash-outline" size={17} color="#fff" />
                  </Pressable>
                </View>
              ))}
            </View>
          )}
        </Page>
      )}
    </Screen>
  );
}
