import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { useTheme } from '../../contexts/ThemeContext';
import { useToast } from '../../contexts/ToastContext';
import { addPortfolioImage, deletePortfolioImage, listMyPortfolio } from '../../api/provider';
import { invalidateProviders } from '../../api/providers';
import { Banner, Button, EmptyState, ErrorState, Header, Loading, Page, Row, Screen, useAsync } from '../../components/ui';
import { pickImages } from '../../lib/pick';
import { errorKey } from '../../lib/errors';
import { Image } from 'react-native';

export const MAX_PHOTOS = 12;

export function ProviderPortfolioScreen() {
  const { colors } = useTheme();
  const { t } = useLanguage();
  const { user } = useAuth();
  const toast = useToast();
  const { data, loading, error, reload } = useAsync(() => (user ? listMyPortfolio(user.id) : Promise.resolve([])), [user?.id]);
  const [busy, setBusy] = useState<string | null>(null);
  const count = data?.length ?? 0;
  const room = MAX_PHOTOS - count;

  const add = async () => {
    if (!user) return;
    if (room <= 0) { toast.show(t('portfolio.full', { n: MAX_PHOTOS }), 'error'); return; }
    try {
      const files = await pickImages(room);
      if (!files.length) return;
      setBusy('add');
      for (const f of files) await addPortfolioImage(user.id, f);
      invalidateProviders();
      await reload();
    } catch (e) { toast.show(t(errorKey(e)), 'error'); await reload().catch(() => {}); } finally { setBusy(null); }
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
          <Banner kind="info" text={t('portfolio.limit', { n: MAX_PHOTOS })} />
          <Row style={{ justifyContent: 'space-between' }}>
            <Text style={{ color: colors.textSecondary, fontWeight: '700' }}>{t('portfolio.count', { n: count, max: MAX_PHOTOS })}</Text>
          </Row>
          <Button title={t('portfolio.addMany')} icon="images" gradient loading={busy === 'add'} disabled={room <= 0} onPress={add} />
          {count === 0 ? <EmptyState icon="images-outline" title={t('portfolio.empty')} text={t('portfolio.hint')} /> : (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
              {(data ?? []).map((img, i) => (
                <View key={img.path} style={{ width: i === 0 ? '100%' : '48.5%', aspectRatio: i === 0 ? 1.6 : 1.25, borderRadius: 20, overflow: 'hidden', backgroundColor: colors.surfaceAlt }}>
                  <Image source={{ uri: img.url }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                  {i === 0 ? <View style={{ position: 'absolute', top: 10, start: 10, backgroundColor: colors.accent, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 99 }}><Text style={{ color: '#fff', fontSize: 12, fontWeight: '800' }}>{t('portfolio.cover')}</Text></View> : null}
                  <Pressable onPress={() => remove(img.path)} disabled={busy === img.path} accessibilityLabel={t('common.delete')} style={{ position: 'absolute', top: 8, end: 8, width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name="trash-outline" size={18} color="#fff" />
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
