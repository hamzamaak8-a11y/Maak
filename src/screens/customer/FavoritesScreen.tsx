import React from 'react';
import { FlatList } from 'react-native';
import { useAuth } from '../../contexts/AuthContext';
import { useFavorites } from '../../contexts/FavoritesContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { useToast } from '../../contexts/ToastContext';
import { fetchProviders } from '../../api/providers';
import { LoginRequired, ProviderCard } from '../../components/Common';
import { EmptyState, ErrorState, Header, Loading, Screen, useAsync } from '../../components/ui';
import { errorKey } from '../../lib/errors';
import type { ScreenProps } from '../../navigation/types';

export function FavoritesScreen({ navigation }: ScreenProps<'Favorites'>) {
  const { t } = useLanguage();
  const { user } = useAuth();
  const fav = useFavorites();
  const toast = useToast();
  const { data, loading, error, reload } = useAsync(() => fetchProviders(), []);
  if (!user) return <Screen><Header title={t('favorites.title')} /><LoginRequired icon="heart-outline" /></Screen>;
  const list = (data ?? []).filter(p => fav.ids.has(p.id));
  return (
    <Screen>
      <Header title={t('favorites.title')} />
      {loading && !data ? <Loading /> : error && !data ? <ErrorState error={error} onRetry={reload} /> : (
        <FlatList
          data={list}
          keyExtractor={p => String(p.id)}
          contentContainerStyle={{ padding: 16, gap: 12, width: '100%', maxWidth: 720, alignSelf: 'center' }}
          ListEmptyComponent={<EmptyState icon="heart-outline" title={t('favorites.empty')} text={t('favorites.emptyText')} />}
          renderItem={({ item }) => <ProviderCard provider={item} favorite onPress={() => navigation.navigate('ProviderDetail', { id: item.id })} onToggleFavorite={() => fav.toggle(item.id).catch(e => toast.show(t(errorKey(e)), 'error'))} />}
        />
      )}
    </Screen>
  );
}
