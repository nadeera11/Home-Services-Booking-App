import React, { useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, Share, StyleSheet, Text, View, Image } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { bookingPrice, bookingDate, pricingExplanation } from '../../services/bookingService';
import { BookingFlowModal } from './BookingsScreen';

const purple = '#7047FA';
const Icon = ({ name, color = purple, size = 22 }) => <MaterialCommunityIcons name={name} color={color} size={size} />;
function Section({ title, detail, children }) {
  return <View style={styles.section}><View style={styles.sectionHeading}><Text accessibilityRole="header" style={styles.sectionTitle}>{title}</Text>{detail && <Text style={styles.caption}>{detail}</Text>}</View>{children}</View>;
}
function InfoRow({ icon, title, description, verified }) {
  return <View style={styles.infoRow}><View style={[styles.iconBox, verified && styles.check]}><Icon name={icon} color={verified ? '#078765' : purple} size={verified ? 18 : 24} /></View><View style={styles.flex}><Text style={styles.rowTitle}>{title}</Text>{!!description && <Text style={styles.body}>{description}</Text>}</View></View>;
}

export default function ProviderProfileModal({ visible, provider: p, loading, error, onClose, onRetry, onTrackBookings }) {
  const insets = useSafeAreaInsets();
  const [shareError, setShareError] = useState('');
  const [showAvailability, setShowAvailability] = useState(false);
  const initials = (p?.name || '').trim().split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase();
  const close = () => { setShowAvailability(false); setShareError(''); onClose(); };
  async function share() {
    setShareError('');
    try { await Share.share({ message: [p.name, p.category, p.serviceArea, 'Find this professional in FixMate Explore.'].filter(Boolean).join(' · ') }); }
    catch { setShareError('Sharing is unavailable on this device. Please try again.'); }
  }
  if (visible && showAvailability && p) return <BookingFlowModal provider={p} onClose={() => setShowAvailability(false)} onTrack={() => { setShowAvailability(false); onClose(); onTrackBookings?.(); }} />;
  return <Modal visible={visible} animationType="slide" onRequestClose={close} presentationStyle="fullScreen">
    <View style={[styles.screen, { paddingTop: insets.top }]} accessibilityViewIsModal>
      <View style={styles.header}><Pressable onPress={close} accessibilityRole="button" accessibilityLabel="Back to Explore" style={styles.roundButton}><Icon name="arrow-left" color="#252525" /></Pressable><Text accessibilityRole="header" style={styles.title}>Provider Profile</Text><Pressable disabled={!p || loading || !!error} onPress={share} accessibilityRole="button" accessibilityLabel="Share provider profile" style={styles.roundButton}><Icon name="share-variant-outline" color="#252525" /></Pressable></View>
      {!!shareError && <Text accessibilityRole="alert" style={styles.feedback}>{shareError}</Text>}
      {loading ? <View style={styles.state}><ActivityIndicator size="large" color={purple} /><Text style={styles.body}>Loading profile…</Text></View> : error ? <View style={styles.state}><Text accessibilityRole="alert" style={styles.body}>{error}</Text><Pressable onPress={onRetry} accessibilityRole="button" style={styles.button}><Text style={styles.buttonText}>Try again</Text></Pressable></View> : p && <ScrollView contentContainerStyle={[styles.content, { paddingBottom: Math.max(24, insets.bottom) }]}>
        <View style={[styles.card, styles.hero]}>
          <View style={styles.avatar}><>{p.avatar ? <Image accessibilityLabel={p.name + " profile photo"} source={{ uri: p.avatar }} style={{ width: 78, height: 78, borderRadius: 40 }} /> : <Text style={styles.initials}>{initials}</Text>}</>{p.verified && <View style={styles.avatarBadge}><Icon name="check-decagram-outline" color="#FFF" size={18} /></View>}</View>
          <Text style={styles.name}>{p.name}</Text><Text style={styles.subtitle}>{p.category}</Text>
          {p.verified && <View style={styles.badge}><Icon name="shield-check" size={14} /><Text style={styles.badgeText}>Verified Provider</Text></View>}
          <View style={styles.stats}>
            <View style={styles.stat}><View style={styles.statTop}><Icon name="star" color="#8D5B09" size={18} /><Text style={styles.statValue}>{p.rating == null ? 'New' : p.rating.toFixed(1)}</Text></View><Text style={styles.caption}>{p.reviewCount || 0} Reviews</Text></View>
            <View style={styles.stat}><View style={styles.statTop}><Icon name="medal-outline" size={18} /><Text style={styles.statValue}>{p.experience || 'Not listed'}</Text></View><Text style={styles.caption}>Experience</Text></View>
            <View style={styles.stat}><View style={styles.statTop}><Icon name="map-marker-outline" color="#007E5C" size={18} /><Text style={styles.statValue}>{p.serviceArea || 'Not listed'}</Text></View><Text style={styles.caption}>Service area</Text></View>
          </View>
        </View>
        <Section title="About"><View style={styles.card}><Text style={styles.body}>{p.bio || 'This provider hasn’t added an introduction yet.'}</Text></View></Section>
        <Section title="Services Offered" detail="1 service category"><View style={styles.grid}><View style={[styles.card, styles.serviceCard]}><View style={[styles.iconBox, styles.serviceIcon]}><Icon name="tools" /></View><Text style={styles.serviceTitle}>{p.category}</Text><Text style={styles.rowTitle}>{bookingPrice(p)}</Text><Text style={styles.body}>{pricingExplanation(p.pricing)}</Text>{!!p.pricing?.inclusions && <Text style={styles.body}>Included: {p.pricing.inclusions}</Text>}{!!p.pricing?.exclusions && <Text style={styles.caption}>Excluded: {p.pricing.exclusions}</Text>}</View></View></Section>
        <Section title="Qualifications"><View style={styles.card}><InfoRow icon="check-decagram-outline" title={p.qualifications || 'Qualifications not listed'} description={p.qualifications ? 'Provided by the professional' : 'No public qualification details added yet.'} /></View>{!!p.experience && <View style={[styles.card, styles.spaced]}><InfoRow icon="school-outline" title={p.experience + ' experience'} description="Professional experience" /></View>}</Section>
        <Section title="Verification"><View style={styles.card}><InfoRow icon={p.verified ? 'check' : 'shield-outline'} verified={p.verified} title={p.verified ? 'Provider Verified' : 'Verification not available'} description={p.verified ? 'Reviewed and approved by FixMate' : 'Verification details have not been provided.'} /></View></Section>
        <Section title="Ratings & Reviews" detail={p.rating == null ? 'No ratings yet' : '★ ' + p.rating.toFixed(1) + ' (' + p.reviewCount + ')'}>{p.reviews?.length ? <>{p.reviews.map((review, i) => <View key={review.createdAt + '-' + i} style={[styles.card, styles.spaced]}><Text style={styles.rowTitle}>{review.customerName} · {review.rating} out of 5 stars</Text><Text style={styles.caption}>{bookingDate(review.createdAt)} · Verified booking</Text>{!!review.comment && <Text style={styles.body}>{review.comment}</Text>}<Text style={styles.caption}>{review.service}</Text></View>)}<Text style={styles.caption}>Showing the latest {p.reviews.length} reviews.</Text></> : <View style={styles.card}><Text style={styles.body}>No written reviews yet. After a completed service, customers can leave a review from My Bookings.</Text></View>}</Section>
        <View style={styles.actionArea}><Pressable disabled={p.acceptingRequests === false} onPress={() => setShowAvailability(value => !value)} accessibilityRole="button" accessibilityState={{ disabled: p.acceptingRequests === false, expanded: showAvailability }} style={[styles.button, p.acceptingRequests === false && { opacity: 0.5 }]}><Text style={styles.buttonText}>Continue with Provider</Text><Icon name="arrow-right" color="#FFF" size={20} /></Pressable><Text style={styles.actionCaption}>{p.acceptingRequests === false ? "This provider has paused new requests. Please choose another provider." : "No immediate charge"}</Text></View>
      </ScrollView>}
    </View>
  </Modal>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F9F8FE' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 12 },
  roundButton: { width: 44, height: 44, borderRadius: 24, backgroundColor: '#F0EEEE', alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 19, fontWeight: '600', color: '#202020' },
  content: { paddingHorizontal: 20, paddingTop: 8, width: '100%', maxWidth: 600, alignSelf: 'center' },
  card: { backgroundColor: '#FFF', borderRadius: 14, padding: 16, boxShadow: '0px 2px 3px rgba(24, 16, 48, 0.035)' },
  hero: { alignItems: 'center', paddingTop: 16, paddingBottom: 16 },
  avatar: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#E7DEFF', borderWidth: 1, borderColor: '#CEBDFF', alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  initials: { color: '#5B2CE6', fontWeight: '700', fontSize: 26 },
  avatarBadge: { position: 'absolute', right: -5, bottom: -5, backgroundColor: purple, borderRadius: 18, borderWidth: 3, borderColor: '#FFF', width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
  name: { fontSize: 21, fontWeight: '600', color: '#202020', textAlign: 'center' },
  subtitle: { fontSize: 14, color: '#555167', marginTop: 5, textAlign: 'center' },
  badge: { flexDirection: 'row', gap: 4, alignItems: 'center', backgroundColor: '#E8DFFF', borderRadius: 20, paddingHorizontal: 11, paddingVertical: 4, marginTop: 12 },
  badgeText: { fontSize: 12, color: '#5B2CE6', fontWeight: '500' },
  stats: { flexDirection: 'row', alignSelf: 'stretch', marginTop: 16, backgroundColor: '#F6F3F3', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 17, gap: 4 },
  stat: { flex: 1, alignItems: 'center', gap: 4 },
  statTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 3 },
  statValue: { fontSize: 15, fontWeight: '500', color: '#222', textAlign: 'center', flexShrink: 1 },
  caption: { fontSize: 11.5, lineHeight: 17, color: '#514C61' },
  section: { marginTop: 28 },
  sectionHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 6 },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: '#222' },
  body: { fontSize: 13.5, lineHeight: 22, color: '#555167' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  serviceCard: { width: '49%', minHeight: 122 },
  iconBox: { width: 44, height: 44, borderRadius: 9, backgroundColor: '#F7F4F4', alignItems: 'center', justifyContent: 'center' },
  serviceIcon: { backgroundColor: '#E7DDFF', width: 40, height: 40, marginBottom: 10 },
  serviceTitle: { fontSize: 16, fontWeight: '600', color: '#222', marginBottom: 2 },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 15 },
  flex: { flex: 1 },
  rowTitle: { fontSize: 14, lineHeight: 21, fontWeight: '500', color: '#222' },
  check: { width: 29, height: 29, borderRadius: 15, backgroundColor: '#69F0C0' },
  spaced: { marginTop: 8 },
  actionArea: { marginTop: 34, gap: 8 },
  button: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: purple, borderRadius: 12, minHeight: 54, paddingHorizontal: 20, paddingVertical: 14 },
  buttonText: { color: '#FFF', fontSize: 14, fontWeight: '600' },
  actionCaption: { fontSize: 11.5, textAlign: 'center', color: '#555167' },
  state: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 30, gap: 16 },
  feedback: { paddingHorizontal: 20, color: '#B42318', fontSize: 13 },
});
