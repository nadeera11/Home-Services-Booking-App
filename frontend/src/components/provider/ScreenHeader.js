import React, { useRef, useState } from "react";
import { View, Text, Pressable, StyleSheet, Modal, ScrollView, ActivityIndicator } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from '@react-navigation/native';
import { useProviderData } from '../../context/ProviderContext';
import { bookingWhen } from '../../services/bookingService';
import { COLORS } from "../../constants/theme";

/** Provider bells share the persisted booking-notification feed. */
export const BellButton = ({ light = false }) => {
  const [open, setOpen] = useState(false), [busy, setBusy] = useState(false), lock = useRef(false);
  const navigation = useNavigation(), insets = useSafeAreaInsets();
  const { notifications, notificationError, notificationsLoading, loadNotifications, markRead } = useProviderData();
  const unread = notifications.filter(n => !n.readAt).length;
  async function view(n) {
    if (lock.current) return; lock.current = true; setBusy(true);
    const success = n.readAt || await markRead(n);
    lock.current = false; setBusy(false);
    if (success) { setOpen(false); navigation.navigate('Requests', { bookingId: n.bookingId, openRequest: new Date().getTime() }); }
  }
  return <>
    <Pressable onPress={() => { setOpen(true); void loadNotifications(); }} accessibilityRole="button" accessibilityLabel={'Notifications' + (unread ? `, ${unread} unread` : '')} style={[styles.bell, light && { backgroundColor: 'rgba(255,255,255,0.2)', borderWidth: 0 }]}><MaterialCommunityIcons name="bell-outline" size={22} color={light ? '#FFF' : COLORS.textPrimary} />{unread > 0 && <View style={[styles.dot, light && { backgroundColor: '#FFF' }]} />}</Pressable>
    <Modal visible={open} animationType="slide" onRequestClose={() => !busy && setOpen(false)}>
      <View style={{ flex: 1, backgroundColor: COLORS.background, paddingTop: insets.top }}>
        <View style={styles.header}><Text style={[styles.title, { flex: 1 }]}>Notifications</Text><Pressable accessibilityRole="button" accessibilityLabel="Close notifications" disabled={busy} onPress={() => setOpen(false)} style={styles.bell}><MaterialCommunityIcons name="close" size={24} /></Pressable></View>
        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 24 + insets.bottom, width: '100%', maxWidth: 680, alignSelf: 'center' }}>
          <Text style={styles.subtitle}>Booking updates · {unread} unread · Sri Lanka time</Text>
          {notificationsLoading && <ActivityIndicator accessibilityLabel="Loading notifications" color={COLORS.primary} />}
          {!!notificationError && <Text accessibilityRole="alert" style={{ color: '#B52636', marginVertical: 12 }}>{notificationError}</Text>}
          <Pressable accessibilityRole="button" disabled={notificationsLoading || busy} onPress={loadNotifications} style={styles.notification}><Text style={{ color: COLORS.primary, fontWeight: '700' }}>Refresh notifications</Text></Pressable>
          {!notificationsLoading && !notificationError && !notifications.length && <Text style={styles.subtitle}>No booking notifications yet.</Text>}
          {notifications.map(n => <Pressable key={n.id} accessibilityRole="button" accessibilityLabel={`${n.readAt ? 'Read' : 'Unread'}: ${n.message}, ${n.customerName}. Open job`} disabled={busy} onPress={() => view(n)} style={[styles.notification, !n.readAt && { borderColor: COLORS.primary }]}><Text style={{ color: COLORS.primary, fontWeight: '600' }}>{n.readAt ? 'Read' : 'Unread'}</Text><Text style={{ color: COLORS.textPrimary, fontWeight: '700', marginTop: 6 }}>{n.message}</Text><Text style={styles.subtitle}>{n.customerName} · {n.service}</Text><Text style={styles.subtitle}>{bookingWhen(n.createdAt)}</Text><Text style={{ color: COLORS.primary, marginTop: 10 }}>View job</Text></Pressable>)}
        </ScrollView>
      </View>
    </Modal>
  </>;
};

/**
 * Fixed white header used by the provider tabs.
 * `children` render on the right (buttons).
 */
const ScreenHeader = ({ title, subtitle, children }) => {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.header, { paddingTop: insets.top + 14 }]}>
      <View style={styles.text}>
        <Text style={styles.title}>
          {title}
        </Text>
        {!!subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
      </View>
      {children ? <View style={styles.actions}>{children}</View> : null}
    </View>
  );
};

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.secondary,
    paddingHorizontal: 20,
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.inputBorder,
  },
  text: { flex: 1, paddingRight: 12 },
  title: { fontSize: 22, fontWeight: "800", color: COLORS.textPrimary },
  subtitle: { fontSize: 13, color: COLORS.textMuted, marginTop: 4 },
  actions: { flexDirection: "row", alignItems: "center", gap: 10 },
  notification: { backgroundColor: "#FFF", borderRadius: 16, borderWidth: 1, borderColor: COLORS.inputBorder, padding: 16, marginTop: 12, minHeight: 48 },
  bell: {
    width: 48,
    height: 48,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: COLORS.inputBorder,
    backgroundColor: COLORS.secondary,
    alignItems: "center",
    justifyContent: "center",
  },
  dot: {
    position: "absolute",
    top: 9,
    right: 10,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.primary,
  },
  pressed: { opacity: 0.8 },
});

export default ScreenHeader;
