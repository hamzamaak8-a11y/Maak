import React from 'react';
import { FlatList, Text } from 'react-native';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { useTheme } from '../../contexts/ThemeContext';
import { getProviderReviews } from '../../api/reviews';
import { Card, EmptyState, ErrorState, Header, Loading, Muted, Row, Screen, Stars, useAsync } from '../../components/ui';
import { formatDate } from '../../lib/format';

export function ProviderReviewsScreen() {
  const { colors } = useTheme();
  const { t, lang } = useLanguage();
  const { user } = useAuth();
  const { data, loading, error, reload } = useAsync(() => (user ? getProviderReviews(user.id, 50, 0) : Promise.resolve(null)), [user?.id]);
  return (
    <Screen>
      <Header title={t('provider.myReviews')} />
      {loading && !data ? <Loading /> : error && !data ? <ErrorState error={error} onRetry={reload} /> : (
        <FlatList
          data={data?.reviews ?? []}
          keyExtractor={r => r.id}
          contentContainerStyle={{ padding: 16, gap: 12, width: '100%', maxWidth: 720, alignSelf: 'center' }}
          ListHeaderComponent={data && data.total_count > 0 ? <Card style={{ alignItems: 'center', gap: 6 }}><Text style={{ color: colors.text, fontSize: 34, fontWeight: '900' }}>{data.average_rating.toFixed(1)}</Text><Stars value={data.average_rating} size={18} /><Muted>{t('reviews.count', { n: data.total_count })}</Muted></Card> : null}
          ListEmptyComponent={<EmptyState icon="star-outline" title={t('reviews.providerEmpty')} text={t('reviews.providerEmptyText')} />}
          renderItem={({ item }) => (
            <Card style={{ gap: 8 }}>
              <Row style={{ justifyContent: 'space-between' }}><Stars value={item.rating} /><Muted>{formatDate(item.created_at, lang)}</Muted></Row>
              {item.comment ? <Text style={{ color: colors.text, lineHeight: 21 }}>{item.comment}</Text> : null}
            </Card>
          )}
        />
      )}
    </Screen>
  );
}
