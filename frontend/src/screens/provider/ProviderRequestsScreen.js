import React, { useCallback, useRef, useState } from "react";
import { View, Text, Pressable, ScrollView, StatusBar, StyleSheet, ActivityIndicator, Modal, KeyboardAvoidingView, Platform, TextInput } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useFocusEffect, useIsFocused } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { COLORS, SHADOWS } from "../../constants/theme";
import { useProviderData } from "../../context/ProviderContext";
import Avatar from "../../components/provider/Avatar";
import ScreenHeader, { BellButton } from "../../components/provider/ScreenHeader";
import { BOOKING_TIMES, bookingTime, bookingWhen, bookingPreference, bookingPrice, money } from "../../services/bookingService";
import { BookingCharges } from "../customer/BookingsScreen";

const NEW = ['pending', 'time_proposed'];
const ACTIVE = ['awaiting_quote', 'confirmed', 'inspection_confirmed', 'inspecting', 'quote_pending', 'ongoing'];
const HISTORY = ['completed', 'cancelled', 'rejected'];
const LABELS = { pending: 'New request', time_proposed: 'Time suggested', awaiting_quote: 'Quote needed', confirmed: 'Confirmed', inspection_confirmed: 'Inspection booked', inspecting: 'Inspection complete', quote_pending: 'Awaiting quote approval', ongoing: 'In progress', completed: 'Completed', cancelled: 'Cancelled', rejected: 'Declined' };
const EVENTS = { request: 'Request received', confirm: 'Appointment accepted', reject: 'Request declined', reschedule: 'Customer requested a new time', cancel: 'Customer cancelled', propose_time: 'Alternative time suggested', accept_time: 'Customer accepted suggested time', decline_time: 'Customer kept requested time', quote: 'Quote sent', approve_quote: 'Customer approved quote', decline_quote: 'Customer declined quote', inspect: 'Inspection completed', start: 'Work started', complete: 'Work completed and invoice issued', payment_report: 'Customer reported payment', payment_confirm: 'Payment receipt confirmed', payment_reject: 'Payment receipt not confirmed' };
const dayKey = value => new Date(new Date(value).getTime() + 19800000).toISOString().slice(0, 10);
const canQuote = job => ['awaiting_quote', 'confirmed', 'inspecting', 'ongoing', 'quote_pending'].includes(job.status) && (job.pricing?.type !== 'inspection' || job.inspectionPerformed);

function nextAction(job) {
  if (job.payment?.status === 'awaiting_confirmation') return 'Your turn: check your cash or bank account, then confirm or reject receipt below.';
  if (job.payment?.status === 'paid') return 'Payment received. The customer can view the receipt.';
  return {
    pending: 'Your turn: review the time, work and pricing before accepting or suggesting another time.',
    time_proposed: 'Customer’s turn: review your suggested time. It is not reserved until they accept.',
    awaiting_quote: 'Your turn: send an itemised quote. The appointment is accepted, but no work or charge is agreed yet.',
    confirmed: 'Your turn: attend at the agreed time, then start only the approved work.',
    inspection_confirmed: 'Your turn: perform the agreed inspection. Repairs need a separate approved quote.',
    inspecting: 'Your turn: send a repair quote. The disclosed inspection fee remains payable if repairs are declined.',
    quote_pending: 'Customer’s turn: review the quote. Work is paused until they decide.',
    ongoing: 'Your turn: complete the agreed work. Obtain approval for any revised scope or total.',
    completed: 'Customer’s turn: pay the invoice by cash or bank transfer, then report payment. Completion does not mean paid.',
    cancelled: 'The customer closed this request. No further work is authorised.',
    rejected: 'You declined this request. It remains in History.',
  }[job.status] || 'Refresh to see the latest booking state.';
}
function Action({ title, onPress, disabled, secondary, danger }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled: !!disabled }} disabled={disabled} onPress={onPress} style={[styles.jobButton, secondary && styles.jobSecondary, danger && styles.jobDanger, disabled && { opacity: 0.45 }]}><Text style={[styles.jobButtonText, secondary && { color: COLORS.primary }, danger && { color: '#B52636' }]}>{title}</Text></Pressable>;
}
function Badge({ status }) {
  const closed = ['cancelled', 'rejected'].includes(status);
  const green = status === 'completed';
  return <View style={[styles.tag, { maxWidth: '48%', backgroundColor: closed ? '#FDECED' : green ? '#E7F6F0' : '#EEEAFD' }]}><Text style={[styles.tagStandardText, { color: closed ? '#B52636' : green ? '#08734C' : COLORS.primary }]}>{LABELS[status] || status}</Text></View>;
}
function Detail({ label, value }) {
  return <View style={styles.jobDetail}><Text style={styles.detailLabel}>{label}</Text><Text style={styles.detailValue}>{value}</Text></View>;
}
function JobCard({ job, onOpen }) {
  return <View style={styles.card}>
    <View style={styles.cardTop}><Avatar name={job.customerName} size={48} radius={14} /><View style={styles.cardInfo}><Text style={styles.name}>{job.customerName}</Text><Text style={styles.service}>{job.service}</Text></View><Badge status={job.status} /></View>
    <Text style={styles.description} numberOfLines={3}>{job.problem}</Text>
    <View style={styles.details}><Detail label={job.scheduleConfirmed ? 'Confirmed appointment · Sri Lanka time' : 'Requested appointment · Sri Lanka time'} value={bookingPreference(job)} /><Detail label="Location" value={job.location} /><Detail label="Pricing" value={bookingPrice(job)} /></View>
    {!!job.invoice && <Text style={styles.description}>Payment: {job.payment?.status === 'paid' ? 'Paid' : job.payment?.status === 'awaiting_confirmation' ? 'Awaiting your confirmation' : 'Unpaid'}</Text>}
    <Action title="View job" onPress={onOpen} />
  </View>;
}

// Existing APIs require a real date and one of the supported Sri Lanka start times.
function TimeEditor({ job, busy, update, onDone }) {
  const [date, setDate] = useState(dayKey(job.proposedStartsAt || job.startsAt));
  const [time, setTime] = useState('');
  const [version, setVersion] = useState(job.version);
  const [error, setError] = useState('');
  const dateInput = useRef(null);
  const startsAt = /^\d{4}-\d{2}-\d{2}$/.test(date) && time ? new Date(date + 'T' + time + ':00+05:30') : null;
  const valid = startsAt && Number.isFinite(startsAt.getTime()) && dayKey(startsAt) === date && startsAt > new Date() && startsAt < new Date(new Date().getTime() + 90 * 86400000);
  const inside = valid && job.status === 'pending' && (job.scheduleMode === 'flexible' ? startsAt >= new Date(job.startsAt) && startsAt < new Date(job.windowEnd) : startsAt.getTime() === new Date(job.startsAt).getTime());
  const stale = version !== job.version;
  async function send(action) {
    if (!valid) { setError('Enter a real date within the next 90 days and select a future start time.'); dateInput.current?.focus(); return; }
    if (stale || busy) return;
    const updated = await update(job.id, { action, startsAt: startsAt.toISOString(), bookingVersion: version });
    if (updated) onDone(updated, action === 'confirm' ? 'Appointment accepted.' : 'Time suggested. Waiting for customer approval.');
  }
  return <View style={styles.card}>
    <Text style={styles.name}>Choose an appointment time</Text>
    <Text style={styles.description}>Times are in Sri Lanka time. A start within the customer’s preference can be accepted. Any other time must be sent for customer approval.</Text>
    <Text style={styles.jobLabel}>Date (YYYY-MM-DD) *</Text><TextInput ref={dateInput} accessibilityLabel="Appointment date, YYYY-MM-DD" value={date} onChangeText={v => { setDate(v); setError(''); }} editable={!busy} maxLength={10} autoCapitalize="none" placeholder="2026-10-15" style={styles.jobInput} />
    <Text style={styles.jobLabel}>Start time *</Text><View style={styles.chips}>{BOOKING_TIMES.map(t => <Pressable key={t} accessibilityRole="button" aria-pressed={time === t} accessibilityState={{ selected: time === t, disabled: busy }} disabled={busy} onPress={() => setTime(t)} style={[styles.timeChip, time === t && styles.selectedChip]}><Text style={time === t ? styles.white : styles.service}>{bookingTime('2026-01-01T' + t + ':00+05:30')}</Text></Pressable>)}</View>
    {!!error && <Text accessibilityRole="alert" style={styles.jobError}>{error}</Text>}
    {stale && <><Text accessibilityRole="alert" style={styles.jobError}>This booking changed. Review the current appointment above before continuing. Your entered time is kept.</Text><Action secondary title="I reviewed the updated booking" disabled={busy} onPress={() => setVersion(job.version)} /></>}
    {inside && <Action title="Accept selected time" disabled={busy || stale} onPress={() => send('confirm')} />}
    <Action title={job.status === 'time_proposed' ? 'Send replacement suggestion' : 'Suggest time to customer'} secondary={!!inside} disabled={busy || stale} onPress={() => send('propose_time')} />
    <Action secondary title="Close time editor" disabled={busy} onPress={() => onDone()} />
  </View>;
}
function QuoteEditor({ job, busy, update, onDone }) {
  const [scope, setScope] = useState(job.quote?.scope || job.problem);
  // Inspection fees are appended by the server. Exclude its generated item when editing.
  const repairItems = (job.quote?.items || []).filter((item, i) => !(i === 0 && job.inspectionPerformed && item.description === 'Agreed inspection fee (included once)'));
  const [items, setItems] = useState(repairItems.length ? repairItems.map((item, i) => ({ key: String(i), description: item.description, amount: String(item.amountMinor / 100) })) : [{ key: '0', description: '', amount: '' }]);
  const counter = useRef(items.length), scopeInput = useRef(null);
  const [version, setVersion] = useState(job.version), [error, setError] = useState('');
  const amountValid = value => /^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/.test(value.trim()) && Number(value) <= 10000000;
  const fee = job.inspectionPerformed ? job.pricing?.inspectionFeeMinor || 0 : 0;
  const validAmounts = items.every(item => amountValid(item.amount));
  const total = validAmounts ? items.reduce((sum, item) => sum + Math.round(Number(item.amount) * 100), fee) : null;
  const stale = version !== job.version;
  const change = (key, field, value) => { setItems(rows => rows.map(item => item.key === key ? { ...item, [field]: value } : item)); setError(''); };
  async function send() {
    if (!scope.trim() || !items.every(item => item.description.trim()) || !validAmounts || total > 1000000000) { setError('Enter a scope and a description with a valid LKR amount for every item. Use at most two decimal places; the total must not exceed LKR 10,000,000.'); scopeInput.current?.focus(); return; }
    if (busy || stale) return;
    const updated = await update(job.id, { action: 'quote', bookingVersion: version, scope: scope.trim(), items: items.map(item => ({ description: item.description.trim(), amount: Number(item.amount) })) });
    if (updated) onDone(updated, 'Quote sent. Work is paused until the customer approves.');
  }
  return <View style={styles.card}>
    <Text style={styles.name}>{job.quote ? 'Revise quote' : 'Prepare quote'}</Text>
    <Text style={styles.description}>Enter the complete replacement scope and charges, not an additional balance. The customer must approve before work continues.</Text>
    <Text style={styles.jobLabel}>Work scope *</Text><TextInput ref={scopeInput} accessibilityLabel="Quote scope, required" value={scope} onChangeText={v => { setScope(v); setError(''); }} maxLength={2000} multiline editable={!busy} style={[styles.jobInput, styles.multiline]} />
    {items.map((item, i) => <View key={item.key} style={styles.details}><Text style={styles.jobLabel}>Item {i + 1} description *</Text><TextInput accessibilityLabel={'Item ' + (i + 1) + ' description'} value={item.description} onChangeText={v => change(item.key, 'description', v)} maxLength={200} editable={!busy} style={styles.jobInput} /><Text style={styles.jobLabel}>Amount (LKR) *</Text><TextInput accessibilityLabel={'Item ' + (i + 1) + ' amount in LKR'} value={item.amount} onChangeText={v => change(item.key, 'amount', v)} maxLength={12} keyboardType="decimal-pad" editable={!busy} style={styles.jobInput} />{items.length > 1 && <Action secondary title={'Remove item ' + (i + 1)} disabled={busy} onPress={() => setItems(rows => rows.filter(row => row.key !== item.key))} />}</View>)}
    <Action secondary title="Add quote item" disabled={busy || items.length >= 20} onPress={() => setItems(rows => [...rows, { key: String(counter.current++), description: '', amount: '' }])} />
    {fee > 0 && <Detail label="Completed inspection fee (included once automatically)" value={money(fee)} />}
    <Detail label="Replacement quote total" value={total === null ? 'Enter valid item amounts' : money(total)} />
    <Text style={styles.description}>Nothing is charged by sending this quote. The invoice uses the approved total after completion.</Text>
    {!!error && <Text accessibilityRole="alert" style={styles.jobError}>{error}</Text>}
    {stale && <><Text accessibilityRole="alert" style={styles.jobError}>The booking changed while you were editing. Your draft is kept. Review the current details before sending.</Text><Action secondary title="I reviewed the updated booking" disabled={busy} onPress={() => setVersion(job.version)} /></>}
    <Action title={busy ? 'Sending quote…' : 'Send quote for approval'} disabled={busy || stale} onPress={send} />
    <Action secondary title="Close quote editor" disabled={busy} onPress={() => onDone()} />
  </View>;
}
function JobDetails({ job, busy, error, load, update, onUpdate, onClose, onMessage }) {
  const insets = useSafeAreaInsets();
  const [editor, setEditor] = useState(null), [confirmation, setConfirmation] = useState(null), [notice, setNotice] = useState(''), [paymentBusy, setPaymentBusy] = useState(false);
  const locked = busy || paymentBusy;
  const scroll = useRef(null);
  async function updateJob(id, values) {
    setNotice('');
    const updated = await update(id, values);
    if (!updated) scroll.current?.scrollTo({ y: 0, animated: true });
    return updated;
  }
  const editorVisible = editor === 'quote' ? canQuote(job) : editor === 'time' ? NEW.includes(job.status) : false;
  async function run(action, version = job.version) {
    const updated = await updateJob(job.id, { action, bookingVersion: version });
    if (updated) { setConfirmation(null); setNotice(action === 'confirm' ? updated.status === 'awaiting_quote' ? 'Appointment accepted. Send a quote before work begins.' : updated.status === 'inspection_confirmed' ? 'Inspection appointment accepted.' : 'Appointment confirmed.' : EVENTS[action] || 'Job updated.'); scroll.current?.scrollTo({ y: 0, animated: true }); }
  }
  function finished(updated, message) { setEditor(null); if (updated) { setNotice(message); scroll.current?.scrollTo({ y: 0, animated: true }); } }
  function close() { if (!locked) onClose(); }
  const confirmCopy = { reject: 'The customer will see this request as declined.', inspect: 'Confirm that you performed the agreed inspection. Its disclosed fee applies; repairs still require a separate approved quote.', start: 'Start only the approved scope and total shown below.', complete: 'Confirm that all approved work is complete. This issues the invoice; it does not mark it paid.' };
  return <Modal visible animationType="slide" onRequestClose={close}><KeyboardAvoidingView style={[styles.screen, { paddingTop: insets.top }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <View style={styles.jobHeader}><Pressable accessibilityRole="button" accessibilityLabel="Back to jobs" disabled={locked} onPress={close} style={styles.back}><MaterialCommunityIcons name="arrow-left" size={24} color={COLORS.textPrimary} /></Pressable><Text accessibilityRole="header" style={styles.jobTitle}>Job details</Text><Avatar name={job.customerName} size={40} radius={12} /></View>
    <ScrollView ref={scroll} keyboardShouldPersistTaps="handled" contentContainerStyle={[styles.scrollContent, { paddingBottom: Math.max(24, insets.bottom) }]}>
      {!!notice && <Text accessibilityLiveRegion="polite" style={styles.successNotice}>{notice}</Text>}
      {!!error && <View style={styles.errorCard}><Text accessibilityRole="alert" style={styles.jobError}>{error}</Text><Action secondary title="Refresh job details" disabled={locked} onPress={() => load()} /></View>}
      <View style={styles.card}><View style={styles.cardTop}><View style={{ flex: 1 }}><Text style={styles.name}>{job.service}</Text><Text style={styles.service}>{job.customerName}</Text></View><Badge status={job.status} /></View><Text style={styles.description}>{job.reference}</Text><View accessibilityLiveRegion="polite" style={styles.details}><Text style={styles.detailValue}>{nextAction(job)}</Text></View><Detail label={job.scheduleConfirmed ? 'Confirmed appointment · Sri Lanka time' : 'Requested appointment · Sri Lanka time'} value={bookingPreference(job)} />{job.proposedStartsAt && <Detail label="Suggested time · needs customer approval" value={bookingWhen(job.proposedStartsAt)} />}<Detail label="Address" value={job.location} /><Detail label="Problem description" value={job.problem} />{!!job.notes && <Detail label="Access notes" value={job.notes} />}</View>
      {!editor && !confirmation && <View style={styles.card}>
        {job.status === 'pending' && <Action title={job.scheduleMode === 'flexible' ? 'Choose time & accept' : 'Accept request'} disabled={locked} onPress={() => job.scheduleMode === 'flexible' ? setEditor('time') : run('confirm')} />}
        {NEW.includes(job.status) && <><Action secondary title="Suggest another time" disabled={locked} onPress={() => setEditor('time')} /><Action danger title="Decline request" disabled={locked} onPress={() => setConfirmation({ action: 'reject', version: job.version })} /></>}
        {canQuote(job) && <Action title={job.quote ? 'Revise quote' : 'Prepare quote'} secondary={job.status === 'confirmed' || job.status === 'ongoing'} disabled={locked} onPress={() => setEditor('quote')} />}
        {job.status === 'inspection_confirmed' && <Action title="Record completed inspection" disabled={locked} onPress={() => setConfirmation({ action: 'inspect', version: job.version })} />}
        {job.status === 'confirmed' && job.quote?.status === 'accepted' && <Action title="Start approved work" disabled={locked} onPress={() => setConfirmation({ action: 'start', version: job.version })} />}
        {job.status === 'ongoing' && job.quote?.status === 'accepted' && <Action title="Complete job & issue invoice" disabled={locked} onPress={() => setConfirmation({ action: 'complete', version: job.version })} />}
        <Action secondary title="Message customer" disabled={locked} onPress={onMessage} /><Action secondary title="Refresh job" disabled={locked} onPress={() => load()} />
      </View>}
      {!!confirmation && <View style={styles.card}><Text style={styles.name}>Confirm action</Text><Text style={styles.description}>{confirmCopy[confirmation.action]}</Text>{confirmation.version !== job.version && <Text accessibilityRole="alert" style={styles.jobError}>This job changed. Go back and review its current details.</Text>}<Action title="Confirm action" danger={confirmation.action === 'reject'} disabled={locked || confirmation.version !== job.version} onPress={() => run(confirmation.action, confirmation.version)} /><Action secondary title="Keep reviewing job" disabled={locked} onPress={() => setConfirmation(null)} /></View>}
      {editor && !editorVisible && <View style={styles.errorCard}><Text accessibilityRole="alert" style={styles.jobError}>This job changed and this action is no longer available. Your draft remains open for reference.</Text><Action secondary title="Back to current job" disabled={locked} onPress={() => setEditor(null)} /></View>}
      {editor === 'time' && <TimeEditor job={job} busy={locked || !editorVisible} update={updateJob} onDone={finished} />}
      {editor === 'quote' && <QuoteEditor job={job} busy={locked || !editorVisible} update={updateJob} onDone={finished} />}
      <BookingCharges booking={job} provider onUpdate={onUpdate} onBusyChange={setPaymentBusy} />
      <View style={[styles.card, { marginTop: 14 }]}><Text style={styles.name}>Booking history</Text>{[...(job.history || [])].reverse().map((entry, i) => <Detail key={i} label={EVENTS[entry.action] || LABELS[entry.status] || 'Booking updated'} value={bookingWhen(entry.at) + ' · Sri Lanka time'} />)}{!job.history?.length && <Text style={styles.description}>No activity recorded yet.</Text>}</View>
    </ScrollView>
  </KeyboardAvoidingView></Modal>;
}

const ProviderRequestsScreen = ({ navigation, route }) => {
  const focused = useIsFocused();
  const { bookings, pendingCount, loading, error, busy, load, update, onUpdate } = useProviderData();
  const [tab, setTab] = useState('New requests'), [selected, setSelected] = useState(null);
  const groups = { 'New requests': NEW, 'Active jobs': ACTIVE, History: HISTORY };
  const handled = useRef(null);
  useFocusEffect(useCallback(() => {
    if (route?.params?.openRequest && handled.current !== route.params.openRequest) {
      handled.current = route.params.openRequest;
      setSelected(route.params.bookingId || null);
      if (['New requests', 'Active jobs', 'History'].includes(route.params.group)) setTab(route.params.group);
      void load();
    }
  }, [route, load]));
  const jobs = bookings.filter(job => groups[tab].includes(job.status)).sort((a, b) => tab === 'History' ? new Date(b.updatedAt) - new Date(a.updatedAt) : new Date(a.startsAt) - new Date(b.startsAt));
  const job = bookings.find(b => b.id === selected);
  return <View style={styles.screen}>
    {focused && <StatusBar barStyle="dark-content" backgroundColor={COLORS.secondary} />}
    <ScreenHeader title="Booking requests" subtitle={pendingCount + ' awaiting your response'}><BellButton /></ScreenHeader>
    <View style={styles.filters}>{Object.keys(groups).map(name => <Pressable key={name} accessibilityRole="tab" aria-selected={tab === name} accessibilityState={{ selected: tab === name }} onPress={() => setTab(name)} style={[styles.filter, tab === name && styles.selectedChip]}><Text style={[styles.filterText, tab === name && styles.white]}>{name}</Text></Pressable>)}</View>
    <ScrollView contentContainerStyle={styles.scrollContent}>
      {loading && <ActivityIndicator accessibilityLabel="Loading jobs" color={COLORS.primary} />}
      {!!error && <Text accessibilityRole="alert" style={styles.jobError}>{error}</Text>}
      <Action secondary title="Refresh jobs" disabled={busy || loading} onPress={() => load()} />
      {jobs.map(item => <JobCard key={item.id} job={item} onOpen={() => setSelected(item.id)} />)}
      {!loading && !error && !jobs.length && <View style={styles.empty}><View style={styles.emptyIcon}><MaterialCommunityIcons name="briefcase-outline" size={32} color={COLORS.primary} /></View><Text style={styles.emptyTitle}>No {tab.toLowerCase()}</Text><Text style={styles.emptyText}>{tab === 'New requests' ? 'New customer requests will appear here.' : tab === 'Active jobs' ? 'Accepted appointments and ongoing work appear here.' : 'Completed, cancelled and declined jobs stay here, including invoices and receipts.'}</Text></View>}
    </ScrollView>
    {!!job && <JobDetails key={job.id} job={job} busy={busy} error={error} load={load} update={update} onUpdate={onUpdate} onClose={() => { setSelected(null); setTab(NEW.includes(job.status) ? 'New requests' : ACTIVE.includes(job.status) ? 'Active jobs' : 'History'); }} onMessage={() => { setSelected(null); navigation.navigate('Messages', { bookingId: job.id, openRequest: Date.now() }); }} />}
    {!!selected && !job && <Modal visible onRequestClose={() => setSelected(null)}><View style={styles.scrollContent}><Text style={styles.description}>{loading ? "Loading this job…" : error || "This booking is no longer available to this account."}</Text><Action title="Retry loading job" disabled={loading} onPress={() => load()} /><Action title="Back to jobs" onPress={() => setSelected(null)} /></View></Modal>}
  </View>;
};


const styles = StyleSheet.create({
  jobButton: { minHeight: 48, padding: 14, borderRadius: 13, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center', marginTop: 10 },
  jobSecondary: { backgroundColor: '#FFF', borderWidth: 1, borderColor: COLORS.inputBorder },
  jobDanger: { backgroundColor: '#FDECED', borderWidth: 1, borderColor: '#F4B9B9' },
  jobButtonText: { color: '#FFF', fontWeight: '700', fontSize: 14, textAlign: 'center', flexShrink: 1 },
  jobDetail: { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#ECECF1' },
  jobLabel: { color: COLORS.textPrimary, fontSize: 13, fontWeight: '600', marginTop: 12, marginBottom: 6 },
  jobInput: { minHeight: 52, padding: 14, backgroundColor: '#FFF', borderWidth: 1, borderColor: COLORS.inputBorder, borderRadius: 12, fontSize: 14, color: COLORS.textPrimary },
  multiline: { minHeight: 104, textAlignVertical: 'top' },
  jobError: { color: '#B52636', fontSize: 14, lineHeight: 21, marginVertical: 8 },
  successNotice: { color: '#08734C', backgroundColor: '#E7F6F0', padding: 14, borderRadius: 12, marginBottom: 14, lineHeight: 21 },
  errorCard: { backgroundColor: '#FDECED', padding: 14, borderRadius: 12, marginBottom: 14 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  timeChip: { minWidth: 100, minHeight: 48, padding: 10, borderWidth: 1, borderColor: COLORS.inputBorder, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  selectedChip: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  white: { color: '#FFF', fontWeight: '600' },
  filters: { flexDirection: 'row', gap: 6, paddingHorizontal: 20, paddingTop: 14, width: '100%', maxWidth: 680, alignSelf: 'center' },
  filter: { flex: 1, minHeight: 48, paddingVertical: 10, paddingHorizontal: 6, borderWidth: 1, borderColor: COLORS.inputBorder, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFF' },
  filterText: { color: COLORS.textPrimary, fontSize: 12, fontWeight: '600', textAlign: 'center' },
  jobHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 10, gap: 10, width: '100%', maxWidth: 680, alignSelf: 'center' },
  back: { minWidth: 44, minHeight: 44, justifyContent: 'center' },
  jobTitle: { flex: 1, fontSize: 22, fontWeight: '700', color: COLORS.textPrimary },
  screen: { flex: 1, backgroundColor: COLORS.background },
  body: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 24, width: '100%', maxWidth: 680, alignSelf: 'center', gap: 8 },
  pressed: { opacity: 0.85 },

  notice: {
    position: "absolute",
    top: 10,
    left: 20,
    right: 20,
    zIndex: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#DDF5EA",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    ...SHADOWS.small,
  },
  noticeText: { flex: 1, fontSize: 13, fontWeight: "700", color: "#0F8A5F" },

  // Card
  card: {
    backgroundColor: COLORS.cardBg,
    borderRadius: 24,
    padding: 16,
    marginBottom: 14,
    ...SHADOWS.small,
  },
  cardTop: { flexDirection: "row", alignItems: "flex-start" },
  cardInfo: { flex: 1, marginLeft: 14, marginRight: 8 },
  name: { fontSize: 16, fontWeight: "800", color: COLORS.textPrimary },
  service: { fontSize: 14, fontWeight: "700", color: COLORS.primary, marginTop: 4 },
  tag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  tagUrgent: { backgroundColor: "#FDE8E8" },
  urgentDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#D93A3A" },
  tagUrgentText: { fontSize: 12, fontWeight: "800", color: "#D93A3A" },
  tagStandard: { backgroundColor: "#EFEFF4" },
  tagStandardText: { fontSize: 12, fontWeight: "700", color: COLORS.textMuted },

  description: {
    fontSize: 14,
    lineHeight: 21,
    color: COLORS.textPrimary,
    marginTop: 14,
  },

  details: {
    backgroundColor: "#F4F5F9",
    borderRadius: 16,
    padding: 14,
    marginTop: 14,
  },
  detailRow: { flexDirection: "row" },
  detailRowSpaced: { marginTop: 12 },
  detail: { flex: 1 },
  detailRight: { alignItems: "flex-end", flex: 1, marginLeft: 10 },
  locationCol: { flex: 1 },
  detailLabel: { fontSize: 12, color: COLORS.textMuted },
  detailValue: { fontSize: 14, fontWeight: "700", color: COLORS.textPrimary, marginTop: 3 },
  detailStrong: { fontWeight: "800" },

  photoRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 12 },
  photoText: { fontSize: 13, color: COLORS.textMuted },

  actions: { flexDirection: "row", gap: 10, marginTop: 16 },
  btn: {
    minHeight: 46,
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  btnDetails: {
    flex: 0.8,
    borderWidth: 1,
    borderColor: COLORS.inputBorder,
    backgroundColor: COLORS.secondary,
  },
  btnDetailsText: { fontSize: 14, fontWeight: "800", color: COLORS.textPrimary },
  btnReject: {
    flex: 1,
    backgroundColor: "#FDE8E8",
    borderWidth: 1,
    borderColor: "#F4B9B9",
  },
  btnRejectText: { fontSize: 14, fontWeight: "800", color: "#D93A3A" },
  btnAccept: { flex: 1, backgroundColor: COLORS.primary, ...SHADOWS.medium },
  btnAcceptText: { fontSize: 14, fontWeight: "800", color: "#FFFFFF" },

  // Empty
  empty: { alignItems: "center", paddingTop: 80, paddingHorizontal: 24 },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 22,
    backgroundColor: "#EEEAFD",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  emptyTitle: { fontSize: 17, fontWeight: "800", color: COLORS.textPrimary },
  emptyText: {
    fontSize: 14,
    color: COLORS.textMuted,
    textAlign: "center",
    marginTop: 6,
    lineHeight: 20,
  },
});

export default ProviderRequestsScreen;
