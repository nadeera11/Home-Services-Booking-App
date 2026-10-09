import React, { useCallback, useEffect, useRef, useState } from "react";
import { View, Text, Pressable, ScrollView, Modal, StatusBar, StyleSheet, ActivityIndicator, TextInput } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect, useIsFocused } from "@react-navigation/native";
import { COLORS, SHADOWS } from "../../constants/theme";
import ScreenHeader, { BellButton } from "../../components/provider/ScreenHeader";
import { providerService } from "../../services/providerService";
import { bookingService, BOOKING_TIMES, bookingTime, bookingDate } from "../../services/bookingService";
import { useProviderData } from "../../context/ProviderContext";
import { sriLankaDay } from "../../constants/providerData";

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'], ORDER = [1, 2, 3, 4, 5, 6, 0];
const shift = (key, n) => new Date(Date.parse(key + 'T00:00:00Z') + n * 86400000).toISOString().slice(0, 10);
const weekday = key => new Date(key + 'T00:00:00Z').getUTCDay();
const at = (key, time = '08:00') => new Date(key + 'T' + time + ':00+05:30').toISOString();
const stamp = key => at(key, '12:00');
const message = e => e.response?.data?.message || 'Could not connect. Your changes are kept. Check your connection and retry.';
const legacyDay = value => { const parts = value.split('-'); return parts.length === 3 ? parts[0] + '-' + parts[1].padStart(2, '0') + '-' + parts[2].padStart(2, '0') : value; };
function Button({ title, onPress, disabled, secondary }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled: !!disabled }} disabled={disabled} onPress={onPress} style={[styles.control, secondary && styles.controlSecondary, disabled && { opacity: 0.45 }]}><Text style={[styles.controlText, secondary && { color: COLORS.primary }]}>{title}</Text></Pressable>;
}
function ScheduleSettings({ calendar, busy, save }) {
  const [duration, setDuration] = useState(String(calendar.durationMinutes)), [buffer, setBuffer] = useState(String(calendar.bufferMinutes));
  const [error, setError] = useState(''), [baseline, setBaseline] = useState({ duration: calendar.durationMinutes, buffer: calendar.bufferMinutes });
  const stale = baseline.duration !== calendar.durationMinutes || baseline.buffer !== calendar.bufferMinutes;
  return <View style={[styles.card, styles.cardSpaced]}><Text style={styles.dayTitle}>Service & travel time</Text><Text style={styles.note}>Applies to new requests. Existing bookings keep their agreed duration and travel buffer.</Text><Text style={styles.cardTitle}>Service duration (minutes)</Text><TextInput accessibilityLabel="Service duration in minutes" keyboardType="number-pad" value={duration} onChangeText={setDuration} editable={!busy} maxLength={3} style={styles.input} /><Text style={styles.cardTitle}>Travel buffer (minutes)</Text><TextInput accessibilityLabel="Travel buffer in minutes" keyboardType="number-pad" value={buffer} onChangeText={setBuffer} editable={!busy} maxLength={3} style={styles.input} />{!!error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}{stale && <><Text accessibilityRole="alert" style={styles.note}>Appointment settings changed elsewhere. Current settings: {calendar.durationMinutes} min service, {calendar.bufferMinutes} min travel. Your draft is kept.</Text><Button secondary title="Review current settings and keep my draft" disabled={busy} onPress={() => setBaseline({ duration: calendar.durationMinutes, buffer: calendar.bufferMinutes })} /></>}<Button secondary title="Save duration & buffer" disabled={busy || stale} onPress={async () => {
    if (!/^\d+$/.test(duration) || !/^\d+$/.test(buffer) || +duration < 30 || +duration > 480 || +buffer > 120) { setError('Use 30–480 minutes for service and 0–120 minutes for travel.'); return; }
    setError(''); const saved = await save(() => bookingService.saveScheduleSettings({ durationMinutes: +duration, bufferMinutes: +buffer, version: calendar.version })); if (saved) setBaseline({ duration: saved.durationMinutes, buffer: saved.bufferMinutes });
  }} /></View>;
}
const ProviderCalendarScreen = ({ navigation }) => {
  const { online } = useProviderData();
  const focused = useIsFocused(), insets = useSafeAreaInsets();
  const [selected, setSelected] = useState(() => sriLankaDay(new Date())), [calendar, setCalendar] = useState(null);
  const [loading, setLoading] = useState(true), [busy, setBusy] = useState(false), [error, setError] = useState(''), [notice, setNotice] = useState('');
  const [needsRefresh, setNeedsRefresh] = useState(false);
  const [sheet, setSheet] = useState(false), [time, setTime] = useState(''), [withdraw, setWithdraw] = useState(null);
  const lock = useRef(false), request = useRef(null), scroll = useRef(null), dayStrip = useRef(null);
  useEffect(() => { dayStrip.current?.scrollTo({ x: Math.max(0, weekday(selected) * 56 - 100), animated: false }); }, [selected]);
  const load = useCallback(async (quiet = false) => {
    if (lock.current) return;
    request.current?.abort(); const c = new AbortController(); request.current = c;
    if (!quiet) setLoading(true);
    try { const result = await providerService.getAvailability(c.signal); if (!c.signal.aborted) { setCalendar(result); setNeedsRefresh(false); setError(''); } }
    catch (e) { if (!c.signal.aborted) setError(message(e)); }
    finally { if (!c.signal.aborted) setLoading(false); }
  }, []);
  useFocusEffect(useCallback(() => { void load(); const timer = setInterval(() => load(true), 30000); return () => { clearInterval(timer); request.current?.abort(); }; }, [load]));
  async function save(action, after) {
    if (lock.current || needsRefresh) return;
    lock.current = true; request.current?.abort(); setLoading(false); setBusy(true); setError(''); setNotice('');
    let committed = false;
    try {
      await action(); committed = true; after?.(); setNotice('Saved. Existing bookings remain scheduled.');
      const result = await providerService.getAvailability(); setCalendar(result); return result;
    } catch (e) { setNeedsRefresh(true); setError(committed ? 'Your change was saved, but the calendar could not refresh. Refresh calendar before making another change.' : message(e) + ' Refresh calendar before trying again.'); scroll.current?.scrollTo({ y: 0, animated: true }); }
    finally { lock.current = false; setBusy(false); }
  }
  const today = sriLankaDay(new Date()), futureDay = selected >= today && selected <= shift(today, 89);
  const weekStart = shift(selected, -weekday(selected)), days = Array.from({ length: 7 }, (_, i) => shift(weekStart, i));
  const isOpen = date => !!calendar && calendar.workingDays[weekday(date)] !== false && !calendar.offDates.includes(date);
  const isOff = calendar?.offDates.includes(selected), open = isOpen(selected);
  const reservations = (calendar?.bookings || []).filter(b => sriLankaDay(b.startsAt) === selected);
  const published = (calendar?.slots || []).filter(s => s.date === selected && !reservations.some(b => b.startsAt === s.startsAt));
  const legacy = (calendar?.legacySlots || []).filter(s => legacyDay(s.dateKey) === selected);
  const count = published.filter(s => s.available).length;
  const statusFor = date => (calendar?.bookings || []).some(b => sriLankaDay(b.startsAt) === date) ? 'Reserved / booked' : (calendar?.slots || []).some(s => s.date === date && s.available) ? 'Available' : 'No open slots';
  const blocked = busy || needsRefresh || loading;
  const weeklyPaused = calendar?.workingDays[weekday(selected)] === false;
  const timeReason = t => {
    const start = at(selected, t), begin = Date.parse(start);
    if (!futureDay || begin <= new Date().getTime()) return 'Outside booking window';
    if (calendar?.slots.some(s => s.startsAt === start)) return 'Published';
    if ((calendar?.bookings || []).some(b => begin < Date.parse(b.startsAt) + ((b.durationMinutes ?? 60) + (b.bufferMinutes ?? 30)) * 60000 && Date.parse(b.startsAt) < begin + (calendar.durationMinutes + calendar.bufferMinutes) * 60000)) return 'Booking / travel conflict';
    return '';
  };
  const close = () => { if (!busy) setSheet(false); };
  return <View style={styles.screen}>
    {focused && <StatusBar barStyle="dark-content" backgroundColor={COLORS.secondary} />}
    <ScreenHeader title="Availability" subtitle={bookingDate(stamp(selected), { day: undefined, month: 'long', year: 'numeric' }) + ' · Sri Lanka time'}><BellButton /></ScreenHeader>
    <ScrollView ref={scroll} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.scrollContent}>
      {loading && <ActivityIndicator accessibilityLabel="Loading calendar" color={COLORS.primary} />}
      {!!error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
      {!!notice && <Text accessibilityLiveRegion="polite" style={styles.note}>{notice}</Text>}
      <Button secondary title="Refresh calendar" disabled={busy || loading} onPress={() => load()} />
      {calendar && <>
        {!online && <View style={styles.card}><Text style={styles.dayTitle}>New requests are paused</Text><Text style={styles.note}>You can prepare availability here. Go online from your dashboard when you are ready to receive customer requests.</Text><Button secondary title="Open dashboard" onPress={() => navigation.navigate('Dashboard')} /></View>}
        <Text style={styles.note}>Choose a date, then add an appointment start. Weekly rules and date pauses control which saved appointments customers can select.</Text>
        <View style={styles.card}>
          {selected !== today && <Button secondary title="Go to today" disabled={busy} onPress={() => { setSelected(today); setWithdraw(null); }} />}
          <View style={styles.weekHeader}><Pressable accessibilityRole="button" accessibilityLabel="Previous week" disabled={busy} onPress={() => setSelected(shift(selected, -7))} style={styles.navBtn}><MaterialCommunityIcons name="chevron-left" size={22} /></Pressable><Text style={[styles.weekText, { flex: 1, textAlign: 'center' }]}>{bookingDate(stamp(weekStart))} – {bookingDate(stamp(shift(weekStart, 6)))}</Text><Pressable accessibilityRole="button" accessibilityLabel="Next week" disabled={busy} onPress={() => setSelected(shift(selected, 7))} style={styles.navBtn}><MaterialCommunityIcons name="chevron-right" size={22} /></Pressable></View>
          <ScrollView ref={dayStrip} horizontal onContentSizeChange={() => dayStrip.current?.scrollTo({ x: Math.max(0, weekday(selected) * 56 - 100), animated: false })} contentContainerStyle={styles.daysRow}>{days.map(date => { const status = statusFor(date), active = date === selected; return <Pressable key={date} accessibilityRole="button" accessibilityLabel={date + ', ' + status} accessibilityState={{ selected: active, disabled: busy }} disabled={busy} onPress={() => { setSelected(date); setWithdraw(null); }} style={[styles.dayPill, active && styles.dayPillActive]}><Text style={[styles.dayName, active && { color: '#FFF' }]}>{DAYS[weekday(date)]}</Text><Text style={[styles.dayNum, active && { color: '#FFF' }]}>{Number(date.slice(8))}</Text><View style={[styles.dayDot, { backgroundColor: active ? '#FFF' : status === 'Reserved / booked' ? COLORS.primary : status === 'Available' ? '#0F8A5F' : '#D9DDE7' }]} /></Pressable>; })}</ScrollView>
          <View style={styles.legend}>{[['Available', '#0F8A5F'], ['Reserved / booked', COLORS.primary], ['No open slots', '#777']].map(([label, color]) => <View key={label} style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: color }]} /><Text style={styles.legendText}>{label}</Text></View>)}</View>
        </View>
        <View style={[styles.card, styles.cardSpaced]}><Text style={styles.cardTitle}>Weekly publishing days</Text>{!!calendar.unrecognizedOffDates?.length && <Text style={styles.note}>Some older unavailable dates could not be interpreted. They are preserved for review: {calendar.unrecognizedOffDates.join(", ")}</Text>}<Text style={styles.note}>Applies every week and saves immediately. Turn a weekday off to pause its published appointments. Turning it on restores saved starts; it does not create appointments. Existing bookings stay scheduled.</Text><View style={styles.workRow}>{ORDER.map(d => <Pressable key={d} accessibilityRole="checkbox" aria-checked={calendar.workingDays[d] !== false} accessibilityState={{ checked: calendar.workingDays[d] !== false, disabled: busy }} disabled={blocked} onPress={() => save(() => providerService.updateWorkingDays({ ...calendar.workingDays, [d]: calendar.workingDays[d] === false }, calendar.version))} style={[styles.workChip, calendar.workingDays[d] !== false && styles.workChipOn]}><Text style={styles.workTextOn}>{DAYS[d]} {calendar.workingDays[d] !== false ? '✓' : '−'}</Text></Pressable>)}</View></View>
        <View style={styles.dayHeader}><Text style={styles.dayTitle}>{bookingDate(stamp(selected), { weekday: 'short' })}</Text><Text style={styles.dayCount}>{reservations.length} reserved · {count} open</Text></View>
        {!open && <View style={styles.card}><Text style={styles.dayTitle}>Publishing paused</Text><Text style={styles.note}>{weeklyPaused ? DAYS[weekday(selected)] + ' is disabled in your weekly publishing days. Enable it above to publish on this weekday.' : 'This date is marked unavailable. Resume this date to restore its saved appointments.'}{weeklyPaused && isOff ? ' This date is also marked unavailable; both pauses must be removed.' : ''} Existing bookings remain scheduled. Customers can still send preferred-time requests for your review.</Text></View>}
        <View style={[styles.actionBar, { flexWrap: 'wrap' }]}><Button secondary title={isOff ? (weeklyPaused ? 'Remove date pause' : 'Resume this date') : 'Mark date unavailable'} disabled={blocked || !futureDay} onPress={() => save(() => providerService.toggleOffDate(selected, !isOff, calendar.version))} /><Button title="Add availability" disabled={blocked || !open || !futureDay} onPress={() => { setTime(''); setError(''); setSheet(true); }} /></View>
        {!futureDay && <Text style={styles.note}>Select today or a date within the next 90 days to publish appointments.</Text>}
        {reservations.map(b => <Pressable key={b.id} accessibilityRole="button" onPress={() => navigation.navigate('Requests', { bookingId: b.id, openRequest: Date.now() })} style={[styles.slot, { borderLeftColor: COLORS.primary }]}><View style={styles.slotTime}><Text style={styles.slotStart}>{bookingTime(b.startsAt)}</Text><Text style={styles.slotEnd}>{bookingTime(new Date(new Date(b.startsAt).getTime() + b.durationMinutes * 60000))}</Text></View><View style={styles.slotBody}><Text style={styles.slotTitle}>{b.service}</Text><Text style={styles.slotSub}>{b.customerName}</Text><Text style={styles.slotSub}>{b.scheduleConfirmed ? 'Booked' : 'Reserved · request pending'} · {b.bufferMinutes} min travel</Text><Text style={styles.workTextOn}>View job</Text></View></Pressable>)}
        {published.map(slot => <View key={slot.startsAt} style={[styles.slot, { borderLeftColor: slot.available ? '#0F8A5F' : '#777', flexWrap: 'wrap' }]}><View style={styles.slotTime}><Text style={styles.slotStart}>{bookingTime(slot.startsAt)}</Text><Text style={styles.slotEnd}>{calendar.durationMinutes} min</Text></View><View style={styles.slotBody}><Text style={styles.slotTitle}>{slot.reserved ? 'Blocked by booking / travel' : slot.paused ? 'Publication paused' : slot.available ? 'Open for bookings' : 'Outside booking window'}</Text><Text style={styles.slotSub}>{calendar.bufferMinutes} min travel buffer</Text>{!slot.reserved && new Date(slot.startsAt) > new Date() && <Button secondary title="Withdraw appointment" disabled={busy} onPress={() => setWithdraw(slot.startsAt)} />}{withdraw === slot.startsAt && <><Text style={styles.note}>Remove this published start from customer selection?</Text><Button title="Confirm withdrawal" disabled={blocked} onPress={() => save(() => bookingService.removeSlot(slot.startsAt), () => setWithdraw(null))} /><Button secondary title="Keep appointment" disabled={busy} onPress={() => setWithdraw(null)} /></>}</View></View>)}
        {!reservations.length && !published.length && <View style={styles.empty}><MaterialCommunityIcons name="calendar-blank-outline" size={28} color={COLORS.primary} /><Text style={styles.emptyTitle}>No appointments published</Text><Text style={styles.emptyText}>Publish a specific start time for customers to select. An empty day does not mean all-day availability.</Text></View>}
        {!!legacy.length && <View style={styles.card}><Text style={styles.dayTitle}>Previous calendar intervals</Text><Text style={styles.note}>Preserved for reference, not published appointments. Choose explicit starts using Add availability. No interval has been converted or deleted.</Text>{legacy.map((s, i) => <Text key={s._id || i} style={styles.note}>{s.title} · {Math.floor(s.start / 60)}:{String(s.start % 60).padStart(2, '0')}–{Math.floor(s.end / 60)}:{String(s.end % 60).padStart(2, '0')} · Legacy {s.type}</Text>)}</View>}
        <ScheduleSettings calendar={calendar} busy={blocked} save={save} />
      </>}
    </ScrollView>
    <Modal visible={sheet} transparent animationType="slide" onRequestClose={close}><View style={styles.sheetRoot}><Pressable accessibilityRole="button" accessibilityLabel="Close availability editor" style={styles.backdrop} onPress={close} /><View style={[styles.sheet, { maxHeight: '88%', paddingBottom: insets.bottom + 16 }]}><ScrollView keyboardShouldPersistTaps="handled"><Text accessibilityRole="header" style={styles.sheetTitle}>Add availability</Text><Text style={styles.note}>{bookingDate(stamp(selected))} · Sri Lanka time</Text><Text style={styles.note}>Publish one appointment start. Service: {calendar?.durationMinutes} min · travel: {calendar?.bufferMinutes} min. Times blocked by a booking or its travel buffer cannot be selected. Publishing lets customers request this appointment; you still review each request.</Text><View style={styles.chipWrap}>{BOOKING_TIMES.map(t => { const start = at(selected, t), reason = timeReason(t); const disabled = blocked || !open || !!reason; return <Pressable key={t} accessibilityRole="button" accessibilityState={{ selected: t === time, disabled: !!disabled }} disabled={disabled} onPress={() => setTime(t)} style={[styles.optChip, t === time && styles.optChipActive, disabled && { opacity: 0.4 }]}><Text style={[styles.optText, t === time && styles.optTextActive]}>{bookingTime(start)}{reason ? ' · ' + reason : ''}</Text></Pressable>; })}</View>{!!time && <Text accessibilityLiveRegion="polite" style={styles.note}>{timeReason(time) || ('Selected: ' + bookingTime(at(selected, time)) + '–' + bookingTime(new Date(Date.parse(at(selected, time)) + calendar.durationMinutes * 60000)) + ' · Travel buffer until ' + bookingTime(new Date(Date.parse(at(selected, time)) + (calendar.durationMinutes + calendar.bufferMinutes) * 60000)))}</Text>}{!!error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}{needsRefresh && <Button secondary title="Refresh calendar" disabled={busy || loading} onPress={() => load()} />}<Button title={busy ? 'Publishing…' : 'Publish appointment'} disabled={blocked || !time || !open || !!timeReason(time)} onPress={() => save(() => bookingService.publishSlot(at(selected, time)), () => setSheet(false))} /><Button secondary title="Close editor" disabled={busy} onPress={close} /></ScrollView></View></View></Modal>
  </View>;
};


const styles = StyleSheet.create({
  control: { minHeight: 48, backgroundColor: COLORS.primary, padding: 12, borderRadius: 13, marginVertical: 6, justifyContent: 'center', alignItems: 'center' },
  controlSecondary: { backgroundColor: '#FFF', borderWidth: 1, borderColor: COLORS.inputBorder },
  controlText: { color: '#FFF', fontSize: 14, fontWeight: '700', textAlign: 'center', flexShrink: 1 },
  input: { borderWidth: 1, borderColor: COLORS.inputBorder, borderRadius: 12, minHeight: 48, padding: 12, marginVertical: 10, color: COLORS.textPrimary, fontSize: 16 },
  note: { color: COLORS.textMuted, fontSize: 14, lineHeight: 21, marginVertical: 10 },
  error: { color: '#B52636', fontSize: 14, lineHeight: 21, marginVertical: 10 },
  screen: { flex: 1, backgroundColor: COLORS.background },
  centerLoading: { flex: 1, justifyContent: "center", alignItems: "center" },
  loadingText: { marginTop: 12, fontSize: 14, color: COLORS.textMuted, fontWeight: "600" },

  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 20, width: "100%", maxWidth: 760, alignSelf: "center" },
  pressed: { opacity: 0.85 },

  card: {
    backgroundColor: COLORS.cardBg,
    borderRadius: 24,
    padding: 16,
    ...SHADOWS.small,
  },
  cardSpaced: { marginTop: 14 },
  cardTitle: { fontSize: 13, fontWeight: "700", color: COLORS.textMuted },

  // Week
  weekHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  navBtn: {
    width: 48,
    height: 48,
    borderRadius: 10,
    backgroundColor: "#F1F2F6",
    alignItems: "center",
    justifyContent: "center",
  },
  weekText: { fontSize: 15, fontWeight: "800", color: COLORS.textPrimary },
  daysRow: { flexDirection: "row", gap: 6, marginTop: 16 },
  dayPill: {
    minWidth: 48,
    paddingHorizontal: 8,
    alignItems: "center",
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.inputBorder,
    backgroundColor: COLORS.secondary,
  },
  dayPillActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  dayName: { fontSize: 11, fontWeight: "600" },
  dayNum: { fontSize: 17, fontWeight: "800", marginTop: 3 },
  dayDot: { width: 6, height: 6, borderRadius: 3, marginTop: 6 },
  legend: {
    flexDirection: "row",
    gap: 12,
    flexWrap: "wrap",
    marginTop: 16,
    paddingTop: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: COLORS.inputBorder,
  },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: 12, color: COLORS.textMuted },

  // Working days
  workRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12 },
  workChip: {
    paddingHorizontal: 14,
    minHeight: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.inputBorder,
    backgroundColor: COLORS.secondary,
    alignItems: "center",
    justifyContent: "center",
  },
  workChipOn: { backgroundColor: "#EEEAFD", borderColor: "#CFC3FA" },
  workText: { fontSize: 13, fontWeight: "700", color: COLORS.disabledText },
  workTextOn: { color: COLORS.primary },

  // Day list
  dayHeader: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    alignItems: "baseline",
    justifyContent: "space-between",
    marginTop: 22,
    marginBottom: 12,
  },
  dayTitle: { fontSize: 19, fontWeight: "800", color: COLORS.textPrimary },
  dayCount: { fontSize: 13, color: COLORS.textMuted },
  slot: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.cardBg,
    borderRadius: 16,
    borderLeftWidth: 3,
    paddingVertical: 14,
    paddingHorizontal: 14,
    marginBottom: 10,
    ...SHADOWS.small,
  },
  slotTime: { width: 78 },
  slotStart: { fontSize: 14, fontWeight: "800", color: COLORS.textPrimary },
  slotEnd: { fontSize: 12, color: COLORS.textMuted, marginTop: 3 },
  slotBody: { flex: 1, paddingHorizontal: 8 },
  slotTitle: { fontSize: 14, fontWeight: "700", color: COLORS.textPrimary },
  slotSub: { fontSize: 12, color: COLORS.textMuted, marginTop: 3 },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 11, fontWeight: "800" },

  empty: { alignItems: "center", paddingVertical: 36, paddingHorizontal: 24 },
  emptyIcon: {
    width: 60,
    height: 60,
    borderRadius: 18,
    backgroundColor: "#EEEAFD",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  emptyTitle: { fontSize: 16, fontWeight: "800", color: COLORS.textPrimary },
  emptyText: { fontSize: 13, color: COLORS.textMuted, textAlign: "center", marginTop: 6, lineHeight: 19 },

  // Action bar
  actionBar: {
    flexDirection: "row",
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 12,
    backgroundColor: COLORS.secondary,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: COLORS.inputBorder,
  },
  actionBtn: {
    height: 50,
    borderRadius: 15,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  actionOutline: {
    flex: 1,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: COLORS.inputBorder,
    backgroundColor: COLORS.secondary,
  },
  actionOutlineText: { flexShrink: 1, fontSize: 14, fontWeight: "800", color: COLORS.textPrimary },
  actionPrimary: { flex: 1.25, backgroundColor: COLORS.primary, ...SHADOWS.medium },
  actionPrimaryText: { fontSize: 15, fontWeight: "800", color: "#FFFFFF" },

  // Sheet
  sheetRoot: { flex: 1, justifyContent: "flex-end" },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(20,15,45,0.55)" },
  sheet: {
    backgroundColor: COLORS.secondary,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  handle: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.inputBorder,
    marginBottom: 14,
  },
  sheetHeader: { flexDirection: "row", alignItems: "center", marginBottom: 6 },
  sheetTitle: { fontSize: 18, fontWeight: "800", color: COLORS.textPrimary },
  sheetSub: { fontSize: 13, color: COLORS.textMuted, marginTop: 2 },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: COLORS.inputBorder,
    alignItems: "center",
    justifyContent: "center",
  },
  sheetLabel: { fontSize: 13, fontWeight: "700", color: COLORS.textPrimary, marginTop: 16, marginBottom: 10 },
  chipWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  optChip: {
    paddingHorizontal: 12,
    minHeight: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.inputBorder,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.secondary,
  },
  optChipActive: { backgroundColor: "#EEEAFD", borderColor: "#CFC3FA" },
  optText: { fontSize: 13, fontWeight: "700", color: COLORS.textMuted },
  optTextActive: { color: COLORS.primary },
  summary: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#F4F5F9",
    borderRadius: 12,
    padding: 12,
    marginTop: 18,
  },
  summaryError: { backgroundColor: "#FDE8E8" },
  summaryText: { fontSize: 14, fontWeight: "700", color: COLORS.textPrimary },
  sheetFooter: { flexDirection: "row", gap: 12, marginTop: 18 },
  sheetBtn: { flex: 1, height: 50, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  sheetCancel: { borderWidth: 1, borderColor: COLORS.inputBorder },
  sheetCancelText: { fontSize: 15, fontWeight: "700", color: COLORS.textPrimary },
  sheetSave: { backgroundColor: COLORS.primary },
  sheetSaveText: { fontSize: 15, fontWeight: "800", color: "#FFFFFF" },
});

export default ProviderCalendarScreen;
