import React, { useEffect, useRef, useState } from "react";
import { View, Text, Pressable, ScrollView, StatusBar, StyleSheet, Alert, ActivityIndicator, Modal, TextInput, KeyboardAvoidingView, Platform, Image } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useIsFocused } from "@react-navigation/native";
import { COLORS, SHADOWS } from "../../constants/theme";
import { useAuth } from "../../context/AuthContext";
import Avatar from "../../components/provider/Avatar";
import ScreenHeader, { BellButton } from "../../components/provider/ScreenHeader";
import { useProviderData } from '../../context/ProviderContext';
import { money, bookingPrice, bookingWhen, bookingService } from '../../services/bookingService';

import * as ImagePicker from "expo-image-picker";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const GREEN = "#0F8A5F";
const STAR = "#E59A0C";

// ---------------------------------------------------------------------------
// Earnings bar chart (plain Views, no extra packages)
// ---------------------------------------------------------------------------
const EarningsChart = ({ data }) => {
  const max = Math.max(1, ...data.map((d) => d.amount));
  return (
    <View style={chart.row}>
      {data.map((d, i) => {
        const height = Math.round((d.amount / max) * 100);
        const current = i === data.length - 1;
        return (
          <View key={d.label} style={chart.col}>
            <Text style={[chart.value, current && chart.valueCurrent]}>
              {(d.amount / 100000).toFixed(1)}k
            </Text>
            <View style={[chart.bar, { height }, current && chart.barCurrent]} />
            <Text style={chart.label}>{d.label}</Text>
          </View>
        );
      })}
    </View>
  );
};

const chart = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "flex-end",
    minHeight: 150,
    marginTop: 18,
    gap: 12,
    paddingHorizontal: 4,
  },
  col: { flex: 1, alignItems: "center", justifyContent: "flex-end" },
  bar: { width: "100%", maxWidth: 52, borderRadius: 12, backgroundColor: "#DCD3FB", marginTop: 6 },
  barCurrent: { backgroundColor: COLORS.primary },
  value: { fontSize: 12, fontWeight: "700", color: COLORS.textMuted },
  valueCurrent: { color: COLORS.primary },
  label: { fontSize: 12, color: COLORS.textMuted, marginTop: 8 },
});

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------
const ProviderProfileScreen = ({ navigation }) => {
  const { logout } = useAuth();
  const { account: user, metrics, loaded, loading, error, load, saveProfile, savePricing } = useProviderData();
  const [pricingOpen, setPricingOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const details = user?.providerDetails || {};
  const rating = details.reviewCount > 0 && Number.isFinite(details.rating) ? details.rating.toFixed(1) : '—';
  const verified = user?.isVerified && user?.isApprovedByAdmin && details.approvalStatus === 'approved';
  const focused = useIsFocused();
  const name = user?.name || "Service Provider";
  const [editing, setEditing] = useState(false), [notice, setNotice] = useState("");

  const confirmLogout = () =>
    Alert.alert("Log out", "Are you sure you want to log out of this account?", [
      { text: "Cancel", style: "cancel" },
      { text: "Log out", style: "destructive", onPress: () => logout() },
    ]);

  return (
    <View style={styles.screen}>
      {focused && <StatusBar barStyle="dark-content" backgroundColor={COLORS.secondary} />}

      <ScreenHeader title="Profile & earnings">
        <Pressable
          onPress={() => { setNotice(""); setEditing(true); }}
          style={({ pressed }) => [styles.editBtn, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel="Edit profile"
        >
          <MaterialCommunityIcons name="pencil-outline" size={16} color={COLORS.primary} />
          <Text style={styles.editText}>Edit</Text>
        </Pressable>
        <BellButton />
      </ScreenHeader>

      {pricingOpen && <PricingEditor savePricing={savePricing} onClose={() => setPricingOpen(false)} onSaved={() => { setPricingOpen(false); setNotice('Pricing published. New customers can see it; existing bookings keep their agreed pricing.'); }} />}
      {editing && <EditProviderProfile user={user} saveProfile={saveProfile} onClose={() => setEditing(false)} onSaved={() => { setEditing(false); setNotice("Profile saved. Your public profile has been updated."); }} />}
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {!!notice && <Text accessibilityLiveRegion="polite" style={{ color: GREEN }}>{notice}</Text>}
        {loading && <ActivityIndicator accessibilityLabel="Loading earnings" color={COLORS.primary} />}
        {!!error && <Text accessibilityRole="alert" style={{ color: '#B52636' }}>{error}</Text>}
        <Pressable accessibilityRole="button" disabled={loading} onPress={() => load()} style={{ minHeight: 48, justifyContent: 'center' }}><Text style={styles.editText}>Refresh earnings</Text></Pressable>
        {/* Profile card */}
        <View style={styles.card}>
          <View style={styles.profileTop}>
            <View>
              <Avatar
                name={name}
                uri={user?.avatar || user?.profileImage}
                size={72}
                radius={18}
                fontSize={24}
              />
              {verified && (
                <View style={styles.verifyBadge}>
                  <MaterialCommunityIcons name="check-decagram" size={22} color={COLORS.primary} />
                </View>
              )}
            </View>
            <View style={styles.profileInfo}>
              <Text style={styles.profileName} >
                {name}
              </Text>
              <Text style={styles.profileRole} >
                {details.category || 'Service provider'}{details.experience ? ' · ' + details.experience : ''}
              </Text>
              <View style={styles.metaRow}>
                <MaterialCommunityIcons name="star" size={16} color={STAR} />
                <Text style={styles.ratingText}>
                  {rating} <Text style={styles.reviewText}>({details.reviewCount || 0})</Text>
                </Text>
                {verified && (
                  <View style={styles.verifiedPill}>
                    <View style={styles.verifiedDot} />
                    <Text style={styles.verifiedText}>Verified provider</Text>
                  </View>
                )}
              </View>
            </View>
          </View>

          <View style={styles.statsPanel}>
            {[
              [loaded ? String(metrics.completed) : "—", "Jobs done"],
              [loaded ? String(metrics.active.length) : "—", "Active jobs"],
              [rating, "Rating"],
            ].map(([value, label], i) => (
              <View key={label} style={[styles.stat, i > 0 && styles.statDivider]}>
                <Text style={styles.statValue}>{value}</Text>
                <Text style={styles.statLabel}>{label}</Text>
              </View>
            ))}
          </View>
          {!!details.serviceArea && <Text style={[styles.serviceUnit, { marginTop: 14 }]}>{details.serviceArea}</Text>}
          {!!details.bio && <Text style={[styles.serviceUnit, { marginTop: 8 }]}>{details.bio}</Text>}
        </View>

        {/* Earnings */}
        <View style={[styles.card, styles.cardSpaced]}>
          <View style={styles.earningsTop}>
            <View>
              <Text style={styles.mutedSmall}>Payments received this month</Text>
              <Text style={styles.earningsValue}>{loaded ? money(metrics.monthReceived) : '—'}</Text>
            </View>
            <View style={styles.pendingCol}>
              <Text style={styles.mutedSmall}>Awaiting confirmation</Text>
              <Text style={styles.pendingValue}>{loaded ? money(metrics.awaiting) : '—'}</Text>
            </View>
          </View>

          <Text style={[styles.mutedSmall, { marginTop: 12 }]}>Unpaid invoices: {loaded ? money(metrics.unpaid) : '—'}</Text>
          <Text style={[styles.mutedSmall, { marginTop: 12 }]}>Confirmed cash and bank receipts, grouped by day of month in Sri Lanka time. No platform payouts.</Text>
          {loaded && <EarningsChart data={metrics.weeks} />}
          {loaded && metrics.monthReceived === 0 && <Text style={styles.mutedSmall}>No confirmed receipts this month.</Text>}

          <Pressable
            onPress={() => setHistoryOpen(v => !v)}
            style={({ pressed }) => [styles.historyBtn, pressed && styles.pressed]}
            accessibilityRole="button"
          >
            <MaterialCommunityIcons name="receipt-text-outline" size={20} color={COLORS.textPrimary} />
            <Text style={styles.historyText}>{historyOpen ? "Hide payment history" : "View payment history"}</Text>
          </Pressable>
        </View>

        {historyOpen && <View style={[styles.card, styles.cardSpaced]}><Text style={styles.cardTitle}>Invoices & receipts</Text>{!metrics.invoices.length && <Text style={styles.mutedSmall}>{loaded ? 'No invoices yet.' : 'Load bookings to see payment history.'}</Text>}{metrics.invoices.map(b => <Pressable key={b.id} accessibilityRole="button" onPress={() => navigation.navigate('Requests', { bookingId: b.id, openRequest: Date.now() })} style={styles.serviceRow}><View style={styles.serviceText}><Text style={styles.serviceName}>{b.customerName}</Text><Text style={styles.serviceUnit}>{b.invoice.number}</Text><Text style={styles.serviceUnit}>{b.payment?.status === 'paid' ? 'Received · ' + bookingWhen(b.payment.paidAt) : b.payment?.status === 'awaiting_confirmation' ? 'Reported · awaiting your confirmation' : 'Unpaid'}</Text></View><Text style={styles.servicePrice}>{money(b.invoice.totalMinor)}</Text></Pressable>)}</View>}
        {/* Services & pricing */}
        <View style={[styles.card, styles.cardSpaced]}>
          <Text style={styles.cardTitle}>Services & pricing</Text>
          <Text style={[styles.serviceName, { marginTop: 12 }]}>{details.category || 'Service not set'}</Text>
          <Text style={styles.serviceUnit}>{bookingPrice({ pricing: details.pricing })}</Text>
          {!!details.pricing?.inclusions && <Text style={styles.serviceUnit}>{details.pricing.inclusions}</Text>}
          {!details.pricing && <Text style={styles.serviceUnit}>Customers currently need to request a quote. Publish a fixed price, estimate range, or inspection fee to explain costs before booking.</Text>}
          <Pressable accessibilityRole="button" onPress={() => setPricingOpen(true)} style={edit.primary}><Text style={edit.primaryText}>{details.pricing ? 'Edit service pricing' : 'Set service pricing'}</Text></Pressable>

        </View>

        {/* Log out */}
        <Pressable
          onPress={confirmLogout}
          style={({ pressed }) => [styles.logout, pressed && styles.pressed]}
          accessibilityRole="button"
        >
          <MaterialCommunityIcons name="logout" size={18} color={COLORS.error} />
          <Text style={styles.logoutText}>Log out</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
};

function PricingEditor({ savePricing, onClose, onSaved }) {
  const insets = useSafeAreaInsets(), [loaded, setLoaded] = useState(false), [pricing, setPricing] = useState(null), [error, setError] = useState(''), [attempt, setAttempt] = useState(0), [busy, setBusy] = useState(false);
  useEffect(() => { const c = new AbortController(); bookingService.pricing(c.signal).then(p => { if (!c.signal.aborted) { setPricing(p); setLoaded(true); setError(''); } }).catch(e => { if (!c.signal.aborted) setError(e.response?.data?.message || 'Unable to load pricing. Try again.'); }); return () => c.abort(); }, [attempt]);
  return <Modal visible animationType="slide" onRequestClose={() => { if (!busy) onClose(); }}><KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: COLORS.background, paddingTop: insets.top }}><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}><Text style={styles.cardTitle}>Service pricing</Text><Text style={styles.serviceUnit}>Publish costs and scope for new requests. Existing bookings keep their agreed prices.</Text>{loaded ? <PricingForm pricing={pricing} savePricing={savePricing} onSaved={onSaved} onBusy={setBusy} /> : error ? <><Text accessibilityRole="alert" style={edit.error}>{error}</Text><Pressable accessibilityRole="button" onPress={() => { setError(''); setAttempt(n => n + 1); }} style={edit.primary}><Text style={edit.primaryText}>Retry pricing</Text></Pressable></> : <ActivityIndicator accessibilityLabel="Loading pricing" color={COLORS.primary} />}<Pressable accessibilityRole="button" disabled={busy} onPress={onClose} style={edit.primary}><Text style={edit.primaryText}>Close pricing editor</Text></Pressable></ScrollView></KeyboardAvoidingView></Modal>;
}
function PricingForm({ pricing, savePricing, onSaved, onBusy }) {
  const [type, setType] = useState(pricing?.type || 'fixed'), [form, setForm] = useState({ amount: pricing?.amountMinor == null ? '' : String(pricing.amountMinor / 100), min: pricing?.minMinor == null ? '' : String(pricing.minMinor / 100), max: pricing?.maxMinor == null ? '' : String(pricing.maxMinor / 100), inspectionFee: pricing?.inspectionFeeMinor == null ? '' : String(pricing.inspectionFeeMinor / 100), inclusions: pricing?.inclusions || '', exclusions: pricing?.exclusions || '', bankDetails: pricing?.bankDetails || '' }), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const lock = useRef(false);
  const fields = type === 'fixed' ? [['amount', 'Fixed total (LKR)']] : type === 'estimate' ? [['min', 'Minimum estimate (LKR)'], ['max', 'Maximum estimate (LKR)']] : [['inspectionFee', 'Inspection fee (LKR)']];
  async function submit() {
    if (lock.current) return;
    if (!form.inclusions.trim() || fields.some(([key]) => !/^\d+(\.\d{1,2})?$/.test(form[key].trim()) || Number(form[key]) > 10000000) || (type === 'estimate' && Number(form.max) < Number(form.min))) { setError('Enter the included scope and valid non-negative amounts (up to two decimal places). The maximum estimate must not be below the minimum.'); return; }
    lock.current = true; setBusy(true); onBusy(true); setError('');
    try { await savePricing({ ...form, type, ...Object.fromEntries(fields.map(([key]) => [key, Number(form[key])])) }); onSaved(); }
    catch (e) { setError((e.response?.data?.message || 'Unable to save pricing. Please retry.') + ' Your draft is kept.'); }
    finally { lock.current = false; setBusy(false); onBusy(false); }
  }
  return <View style={[styles.card, styles.cardSpaced]}><View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{[['fixed','Fixed price'],['estimate','Estimate range'],['inspection','Inspection fee']].map(([value,label]) => <Pressable key={value} accessibilityRole="radio" accessibilityState={{ checked: type === value, disabled: busy }} disabled={busy} onPress={() => setType(value)} style={[edit.input, { borderColor: type === value ? COLORS.primary : COLORS.inputBorder }]}><Text style={styles.serviceName}>{type === value ? '✓ ' : ''}{label}</Text></Pressable>)}</View><Text style={styles.serviceUnit}>{type === 'fixed' ? 'The customer agrees to this total for the scope below.' : type === 'estimate' ? 'An indication only. Send an itemised quote for customer approval before work.' : 'Inspection only. Repairs require a separate approved quote.'}</Text>{[...fields, ['inclusions','Included scope *'], ['exclusions','Exclusions (optional)'], ['bankDetails','Bank transfer instructions (optional)']].map(([key,label]) => <View key={key}><Text style={edit.label}>{label}</Text><TextInput accessibilityLabel={label} editable={!busy} keyboardType={fields.some(([k]) => k === key) ? 'decimal-pad' : 'default'} multiline={!fields.some(([k]) => k === key)} value={form[key]} maxLength={fields.some(([k]) => k === key) ? 12 : 1000} onChangeText={value => setForm(current => ({ ...current, [key]: value }))} style={edit.input} /></View>)}<Text style={styles.serviceUnit}>Bank instructions appear only on invoices. FixMate does not transfer money.</Text>{!!error && <Text accessibilityRole="alert" style={edit.error}>{error}</Text>}<Pressable accessibilityRole="button" disabled={busy} onPress={submit} style={edit.primary}><Text style={edit.primaryText}>{busy ? 'Publishing…' : 'Publish pricing'}</Text></Pressable></View>;
}

function EditProviderProfile({ user, saveProfile, onClose, onSaved }) {
  const details = user?.providerDetails || {}, insets = useSafeAreaInsets();
  const [form, setForm] = useState({ name: user?.name || '', phone: user?.phone || '', bio: details.bio || '', serviceArea: details.serviceArea || '', experience: details.experience || '' });
  const [avatar, setAvatar] = useState(user?.avatar || ''), [error, setError] = useState(''), [busy, setBusy] = useState(false), [picking, setPicking] = useState(false);
  const lock = useRef(false), scroll = useRef(null), nameInput = useRef(null);
  const locked = busy || picking;
  const fail = message => { setError(message); scroll.current?.scrollTo({ y: 0, animated: true }); };
  async function choosePhoto() {
    if (lock.current) return; lock.current = true; setPicking(true); setError('');
    try {
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.7, base64: true });
      if (result.canceled) return;
      const asset = result.assets?.[0], data = asset?.base64;
      const type = data?.startsWith('/9j/') ? 'jpeg' : data?.startsWith('iVBORw0KGgo') ? 'png' : null;
      if (!type || !data) throw new Error('Choose a JPEG or PNG photo. This file type cannot be used.');
      if (data.length * 3 / 4 - (data.endsWith('==') ? 2 : data.endsWith('=') ? 1 : 0) > 1024 * 1024) throw new Error('Choose a smaller photo (under 1 MB), then try again.');
      const uri = `data:image/${type};base64,${data}`;
      await new Promise((resolve, reject) => Image.getSize(uri, resolve, () => reject(new Error('This photo cannot be opened. Choose another image.'))));
      setAvatar(uri);
    } catch (e) { fail(/unsupported file type/i.test(e.message || '') ? 'Choose a JPEG or PNG photo. This file type cannot be used.' : e.message || 'Could not open your photos. Check photo permissions in device settings and try again.'); }
    finally { lock.current = false; setPicking(false); }
  }
  async function save() {
    if (lock.current) return;
    if (!form.name.trim() || form.name.trim().length > 120 || (!/^\+?[\d\s-]{7,18}$/.test(form.phone.trim()) || form.phone.replace(/\D/g, '').length < 7)) { fail('Enter your name and a valid phone number.'); nameInput.current?.focus(); return; }
    lock.current = true; setBusy(true); setError('');
    try { await saveProfile({ name: form.name.trim(), phone: form.phone.trim(), ...(avatar !== (user?.avatar || '') ? { avatar } : {}), providerDetails: { bio: form.bio.trim(), experience: form.experience.trim(), serviceArea: form.serviceArea.trim() } }); onSaved(); }
    catch (e) { fail(e.response?.data?.message || 'Profile was not saved. Your changes are kept. Check your connection and try again.'); }
    finally { lock.current = false; setBusy(false); }
  }
  return <Modal visible animationType="slide" onRequestClose={() => { if (!locked) onClose(); }}><KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={[styles.screen, { paddingTop: insets.top }]}>
    <View style={edit.header}><Pressable accessibilityRole="button" accessibilityLabel="Cancel profile editing" disabled={locked} onPress={onClose} style={edit.smallButton}><MaterialCommunityIcons name="arrow-left" size={24} color={COLORS.textPrimary} /></Pressable><Text accessibilityRole="header" style={edit.title}>Edit profile</Text></View>
    <ScrollView ref={scroll} keyboardShouldPersistTaps="handled" contentContainerStyle={[edit.content, { paddingBottom: 24 + insets.bottom }]}>
      {!!error && <Text accessibilityRole="alert" accessibilityLiveRegion="assertive" style={edit.error}>{error}</Text>}
      <View style={[styles.card, edit.photo]}><Avatar name={form.name} uri={avatar} size={96} radius={48} /><Text style={edit.help}>Profile photo preview · JPEG or PNG, up to 1 MB</Text><Pressable accessibilityRole="button" disabled={locked} onPress={choosePhoto} style={edit.secondary}><Text style={styles.editText}>{picking ? 'Opening photos…' : 'Choose profile photo'}</Text></Pressable>{!!avatar && <Pressable accessibilityRole="button" disabled={locked} onPress={() => setAvatar('')} style={edit.smallButton}><Text style={styles.editText}>Remove photo</Text></Pressable>}</View>
      <View style={styles.card}>{[['name', 'Full name *', 120], ['phone', 'Phone number *', 18], ['serviceArea', 'Service area', 300], ['experience', 'Experience', 120], ['bio', 'About you', 2000]].map(([key, label, maxLength]) => <View key={key}><Text style={edit.label}>{label}</Text><TextInput ref={key === 'name' ? nameInput : undefined} accessibilityLabel={label} editable={!locked} value={form[key]} onChangeText={value => setForm(current => ({ ...current, [key]: value }))} maxLength={maxLength} keyboardType={key === 'phone' ? 'phone-pad' : 'default'} multiline={key === 'bio'} style={[edit.input, key === 'bio' && { minHeight: 112, textAlignVertical: 'top' }]} /></View>)}<Text style={edit.label}>Email</Text><Text selectable style={edit.help}>{user?.email}</Text><Text style={edit.label}>Service category</Text><Text style={edit.help}>{details.category || 'Not set'}</Text><Text style={edit.help}>Email and verified service details are managed separately. Your pricing and bookings stay unchanged.</Text></View>
      <Pressable accessibilityRole="button" accessibilityState={{ disabled: locked }} disabled={locked} onPress={save} style={[edit.primary, locked && { opacity: 0.5 }]}>{busy ? <ActivityIndicator color="#FFF" /> : <Text style={edit.primaryText}>Save profile</Text>}</Pressable><Pressable accessibilityRole="button" disabled={locked} onPress={onClose} style={edit.secondary}><Text style={styles.editText}>Cancel</Text></Pressable>
    </ScrollView></KeyboardAvoidingView></Modal>;
}
const edit = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12, backgroundColor: COLORS.secondary }, title: { fontSize: 22, fontWeight: '700', color: COLORS.textPrimary },
  content: { padding: 20, gap: 16, width: '100%', maxWidth: 640, alignSelf: 'center' }, photo: { alignItems: 'center', gap: 8 },
  label: { color: COLORS.textPrimary, fontSize: 14, fontWeight: '600', marginTop: 16, marginBottom: 8 }, help: { color: COLORS.textMuted, fontSize: 14, lineHeight: 21, marginTop: 8 },
  input: { borderWidth: 1, borderColor: COLORS.inputBorder, borderRadius: 12, minHeight: 52, padding: 14, fontSize: 16, backgroundColor: COLORS.inputBg, color: COLORS.textPrimary },
  error: { color: '#B52636', fontSize: 14, lineHeight: 21 }, smallButton: { minHeight: 48, minWidth: 48, justifyContent: 'center', alignItems: 'center' },
  primary: { minHeight: 52, backgroundColor: COLORS.primary, borderRadius: 13, padding: 14, alignItems: 'center', justifyContent: 'center' }, primaryText: { color: '#FFF', fontWeight: '700', fontSize: 16 },
  secondary: { minHeight: 48, borderWidth: 1, borderColor: COLORS.inputBorder, borderRadius: 13, backgroundColor: COLORS.secondary, padding: 14, alignItems: 'center', justifyContent: 'center' },
});

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.background },
  content: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 28, width: "100%", maxWidth: 900, alignSelf: "center" },
  pressed: { opacity: 0.85 },

  editBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    height: 42,
    paddingHorizontal: 14,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: COLORS.inputBorder,
    backgroundColor: COLORS.secondary,
  },
  editText: { fontSize: 14, fontWeight: "800", color: COLORS.primary },

  card: {
    backgroundColor: COLORS.cardBg,
    borderRadius: 24,
    padding: 16,
    ...SHADOWS.small,
  },
  cardSpaced: { marginTop: 14 },
  cardTitle: { fontSize: 16, fontWeight: "800", color: COLORS.textPrimary },

  // Profile
  profileTop: { flexDirection: "row", alignItems: "center" },
  verifyBadge: {
    position: "absolute",
    right: -6,
    bottom: -6,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: COLORS.cardBg,
    alignItems: "center",
    justifyContent: "center",
  },
  profileInfo: { flex: 1, marginLeft: 16 },
  profileName: { fontSize: 18, fontWeight: "800", color: COLORS.textPrimary },
  profileRole: { fontSize: 13, fontWeight: "700", color: COLORS.primary, marginTop: 3 },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 8, flexWrap: "wrap" },
  ratingText: { fontSize: 13, fontWeight: "800", color: COLORS.textPrimary },
  reviewText: { fontWeight: "500", color: COLORS.textMuted },
  verifiedPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#DDF5EA",
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  verifiedDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: GREEN },
  verifiedText: { fontSize: 11, fontWeight: "800", color: GREEN },

  statsPanel: {
    flexDirection: "row",
    backgroundColor: "#F4F5F9",
    borderRadius: 16,
    paddingVertical: 14,
    marginTop: 16,
  },
  stat: { flex: 1, alignItems: "center" },
  statDivider: { borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: COLORS.disabledBg },
  statValue: { fontSize: 18, fontWeight: "800", color: COLORS.textPrimary },
  statLabel: { fontSize: 12, color: COLORS.textMuted, marginTop: 3 },

  // Earnings
  earningsTop: { flexDirection: "row", flexWrap: "wrap", gap: 16, justifyContent: "space-between", alignItems: "flex-start" },
  mutedSmall: { fontSize: 13, color: COLORS.textMuted },
  earningsValue: {
    fontSize: 28,
    fontWeight: "800",
    color: COLORS.textPrimary,
    marginTop: 4,
    letterSpacing: -0.5,
  },
  pendingCol: { alignItems: "flex-end" },
  pendingValue: { fontSize: 15, fontWeight: "800", color: COLORS.textPrimary, marginTop: 4 },
  historyBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    minHeight: 50,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.inputBorder,
    marginTop: 18,
  },
  historyText: { fontSize: 14, fontWeight: "800", color: COLORS.textPrimary },

  // Services
  serviceRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 14 },
  serviceDivider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: COLORS.inputBorder },
  serviceText: { flex: 1, paddingRight: 12 },
  serviceName: { fontSize: 15, fontWeight: "600", color: COLORS.textPrimary },
  serviceUnit: { fontSize: 12, color: COLORS.textMuted, marginTop: 3 },
  servicePrice: { fontSize: 15, fontWeight: "800", color: COLORS.textPrimary },

  logout: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#FDE8E8",
    borderRadius: 16,
    paddingVertical: 15,
    marginTop: 18,
  },
  logoutText: { fontSize: 15, fontWeight: "800", color: COLORS.error },
});

export default ProviderProfileScreen;
