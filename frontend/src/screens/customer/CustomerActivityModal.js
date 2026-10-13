import React, { useEffect, useRef, useState } from 'react';
import { Modal, View, Text, Pressable, ScrollView, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import api from '../../services/api';
import { getProvider } from '../../services/providerService';
import ProviderProfileModal from './ProviderProfileModal';
const button = { padding: 14, minHeight: 48, borderRadius: 12, backgroundColor: '#EEE8FF', marginVertical: 5 };
export default function CustomerActivityModal({ mode, onClose, navigation }) {
 const insets = useSafeAreaInsets();
 const lock = useRef(false);
 const [items, setItems] = useState([]), [loading, setLoading] = useState(true), [error, setError] = useState(''), [retry, setRetry] = useState(0), [provider, setProvider] = useState(null), [busy, setBusy] = useState(false);
 useEffect(() => {
  const controller = new AbortController();
  Promise.resolve().then(() => { if (!controller.signal.aborted) { setLoading(true); setError(''); } });
  api.get('/auth/' + mode, { signal: controller.signal }).then(r => { if (!controller.signal.aborted) setItems(r.data[mode === 'bookmarks' ? 'providers' : 'notifications']); }).catch(() => { if (!controller.signal.aborted) setError('Unable to load. Check your connection and retry.'); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
  return () => controller.abort();
 }, [mode, retry]);
 async function open(item) {
  if (lock.current) return; lock.current = true; setBusy(true); setError('');
  try {
   if (mode === 'bookmarks') setProvider(await getProvider(item.id));
   else { await api.patch('/auth/notifications/' + encodeURIComponent(item.id) + '/read'); onClose(); navigation.navigate('Bookings', { bookingId: item.bookingId }); }
  } catch { setError('Unable to open this item. It may no longer be available. Refresh and try again.'); }
  finally { lock.current = false; setBusy(false); }
 }
 const back = () => { setProvider(null); setRetry(v => v + 1); };
 return <Modal visible animationType="slide" onRequestClose={provider ? back : onClose}>
  {provider ? <ProviderProfileModal visible provider={provider} onClose={back} onTrackBookings={() => { onClose(); navigation.navigate('Bookings'); }} /> : <View style={{ flex: 1, backgroundColor: '#F9F8FE', paddingTop: insets.top, paddingHorizontal: 20 }}>
   <Pressable accessibilityRole="button" onPress={onClose} style={button}><Text>Back to Home</Text></Pressable>
   <Text accessibilityRole="header" style={{ fontSize: 24, fontWeight: '700', marginVertical: 15 }}>{mode === 'bookmarks' ? 'Saved providers' : 'Notifications'}</Text>
   {!!error && <Text accessibilityRole="alert">{error}</Text>}
   <Pressable accessibilityRole="button" disabled={loading || busy} onPress={() => setRetry(v => v + 1)} style={button}><Text>Refresh</Text></Pressable>
   {(loading || busy) && <ActivityIndicator color="#7047FA" />}
   <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}>
    {!loading && !error && !items.length && <Text style={{ paddingVertical: 24 }}>{mode === 'bookmarks' ? 'No saved providers yet. Open a provider profile and tap Save provider.' : 'No booking notifications yet. Updates to your bookings will appear here.'}</Text>}
    {items.map(item => <Pressable key={item.id} disabled={busy} accessibilityRole="button" onPress={() => open(item)} style={{ backgroundColor: 'white', padding: 18, borderRadius: 14, marginVertical: 6 }}>
     <Text style={{ fontSize: 17, fontWeight: '600', color: '#252035' }}>{mode === 'bookmarks' ? item.name : item.title}</Text>
     <Text style={{ marginTop: 8, color: '#575366' }}>{mode === 'bookmarks' ? item.category + ' · ' + (item.serviceArea || 'Area not listed') : item.providerName + ' · ' + item.service}</Text>
     {mode === 'notifications' && <Text style={{ marginTop: 8, color: '#6040BB' }}>{item.read ? 'Read' : 'Unread'} · {new Date(item.createdAt).toLocaleString('en-GB', { timeZone: 'Asia/Colombo' })}</Text>}
     <Text style={{ marginTop: 10, color: '#6040BB' }}>{mode === 'bookmarks' ? 'View provider' : 'View booking'}</Text>
    </Pressable>)}
   </ScrollView>
  </View>}
 </Modal>;
}
