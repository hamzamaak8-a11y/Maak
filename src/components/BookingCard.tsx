import React from 'react';
import { Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLanguage } from '../contexts/LanguageContext';
import { useTheme } from '../contexts/ThemeContext';
import { Card, Row, StatusBadge } from './ui';

const STRIPE: Record<string, 'warning' | 'info' | 'primary' | 'success' | 'error' | 'textMuted'> = { pending: 'warning', accepted: 'info', in_progress: 'primary', completed: 'success', rejected: 'error', cancelled: 'textMuted' };
import { formatDateTime, formatMoney } from '../lib/format';
import type { Booking, Provider } from '../types';

export function BookingCard({ booking, providerMap, viewer, onPress }: { booking: Booking; providerMap?: Map<number, Provider>; viewer: 'customer' | 'provider'; onPress: () => void }) {
  const { colors } = useTheme();
  const { t, lang } = useLanguage();
  const counterpart = viewer === 'provider'
    ? booking.customer_name || t('booking.customer')
    : (booking.provider_listing_id != null ? providerMap?.get(booking.provider_listing_id)?.name : undefined) || t('booking.provider');
  return (
    <Card onPress={onPress} style={{ gap: 12, borderStartWidth: 5, borderStartColor: colors[STRIPE[booking.status] ?? 'textMuted'] }}>
      <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text numberOfLines={1} style={{ color: colors.text, fontSize: 18, fontWeight: '800' }}>{booking.service_category}</Text>
          <Text numberOfLines={1} style={{ color: colors.textSecondary, fontSize: 14 }}>{counterpart}</Text>
        </View>
        <StatusBadge status={booking.status} />
      </Row>
      <Row gap={6}><Ionicons name="calendar-outline" size={15} color={colors.textMuted} /><Text style={{ color: colors.textSecondary, fontSize: 14 }}>{formatDateTime(booking.service_date, lang)}</Text></Row>
      {booking.location_text ? <Row gap={6}><Ionicons name="location-outline" size={15} color={colors.textMuted} /><Text numberOfLines={1} style={{ color: colors.textSecondary, fontSize: 14, flex: 1 }}>{booking.location_text}</Text></Row> : null}
      {booking.price != null ? <Text style={{ color: colors.primary, fontWeight: '800' }}>{formatMoney(booking.price, booking.currency, lang)}</Text> : null}
    </Card>
  );
}
