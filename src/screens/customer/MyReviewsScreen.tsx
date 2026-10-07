import React from 'react';
import { FlatList, Text } from 'react-native';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { useTheme } from '../../contexts/ThemeContext';
import { listMyReviews } from '../../api/reviews';
import { Card, EmptyState, ErrorState, Header, Loading, Muted, Row, Screen, Stars, useAsync } from '../../components/ui';
import { LoginRequired } from '../../components/Common';
import { formatDate } from '../../lib/format';

export function MyReviewsScreen() {
  const { colors } = useTheme();
  const { t, lang } = useLanguage();
  const { user } = useAuth();
  const { data, loading, error, reload } = useAsync(() => (user ? listMyReviews(user.id) : Promise.resolve([])), [user?.id]);
  if (!user) return <Screen><Header title={t('reviews.mine')} /><LoginRequired icon="star-outline" /></Screen>;
  return (
    <Screen>
      <Header title={t('reviews.mine')} />
      {loading && !data ? <Loading /> : error && !data ? <ErrorState error={error} onRetry={reload} /> : (
        <FlatList
          data={data ?? []}
          keyExtractor={r => r.id}
          contentContainerStyle={{ padding: 16, gap: 12, width: '100%', maxWidth: 720, alignSelf: 'center' }}
          ListEmptyComponent={<EmptyState icon="star-outline" title={t('reviews.empty')} text={t('reviews.emptyText')} />}
          renderItem={({ item }) => (
            <Card style={{ gap: 8 }}>
              <Row style={{ justifyContent: 'space-between' }}><Stars value={item.rating} /><Muted>{formatDate(item.created_at, lang)}</Muted></Row>
              {item.comment ? <Text style={{ color: colors.text, lineHeight: 21 }}>{item.comment}</Text> : null}
              {item.is_hidden ? <Muted>{t('reviews.hidden')}</Muted> : null}
            </Card>
          )}
        />
      )}
    </Screen>
  );
}
