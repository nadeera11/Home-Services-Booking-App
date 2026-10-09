import React from 'react';
import { View, StyleSheet } from 'react-native';
import ScreenHeader from '../../components/provider/ScreenHeader';
import MessagesScreen from '../customer/MessagesScreen';
import { COLORS } from '../../constants/theme';

// Reuse the existing booking chat and its ownership, retry and draft handling.
export default function ProviderMessagesScreen({ route }) {
  return <View style={styles.screen}><ScreenHeader title="Messages" subtitle="Booking conversations" /><MessagesScreen embedded bookingId={route?.params?.bookingId} openRequest={route?.params?.openRequest} /></View>;
}
const styles = StyleSheet.create({ screen: { flex: 1, backgroundColor: COLORS.background } });
