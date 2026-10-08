import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Modal, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View, LayoutAnimation, UIManager } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from "../../context/AuthContext";
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { bookingService, BOOKING_TIMES, bookingDate, bookingTime, bookingWhen, bookingPreference, bookingPrice, money } from '../../services/bookingService';
import { complaintService } from '../../services/complaintService';
import { paymentService } from '../../services/paymentService';
import { COLORS } from '../../constants/theme';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const ASSETS = {
  accent: require('../../../assets/images/booking/availability-imgBackgroundAccent.svg'),
  avatar: require('../../../assets/images/booking/availability-imgProviderProfileImage.svg'),
  dot: require('../../../assets/images/booking/availability-imgEllipse.svg'),
  selectedDot: require('../../../assets/images/booking/availability-imgEllipse1.svg'),
  selected: require('../../../assets/images/booking/availability-imgEllipse2.svg'),
  arrow: require('../../../assets/images/booking/availability-imgCtaArrow.svg'),
  success: require('../../../assets/images/booking/sent-imgEllipse.svg'),
};

const PROVIDER_PHOTOS = {
  'Arjun perera': require('../../../assets/images/Home/Arjun perera.jpg'),
  'Sanduni rathnayake': require('../../../assets/images/Home/Sanduni rathnayake.jpg'),
  'House Cleaning': require('../../../assets/images/Home/full home deep clean.jpg'),
  'Garage Cleaning': require('../../../assets/images/Home/full home deep clean.jpg'),
  'Painting the Walls': require('../../../assets/images/Home/Single room painting.jpg'),
  'Plumbing': require('../../../assets/images/Home/Leaking tap repair.jpg'),
  'Electrical': require('../../../assets/images/Home/Appliance repair.jpg'),
  'Ceiling Fan Repair': require('../../../assets/images/Home/Ceiling fan repair.jpg'),
};

const errorMessage = e => e.response?.data?.message || 'Unable to connect. Please try again.';
const initials = name => (name || '').trim().split(/\s+/).slice(0, 2).map(s => s[0]).join('').toUpperCase();
const localDay = value => new Date(new Date(value).getTime() + 19800000).toISOString().slice(0, 10);

function getProviderPhoto(b) {
  if (b.providerAvatar) return { uri: b.providerAvatar };
  if (b.providerName && PROVIDER_PHOTOS[b.providerName]) return PROVIDER_PHOTOS[b.providerName];
  if (b.service && PROVIDER_PHOTOS[b.service]) return PROVIDER_PHOTOS[b.service];
  return null;
}

function Button({ title, onPress, disabled, secondary, danger, arrow }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[s.button, secondary && s.secondary, danger && s.danger, disabled && s.disabled]}
    >
      <Text style={[s.buttonText, arrow && { paddingHorizontal: 24 }, secondary && s.link, danger && s.dangerText]}>
        {title}
      </Text>
      {arrow && <Image source={ASSETS.arrow} style={{ width: 20, height: 20, position: 'absolute', right: 20 }} />}
    </Pressable>
  );
}

function StatusBadge({ status }) {
  const STATUS_CONFIG = {
    pending: { label: 'Requested', bg: '#FDF4E1', text: '#8A5B00' },
    time_proposed: { label: 'Review time', bg: '#EBF5FF', text: '#1D63ED' },
    awaiting_quote: { label: 'Quote Needed', bg: '#F4F0FF', text: '#7F56D9' },
    quote_pending: { label: 'Review quote', bg: '#EEF2FF', text: '#4F46E5' },
    confirmed: { label: 'Confirmed', bg: '#E7F6F0', text: '#08734C' },
    inspection_confirmed: { label: 'Inspection booked', bg: '#E0F2FE', text: '#0369A1' },
    inspecting: { label: 'Inspection done', bg: '#E6FFFA', text: '#0D9488' },
    ongoing: { label: 'Upcoming', bg: '#7F56D9', text: '#FFFFFF' },
    completed: { label: 'Completed', bg: '#E7F6F0', text: '#08734C' },
    rejected: { label: 'Declined', bg: '#FDECED', text: '#B52636' },
    cancelled: { label: 'Cancelled', bg: '#FDECED', text: '#B52636' },
  };

  const config = STATUS_CONFIG[status] || {
    label: (status || '').replaceAll('_', ' '),
    bg: '#F4F0FF',
    text: '#7F56D9',
  };

  return (
    <View style={[s.statusBadge, { backgroundColor: config.bg }]}>
      <Text style={[s.statusBadgeText, { color: config.text }]}>{config.label}</Text>
    </View>
  );
}

function Detail({ label, value, edit }) {
  return (
    <View style={s.detail}>
      <View style={s.flex}>
        <Text style={s.caption}>{label}</Text>
        <Text style={s.value}>{value}</Text>
      </View>
      {edit && (
        <Pressable accessibilityRole="button" accessibilityLabel={`Edit ${label}`} onPress={edit} style={s.edit}>
          <Text style={s.link}>Edit</Text>
        </Pressable>
      )}
    </View>
  );
}

function nextAction(b) {
  if (b.payment?.status === 'paid') return ['Paid', 'The provider confirmed receipt. Your receipt is available.', 'View E-Receipt'];
  if (b.payment?.status === 'awaiting_confirmation') return ['Payment reported', 'The provider needs to confirm receipt. You can report an issue if you need help.', 'Payment details'];
  if (b.invoice && b.payment?.status === 'unpaid' && b.history?.some(h => h.action === 'payment_reject')) return ['Payment receipt not confirmed', 'Check your payment with the provider before paying again.', 'Review payment'];
  return ({
    pending: ['Waiting for provider response', 'The provider must accept your request. You can message them or cancel while waiting.', 'View Details'],
    time_proposed: ['Review a suggested time', 'Your provider suggested another appointment. Accept it or keep your request.', 'Review suggested time'],
    awaiting_quote: ['Appointment accepted — waiting for a quote', 'Your provider will send an itemised quote. No work or charge is agreed yet.', 'View Details'],
    quote_pending: ['Waiting for your approval', 'Review the scope and total. Work is paused until you decide.', 'Review quote'],
    confirmed: ['Appointment confirmed', 'Your provider will attend at the agreed time and update progress.', 'View E-Receipt'],
    inspection_confirmed: ['Inspection booked', 'Your provider will inspect the problem. Repairs need a separate approved quote.', 'View Details'],
    inspecting: ['Waiting for a repair quote', 'The inspection is recorded.', 'View Details'],
    ongoing: ['Work in progress', 'Your provider will mark the agreed work complete.', 'Track Work'],
    completed: ['Work completed — invoice available', 'Review the invoice and payment details.', 'View E-Receipt'],
    cancelled: ['Booking cancelled', 'This request is closed.', 'View Details'],
    rejected: ['Request declined', 'The provider did not accept this request.', 'View Details'],
  })[b.status] || ['Booking updated', 'Open your booking to see the latest details.', 'View Details'];
}

function NextAction({ booking }) {
  const [title, text] = nextAction(booking);
  return (
    <View accessibilityLiveRegion="polite" style={s.bookingInfo}>
      <Text style={s.value}>{title}</Text>
      <Text style={s.subtitle}>{text}</Text>
      {!!booking.createdAt && <Text style={s.caption}>Request sent {bookingWhen(booking.createdAt)}</Text>}
    </View>
  );
}

// Map Graphic Component for expanded details
function MapVisualPreview({ providerPhoto, providerName }) {
  return (
    <View style={s.mapContainer}>
      {/* Decorative map grid lines */}
      <View style={s.mapGridLineHorizontal1} />
      <View style={s.mapGridLineHorizontal2} />
      <View style={s.mapGridLineVertical1} />
      <View style={s.mapGridLineVertical2} />
      <View style={s.mapCircleOverlay1} />
      <View style={s.mapCircleOverlay2} />

      {/* Map Pin */}
      <View style={s.mapPinWrapper}>
        <View style={s.mapPinCircle}>
          {providerPhoto ? (
            <Image source={providerPhoto} style={s.mapPinImage} contentFit="cover" />
          ) : (
            <View style={s.mapPinInitialsBox}>
              <Text style={s.mapPinInitials}>{initials(providerName)}</Text>
            </View>
          )}
        </View>
        <View style={s.mapPinTail} />
      </View>
    </View>
  );
}

export function BookingFlowModal({ provider: initialProvider, onClose, onTrack, rescheduling }) {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const [provider, setProvider] = useState(initialProvider), [mode, setMode] = useState('published'), [windowEnd, setWindowEnd] = useState(null);
  const [alternatives, setAlternatives] = useState(null), [finding, setFinding] = useState(false), [alternativeError, setAlternativeError] = useState('');
  const alternativeRequest = useRef(null);
  const [pricing, setPricing] = useState(rescheduling?.pricing || provider.pricing), [accepted, setAccepted] = useState(false);
  const [step, setStep] = useState(rescheduling ? 1 : 2), [slots, setSlots] = useState([]), [loading, setLoading] = useState(true);
  const [error, setError] = useState(''), [availabilityError, setAvailabilityError] = useState(''), [selected, setSelected] = useState(''), [day, setDay] = useState(localDay(new Date()));
  const [week, setWeek] = useState(0), [busy, setBusy] = useState(false), [sent, setSent] = useState(null);
  const [problem, setProblem] = useState(rescheduling?.problem || ''), [location, setLocation] = useState(rescheduling?.location || [user?.location?.address, user?.location?.city].filter(Boolean).join(', ')), [notes, setNotes] = useState(rescheduling?.notes || '');
  const problemInput = useRef(null), locationInput = useRef(null);
  const [attempted, setAttempted] = useState(false);
  const request = useRef(null), lock = useRef(false), submission = useRef(null), scroll = useRef(null);

  const load = useCallback(() => {
    setLoading(true); setAvailabilityError('');
    request.current?.abort(); const controller = new AbortController(); request.current = controller;
    return bookingService.availability(provider.id, controller.signal, rescheduling?.id).then(result => {
      if (!controller.signal.aborted) { setError(''); if (!rescheduling) { setPricing(result.pricing); setAccepted(false); } setSlots(result.slots); }
    }).catch(e => { if (!controller.signal.aborted) setAvailabilityError(errorMessage(e)); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
  }, [provider.id, rescheduling]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load(); return () => request.current?.abort(); }, [load]);
  useEffect(() => () => alternativeRequest.current?.abort(), []);

  function go(next) { setError(''); setStep(next); scroll.current?.scrollTo({ y: 0, animated: false }); }
  const today = localDay(new Date());
  const days = Array.from({ length: 7 }, (_, index) => { const d = new Date(`${today}T00:00:00+05:30`); d.setUTCDate(d.getUTCDate() + week * 7 + index); return { date: localDay(d), stamp: d.toISOString() }; });
  const currentSlots = slots.filter(slot => slot.date === day);
  const available = slots.some(slot => slot.available);
  const preference = { startsAt: selected, scheduleMode: mode, windowEnd, status: 'pending' };
  const selectionLabel = selected ? bookingPreference(preference) : 'Choose a date and time';
  const selectedAvailable = mode !== 'published' || slots.some(slot => slot.startsAt === selected && slot.available);
  const canContinue = !!selected && selectedAvailable && new Date(selected) > new Date() && !busy && !loading && !availabilityError;
  const requestedTimes = BOOKING_TIMES.map(time => ({ startsAt: new Date(`${day}T${time}:00+05:30`).toISOString() })).filter(slot => new Date(slot.startsAt) > new Date() && new Date(slot.startsAt) < new Date(new Date().getTime() + 90 * 86400000));
  const nearby = slots.filter(slot => slot.available && slot.date !== day && Math.abs(new Date(slot.startsAt) - new Date(`${day}T08:00:00+05:30`)) < 7 * 86400000).sort((a, b) => Math.abs(new Date(a.startsAt) - new Date(`${day}T08:00:00+05:30`)) - Math.abs(new Date(b.startsAt) - new Date(`${day}T08:00:00+05:30`))).slice(0, 3);

  function choose(value, nextMode = mode, end = null) { alternativeRequest.current?.abort(); setAlternatives(null); setAlternativeError(''); setFinding(false); setSelected(value); setMode(nextMode); setWindowEnd(end); setError(''); }

  async function findProviders() {
    alternativeRequest.current?.abort(); const controller = new AbortController(); alternativeRequest.current = controller; setFinding(true); setAlternativeError('');
    try { const result = await bookingService.alternatives(provider.id, selected, controller.signal); if (!controller.signal.aborted) setAlternatives(result); }
    catch (e) { if (!controller.signal.aborted) setAlternativeError(errorMessage(e)); }
    finally { if (!controller.signal.aborted) setFinding(false); }
  }

  const back = () => { if (busy) return; if (step === 4 || step === (rescheduling ? 1 : 2)) onClose(); else go(step === 3 ? 1 : 2); };
  const displayStep = rescheduling ? (step === 1 ? 1 : step === 3 ? 2 : 1) : step === 2 ? 1 : step === 1 ? 2 : step;
  const totalSteps = rescheduling ? 2 : 3;

  function review() { setAttempted(true); if (!problem.trim() || !location.trim()) { setError('Complete the required fields below.'); scroll.current?.scrollTo({ y: 0, animated: true }); (!problem.trim() ? problemInput : locationInput).current?.focus(); return; } go(1); }

  async function submit() {
    if (lock.current || !canContinue) return;
    lock.current = true; setBusy(true); setError('');
    try {
      let result;
      if (rescheduling) result = await bookingService.update(rescheduling.id, { action: 'reschedule', bookingVersion: rescheduling.version, startsAt: selected, scheduleMode: mode, windowEnd, problem: problem.trim(), location: location.trim(), notes: notes.trim() });
      else {
        const payload = { pricingVersion: pricing?.version, acceptPricing: !!pricing && accepted, acceptQuoteRequest: !pricing && accepted, providerId: provider.id, startsAt: selected, scheduleMode: mode, windowEnd, problem: problem.trim(), location: location.trim(), notes: notes.trim() };
        const fingerprint = JSON.stringify(payload);
        if (submission.current?.fingerprint !== fingerprint) submission.current = { fingerprint, id: `${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}` };
        result = await bookingService.create({ ...payload, requestId: submission.current.id });
      }
      setSent(result); go(4);
    } catch (e) { if (e.response?.status === 409 && !rescheduling) { setSelected(''); setStep(1); await load(); } setError(rescheduling && e.response?.status === 409 ? 'This booking changed. Go back to My Bookings, review its latest details, then reschedule again.' : errorMessage(e)); }
    finally { lock.current = false; setBusy(false); }
  }

  const titles = ['', 'Choose date & time', 'Booking details', 'Review booking', 'Request sent'];
  return (
    <Modal visible animationType="slide" presentationStyle="fullScreen" onRequestClose={back}>
      <KeyboardAvoidingView style={[s.screen, { paddingTop: insets.top }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {step === 1 && <Image source={ASSETS.accent} style={s.accent} />}
        <View style={s.flowHeader}>
          <View style={s.headingRow}>
            {step !== 4 && <Pressable disabled={busy} onPress={back} accessibilityRole="button" accessibilityLabel="Back" style={s.back}><Text style={s.backText}>‹</Text></Pressable>}
            <Text accessibilityRole="header" style={s.title}>{titles[step]}</Text>
          </View>
          <Text style={s.subtitle}>{step === 1 ? 'Choose a date that suits you' : step === 2 ? provider.category : step === 3 ? 'Check your details before sending' : `Booking ID: ${sent?.reference || ''}`}</Text>
          {step < 4 && <><View style={s.progress}><View style={[s.progressActive, { width: `${displayStep / totalSteps * 100}%` }]} /></View><Text style={s.caption}>Step {displayStep} of {totalSteps}{rescheduling ? ' · Reschedule' : ''}</Text></>}
        </View>
        <ScrollView ref={scroll} keyboardShouldPersistTaps="handled" contentContainerStyle={[s.flowContent, { paddingBottom: Math.max(20, insets.bottom) }]}>
          {!!error && <View style={s.errorBox}><Text accessibilityRole="alert" accessibilityLiveRegion="assertive" style={s.dangerText}>{error}</Text>{step === 1 && <Button secondary title="Try again" onPress={load} />}</View>}
          {!!availabilityError && step < 4 && <View style={s.errorBox}><Text accessibilityRole="alert" style={s.dangerText}>Could not check availability and pricing. {availabilityError}</Text><Button secondary title="Retry availability" disabled={loading} onPress={load} /></View>}
          {step === 1 && <>
            <View style={[s.card, s.providerCard]}><View style={s.avatar}><Image source={ASSETS.avatar} style={{ width: 64, height: 64 }} /><Text style={s.avatarLetters}>{initials(provider.name)}</Text></View><View style={s.flex}><Text style={s.providerName}>{provider.name}</Text><Text style={s.subtitle}>{provider.category}</Text><Text style={s.availability}>{loading ? 'Checking appointments…' : availabilityError ? 'Availability not checked' : available ? 'Published appointments available' : 'Preferred-time requests welcome'}</Text></View></View>
            <View style={s.sectionHeading}><Text style={s.sectionTitle}>Select a date</Text><Text style={s.caption}>{bookingDate(days[0].stamp, { day: undefined, month: 'long', year: 'numeric' })}</Text></View>
            <View style={s.weekControls}><Pressable accessibilityRole="button" accessibilityLabel="Previous week" style={s.weekButton} disabled={week === 0} onPress={() => { setWeek(week - 1); setDay(localDay(new Date(new Date(today + 'T00:00:00+05:30').getTime() + (week - 1) * 7 * 86400000))); choose(''); }}><Text style={[s.link, week === 0 && s.muted]}>‹ Previous</Text></Pressable><Text style={s.caption}>Sri Lanka time</Text><Pressable accessibilityRole="button" accessibilityLabel="Next week" style={s.weekButton} disabled={week >= 12} onPress={() => { setWeek(week + 1); setDay(localDay(new Date(new Date(today + 'T00:00:00+05:30').getTime() + (week + 1) * 7 * 86400000))); choose(''); }}><Text style={[s.link, week >= 12 && s.muted]}>Next ›</Text></Pressable></View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.dates}>{days.map(d => { const active = d.date === day, hasSlots = slots.some(slot => slot.date === d.date && slot.available); return <Pressable key={d.date} accessibilityRole="button" accessibilityLabel={bookingDate(d.stamp, { weekday: 'long', month: 'long' })} aria-pressed={active} accessibilityState={{ selected: active }} onPress={() => { setDay(d.date); choose(''); }} style={[s.date, active && s.active]}><Text style={[s.dayName, active && s.white]}>{bookingDate(d.stamp, { day: undefined, month: undefined, weekday: 'short' }).toUpperCase()}</Text><Text style={[s.dayNumber, active && s.white]}>{bookingDate(d.stamp, { month: undefined })}</Text>{hasSlots && <Image source={active ? ASSETS.selectedDot : ASSETS.dot} style={{ width: 6, height: 6 }} />}</Pressable>; })}</ScrollView>
            <Text style={s.sectionTitle}>{mode === 'flexible' ? 'Preferred arrival window' : mode === 'preferred' ? 'Your preferred time' : 'Published appointments'}</Text>
            {mode === 'published' ? loading ? <ActivityIndicator color={COLORS.primary} style={s.loader} /> : availabilityError ? null : !currentSlots.some(slot => slot.available) ? <View style={s.card}><Text style={s.value}>No published appointments available on this date</Text><Button title="Request my preferred time" onPress={() => choose('', 'preferred')} /><Button secondary title="Choose a flexible window" onPress={() => choose('', 'flexible')} /></View> : <View style={s.timeGrid}>{currentSlots.map(slot => <Pressable key={slot.startsAt} disabled={!slot.available} accessibilityRole="button" accessibilityLabel={bookingTime(slot.startsAt)} aria-pressed={selected === slot.startsAt} accessibilityState={{ disabled: !slot.available, selected: selected === slot.startsAt }} onPress={() => choose(slot.startsAt)} style={[s.time, !slot.available && s.noSlots, selected === slot.startsAt && s.active]}><Text style={[s.value, !slot.available && s.muted, selected === slot.startsAt && s.white]}>{bookingTime(slot.startsAt)}</Text><Text style={[s.caption, selected === slot.startsAt && s.white]}>{slot.available ? (selected === slot.startsAt ? '✓ Selected' : 'Available') : 'Reserved'}</Text></Pressable>)}</View> : null}
            <View style={s.selection}><View style={s.flex}><Text style={s.caption}>Your appointment preference</Text><Text style={s.value}>{selectionLabel}</Text></View>{!!selected && <Pressable accessibilityRole="button" accessibilityLabel="Change appointment preference" style={s.edit} onPress={() => choose('')}><Text style={s.link}>Change</Text></Pressable>}</View>
          </>}
          {step === 2 && <>
            <View style={s.card}><Text style={s.value}>{provider.name}</Text><Text style={s.subtitle}>{selected ? selectionLabel : "Describe the job first, then choose a time."}</Text></View>
            <Text style={s.label}>Problem description *</Text><TextInput ref={problemInput} accessibilityLabel="Problem description, required" placeholder="Describe the work you need help with" editable={!rescheduling} value={problem} onChangeText={value => { setProblem(value); setError(''); }} maxLength={2000} multiline style={[s.input, s.problem]} />
            <Text style={s.label}>Service location *</Text><TextInput ref={locationInput} accessibilityLabel="Service location, required" placeholder="House number, street and city" editable={!rescheduling} value={location} onChangeText={value => { setLocation(value); setError(''); }} maxLength={500} style={s.input} />
            <Text style={s.label}>Access notes (optional)</Text><TextInput accessibilityLabel="Access notes" placeholder="Directions, parking or arrival instructions" value={notes} onChangeText={value => { setNotes(value); setError(''); }} maxLength={1000} multiline style={[s.input, s.notes]} />
            <View style={[s.card, s.spaced]}><Text style={s.caption}>Pricing</Text><Text style={s.price}>{bookingPrice({ pricing })}</Text></View><View style={s.grow} /><Button title="Choose date & time" onPress={review} />
          </>}
          {step === 3 && <>
            <View style={s.card}><Detail label="Provider" value={provider.name} /><Detail label="Service" value={provider.category} /><Detail label="Date & time" value={selectionLabel} edit={() => go(1)} /><Detail label="Location" value={location} edit={rescheduling ? undefined : () => go(2)} /><Detail label="Pricing" value={bookingPrice(rescheduling || { pricing })} /></View>
            <View style={[s.card, s.spaced]}><Detail label="Problem description" value={problem} edit={rescheduling ? undefined : () => go(2)} />{!!notes && <Detail label="Access notes" value={notes} edit={rescheduling ? undefined : () => go(2)} />}</View>
            <View style={s.grow} /><Button disabled={!canContinue || (!rescheduling && !accepted)} title={busy ? 'Sending…' : rescheduling ? 'Send reschedule request' : 'Send booking request'} onPress={submit} />
          </>}
          {step === 4 && sent && <>
            <View style={s.successHero}><View><Image source={ASSETS.success} style={{ width: 88, height: 88 }} /><Text style={s.successCheck}>✓</Text></View><Text style={s.successTitle}>Request sent successfully</Text></View>
            <View style={s.grow} /><Button title="Track in My Bookings" onPress={onTrack} /><Button secondary title="Find another provider" onPress={onClose} />
          </>}
        </ScrollView>
        {step === 1 && <View style={[s.flowFooter, { paddingBottom: Math.max(12, insets.bottom) }]}><Button title="Review booking" arrow disabled={!canContinue} onPress={() => go(3)} /></View>}
      </KeyboardAvoidingView>
    </Modal>
  );
}

export default function BookingsScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const [bookings, setBookings] = useState([]);
  const [tab, setTab] = useState('Upcoming');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandedBookingId, setExpandedBookingId] = useState(null);

  const [detail, setDetail] = useState(null);
  const [cancel, setCancel] = useState(false);
  const [busy, setBusy] = useState(false);
  const [reschedule, setReschedule] = useState(null);

  const cancelLock = useRef(false);
  const mutationLock = useRef(false);
  const cancelVersion = useRef(null);
  const request = useRef(null);

  const load = useCallback(async () => {
    if (mutationLock.current) return;
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setError('');
    try {
      const data = await bookingService.list(controller.signal);
      if (!controller.signal.aborted) {
        setBookings(data);
        setDetail(current => current ? data.find(b => b.id === current.id) || current : null);
      }
    } catch (e) {
      if (!controller.signal.aborted) setError(errorMessage(e));
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
      const timer = setInterval(load, 30000);
      return () => {
        clearInterval(timer);
        request.current?.abort();
      };
    }, [load])
  );

  const filtered = bookings.filter(b => {
    if (tab === 'Upcoming') {
      return ['pending', 'time_proposed', 'awaiting_quote', 'confirmed', 'inspection_confirmed', 'quote_pending', 'ongoing', 'inspecting'].includes(b.status);
    } else if (tab === 'Completed') {
      return b.status === 'completed';
    } else {
      return ['cancelled', 'rejected'].includes(b.status);
    }
  }).sort((a, b) => (tab === 'Upcoming' ? new Date(a.startsAt) - new Date(b.startsAt) : new Date(b.startsAt) - new Date(a.startsAt)));

  const toggleExpand = (id) => {
    if (Platform.OS !== 'web') {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    }
    setExpandedBookingId(prev => (prev === id ? null : id));
  };

  async function cancelBooking() {
    if (cancelLock.current || mutationLock.current) return;
    cancelLock.current = true;
    mutationLock.current = true;
    request.current?.abort();
    setBusy(true);
    try {
      const updated = await bookingService.update(detail.id, { action: 'cancel', bookingVersion: cancelVersion.current });
      request.current?.abort();
      setBookings(rows => rows.map(b => b.id === updated.id ? updated : b));
      setDetail(updated);
      setCancel(false);
      setError('');
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      cancelLock.current = false;
      mutationLock.current = false;
      setBusy(false);
    }
  }

  return (
    <View style={[s.screen, { paddingTop: insets.top }]}>
      {/* Top Header matching reference */}
      <View style={s.topHeaderRow}>
        <View style={s.topHeaderTitleGroup}>
          <View style={s.appLogoBox}>
            <Text style={s.appLogoText}>h</Text>
          </View>
          <Text accessibilityRole="header" style={s.headerMainTitle}>My Bookings</Text>
        </View>
        <View style={s.topHeaderActions}>
          <Pressable accessibilityRole="button" accessibilityLabel="Search" style={s.headerIconBtn}>
            <Ionicons name="search-outline" size={22} color="#1D1B20" />
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="More options" style={s.headerIconBtn}>
            <Ionicons name="ellipsis-horizontal-circle-outline" size={24} color="#1D1B20" />
          </Pressable>
        </View>
      </View>

      {/* Modern Tabs */}
      <View style={s.tabsContainer}>
        {['Upcoming', 'Completed', 'Cancelled'].map(t => {
          const isActive = tab === t;
          return (
            <Pressable
              key={t}
              accessibilityRole="tab"
              aria-selected={isActive}
              accessibilityState={{ selected: isActive }}
              onPress={() => {
                setTab(t);
                setExpandedBookingId(null);
              }}
              style={s.tabItem}
            >
              <Text style={[s.tabItemText, isActive && s.tabItemTextActive]}>{t}</Text>
              {isActive && <View style={s.tabActiveIndicator} />}
            </Pressable>
          );
        })}
      </View>

      <ScrollView
        contentContainerStyle={s.listContent}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={() => { setLoading(true); void load(); }} />}
      >
        {!!error && (
          <View style={s.errorBox}>
            <Text accessibilityRole="alert" style={s.dangerText}>{error}</Text>
            <Button title="Try again" secondary onPress={load} />
          </View>
        )}

        {loading && <ActivityIndicator color={COLORS.primary} style={{ marginVertical: 30 }} />}

        {!loading && !error && !filtered.length && (
          <View style={s.emptyCard}>
            <Ionicons name="calendar-outline" size={48} color="#A09CAB" style={{ marginBottom: 10 }} />
            <Text style={s.emptyTitle}>No {tab.toLowerCase()} bookings</Text>
            <Text style={s.emptySubtitle}>Your service requests will appear here.</Text>
            <Button title="Explore providers" secondary onPress={() => navigation.navigate('Explore')} />
          </View>
        )}

        {filtered.map(b => {
          const isExpanded = expandedBookingId === b.id;
          const photo = getProviderPhoto(b);
          const formattedDate = bookingDate(b.startsAt, { weekday: undefined, year: 'numeric', month: 'short', day: 'numeric' });
          const formattedTime = bookingTime(b.startsAt);
          const dateTimeDisplay = `${formattedDate} | ${formattedTime}`;

          return (
            <View key={b.id} style={s.refCard}>
              {/* Compact Card Header - Always Visible */}
              <View style={s.cardCompactHeader}>
                {/* Provider Image */}
                <View style={s.providerPhotoWrapper}>
                  {photo ? (
                    <Image source={photo} style={s.providerPhoto} contentFit="cover" />
                  ) : (
                    <View style={s.providerPhotoFallback}>
                      <Text style={s.providerPhotoInitials}>{initials(b.providerName)}</Text>
                    </View>
                  )}
                </View>

                {/* Service & Provider Details */}
                <View style={s.cardMainDetails}>
                  <Text style={s.cardServiceName} numberOfLines={1}>{b.service}</Text>
                  <Text style={s.cardProviderName} numberOfLines={1}>{b.providerName}</Text>

                  {/* Status Badge */}
                  <View style={s.badgeRow}>
                    <StatusBadge status={b.status} />
                  </View>
                </View>

                {/* Interactive Message / Chat Icon */}
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Message ${b.providerName}`}
                  onPress={() => navigation.navigate('Messages', { bookingId: b.id, openRequest: Date.now() })}
                  style={s.chatIconButton}
                >
                  <Ionicons name="chatbubble" size={20} color="#7F56D9" />
                </Pressable>
              </View>

              {/* Expanded Content Section */}
              {isExpanded && (
                <View style={s.expandedContent}>
                  <View style={s.cardDivider} />

                  {/* Date & Time */}
                  <View style={s.infoRow}>
                    <Text style={s.infoLabel}>Date & Time</Text>
                    <Text style={s.infoValue}>{dateTimeDisplay}</Text>
                  </View>

                  {/* Location */}
                  <View style={[s.infoRow, { marginTop: 8 }]}>
                    <Text style={s.infoLabel}>Location</Text>
                    <Text style={s.infoValue} numberOfLines={2}>{b.location || 'Location provided upon confirmation'}</Text>
                  </View>

                  {/* Map Visual Preview */}
                  <MapVisualPreview providerPhoto={photo} providerName={b.providerName} />

                  {/* Action Buttons */}
                  <View style={s.expandedActionsRow}>
                    {['pending', 'time_proposed', 'awaiting_quote', 'confirmed', 'inspection_confirmed'].includes(b.status) && !b.inspectionPerformed ? (
                      <>
                        <Pressable
                          accessibilityRole="button"
                          onPress={() => { cancelVersion.current = b.version; setDetail(b); setCancel(true); }}
                          style={s.actionBtnOutline}
                        >
                          <Text style={s.actionBtnOutlineText}>Cancel Booking</Text>
                        </Pressable>
                        <Pressable
                          accessibilityRole="button"
                          onPress={() => { setDetail(b); setCancel(false); }}
                          style={s.actionBtnFilled}
                        >
                          <Text style={s.actionBtnFilledText}>{nextAction(b)[2]}</Text>
                        </Pressable>
                      </>
                    ) : (
                      <>
                        <Pressable
                          accessibilityRole="button"
                          onPress={() => { setDetail(b); setCancel(false); }}
                          style={[s.actionBtnFilled, { flex: 1 }]}
                        >
                          <Text style={s.actionBtnFilledText}>{nextAction(b)[2]}</Text>
                        </Pressable>
                      </>
                    )}
                  </View>
                </View>
              )}

              {/* Chevron Expand / Collapse Arrow */}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={isExpanded ? "Collapse details" : "Expand details"}
                onPress={() => toggleExpand(b.id)}
                style={s.chevronRow}
              >
                <Ionicons
                  name={isExpanded ? "chevron-up" : "chevron-down"}
                  size={20}
                  color="#6E6E76"
                />
              </Pressable>
            </View>
          );
        })}
      </ScrollView>

      {/* Booking Detail Modal */}
      {!!detail && (
        <Modal visible animationType="slide" onRequestClose={() => { if (!busy) setDetail(null); }}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={[s.screen, { paddingTop: insets.top }]}>
            <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={[s.flowContent, { paddingBottom: Math.max(24, insets.bottom) }]}>
              <Text style={s.title}>{cancel ? 'Cancel booking?' : 'Booking details'}</Text>
              {!!error && <Text accessibilityRole="alert" style={s.dangerText}>{error}</Text>}
              <View style={s.card}>
                <View style={{ marginBottom: 12 }}>
                  <StatusBadge status={detail.status} />
                </View>
                <Detail label="Booking ID" value={detail.reference} />
                <Detail label="Provider" value={detail.providerName} />
                <Detail label="Service" value={detail.service} />
                <Detail label="Appointment" value={bookingPreference(detail)} />
                <Detail label="Location" value={detail.location} />
                <Detail label="Problem" value={detail.problem} />
                {!!detail.notes && <Detail label="Access notes" value={detail.notes} />}
                <Detail label="Pricing" value={bookingPrice(detail)} />
              </View>
              {!cancel && <NextAction booking={detail} />}
              {!cancel && (
                <Button
                  secondary
                  title="Message provider"
                  disabled={busy}
                  onPress={() => {
                    const bookingId = detail.id;
                    setDetail(null);
                    navigation.navigate('Messages', { bookingId, openRequest: Date.now() });
                  }}
                />
              )}
              {!cancel && (
                <BookingCharges
                  booking={detail}
                  onBusyChange={value => {
                    mutationLock.current = value;
                    if (value) request.current?.abort();
                    setBusy(value);
                  }}
                  onUpdate={updated => {
                    request.current?.abort();
                    setDetail(updated);
                    setBookings(rows => rows.map(b => b.id === updated.id ? updated : b));
                  }}
                />
              )}
              {cancel && (
                <>
                  <Text style={s.subtitle}>This releases the appointment for other customers.</Text>
                  <Button danger title={busy ? 'Cancelling…' : 'Confirm cancellation'} disabled={busy} onPress={cancelBooking} />
                </>
              )}
              <Button secondary title={cancel ? 'Keep booking' : 'Back to My Bookings'} disabled={busy} onPress={() => { setDetail(null); setCancel(false); }} />
            </ScrollView>
          </KeyboardAvoidingView>
        </Modal>
      )}

      {/* Reschedule Modal */}
      {!!reschedule && (
        <BookingFlowModal
          key={reschedule.id}
          provider={{ id: reschedule.providerId, name: reschedule.providerName, category: reschedule.service, price: reschedule.price, priceUnit: reschedule.priceUnit, pricing: reschedule.pricing }}
          rescheduling={reschedule}
          onClose={() => { setReschedule(null); void load(); }}
          onTrack={() => { setReschedule(null); setTab('Upcoming'); void load(); }}
        />
      )}
    </View>
  );
}

// Quote approval and payment remain in the existing booking details view.
export function BookingCharges({ booking: b, onUpdate, provider = false, onBusyChange }) {
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [reference, setReference] = useState(''), [declining, setDeclining] = useState(false);
  const previous = b.previousApprovedQuote;
  const consequence = previous ? 'Keep the previously agreed scope and total of ' + money(previous.totalMinor) + '. Only the proposed changes are declined.' : b.inspectionPerformed ? 'Decline repairs. The completed inspection fee of ' + money(b.pricing?.inspectionFeeMinor) + ' remains payable.' : 'Declining this quote cancels this request. No work or charge will be agreed.';
  const lock = useRef(false);

  async function run(action, payment = false, method) {
    if (lock.current) return; lock.current = true; setBusy(true); onBusyChange?.(true); setError('');
    try { onUpdate(await (payment ? paymentService.update(b.id, { action, method, reference, reportedAt: b.payment?.reportedAt }) : bookingService.update(b.id, { action, bookingVersion: b.version, quoteVersion: b.quote?.version, proposalVersion: b.proposalVersion }))); return true; }
    catch (e) { setError(errorMessage(e)); return false; } finally { lock.current = false; setBusy(false); onBusyChange?.(false); }
  }

  async function refreshBooking() {
    if (lock.current) return; lock.current = true; setBusy(true); onBusyChange?.(true);
    try { const rows = await bookingService.list(); const current = rows.find(row => row.id === b.id); if (!current) throw new Error(); onUpdate(current); setError(''); }
    catch (e) { setError(errorMessage(e)); } finally { lock.current = false; setBusy(false); onBusyChange?.(false); }
  }

  return (
    <View style={[s.card, s.spaced]}>
      {b.status === 'time_proposed' && <><Text style={s.sectionTitle}>Provider suggested another time</Text><Text style={s.value}>{bookingWhen(b.proposedStartsAt)}</Text><Text style={s.subtitle}>{provider ? 'The customer requested' : 'Your requested time is'} {bookingPreference(b)}. This suggestion is not reserved until {provider ? 'the customer accepts' : 'you accept'}. Your agreed pricing stays the same.</Text>{!provider && <><Button title="Accept suggested time" disabled={busy} onPress={() => run('accept_time')} /><Button secondary title="Keep my requested time" disabled={busy} onPress={() => run('decline_time')} /></>}</>}
      <Text style={s.sectionTitle}>Pricing & payment</Text>{b.status === 'awaiting_quote' && <Text style={s.subtitle}>Appointment accepted. Work can start only after the customer approves the provider’s quote.</Text>}<Text style={s.value}>{bookingPrice(b)}</Text>
      {!!b.pricing?.inclusions && <Text style={s.subtitle}>Included: {b.pricing.inclusions}</Text>}{!!b.pricing?.exclusions && <Text style={s.subtitle}>Excluded: {b.pricing.exclusions}</Text>}
      {b.quote && <><Text style={[s.value, s.spaced]}>Quote {b.quote.version} · {b.quote.status}</Text><Text style={s.subtitle}>{b.quote.scope}</Text>{b.quote.items.map((item, i) => <Detail key={i} label={item.description} value={money(item.amountMinor)} />)}<Detail label="Quote total (all charges)" value={money(b.quote.totalMinor)} /></>}
      {b.status === 'quote_pending' && previous && <View style={s.bookingInfo}><Text style={s.value}>Changes to your agreed quote</Text><Detail label="Previously agreed total" value={money(previous.totalMinor)} /><Detail label="Proposed replacement total" value={money(b.quote.totalMinor)} /><Detail label="Difference" value={(b.quote.totalMinor >= previous.totalMinor ? '+' : '−') + money(Math.abs(b.quote.totalMinor - previous.totalMinor))} /><Text style={s.subtitle}>This replaces the total; it is not an additional charge.</Text><Text style={s.value}>Previously agreed scope</Text><Text style={s.subtitle}>{previous.scope}</Text>{previous.items.map((item, i) => <Detail key={i} label={item.description} value={money(item.amountMinor)} />)}<Text style={s.caption}>Compare these with the proposed scope and items above.</Text></View>}
      {!provider && b.status === 'quote_pending' && <><Text style={s.subtitle}>Work is paused until you decide. Declining a revision keeps any previously agreed work and total.</Text><Button title="Approve quote & work" disabled={busy} onPress={() => run('approve_quote')} /><Button secondary title="Decline quote" disabled={busy} onPress={() => setDeclining(b.quote.version)} /></>}
      {!provider && declining && b.status === 'quote_pending' && <View style={s.errorBox}><Text style={s.value}>Decline this quote?</Text><Text style={s.subtitle}>{consequence}</Text><Button danger title="Confirm decline" disabled={busy || declining !== b.quote.version} onPress={async () => { if (await run('decline_quote')) setDeclining(false); }} /><Button secondary title="Keep reviewing" disabled={busy} onPress={() => setDeclining(false)} /></View>}
      {b.invoice && <><Text style={[s.value, s.spaced]}>Invoice {b.invoice.number}</Text>{b.invoice.items.map((item, i) => <Detail key={i} label={item.description} value={money(item.amountMinor)} />)}<Detail label="Invoice total" value={money(b.invoice.totalMinor)} /><Detail label="Balance due" value={money(b.payment?.status === 'paid' ? 0 : b.invoice.totalMinor)} /><Text style={s.value}>Payment: {(b.payment?.status || 'unpaid').replaceAll('_', ' ')}</Text>
        {!provider && b.payment?.status === 'unpaid' && <><Button title="I paid the full amount in cash" disabled={busy} onPress={() => run('report', true, 'cash')} />{!!b.invoice.bankDetails && <Text style={s.value}>Bank transfer details: {b.invoice.bankDetails}</Text>}{!b.invoice.bankDetails && <Text style={s.subtitle}>Bank transfer is not available for this invoice. Please use cash.</Text>}<Text style={s.label}>Transfer reference (required for bank transfer)</Text><TextInput editable={!busy && !!b.invoice.bankDetails} accessibilityLabel="Bank transfer reference" placeholder="Bank transfer reference" value={reference} onChangeText={setReference} maxLength={200} style={s.input} /><Button secondary title="I transferred the full amount" disabled={busy || !reference.trim() || !b.invoice.bankDetails} onPress={() => run('report', true, 'bank_transfer')} /></>}
        {b.payment?.status === 'awaiting_confirmation' && <><Text style={s.subtitle}>Payment reported: {money(b.invoice.totalMinor)} · {b.payment.method?.replaceAll('_', ' ')}</Text>{provider && <><Button title="Confirm full payment received" disabled={busy} onPress={() => run('confirm', true)} /><Button secondary title="Payment not received" disabled={busy} onPress={() => run('reject', true)} /></>}</>}
        {b.payment?.status === 'paid' && <><Text style={s.value}>Receipt {b.payment.receipt}</Text><Text style={s.subtitle}>{money(b.invoice.totalMinor)} received · {b.payment.method?.replaceAll('_', ' ')}</Text></>}
      </>}{!provider && <IssueReporter booking={b} disabled={busy} onBusyChange={value => { lock.current = value; setBusy(value); onBusyChange?.(value); }} />}{!!error && <><Text accessibilityRole="alert" accessibilityLiveRegion="assertive" style={s.dangerText}>{error}</Text><Button secondary title="Refresh booking details" disabled={busy} onPress={refreshBooking} /></>}
    </View>
  );
}

function IssueReporter({ booking, onBusyChange, disabled }) {
  const [refresh, setRefresh] = useState(0), [open, setOpen] = useState(false), [description, setDescription] = useState(''), [cases, setCases] = useState([]), [loading, setLoading] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const lock = useRef(false), input = useRef(null);

  useEffect(() => { if (!open) return; const c = new AbortController(); complaintService.list(booking.id, c.signal).then(rows => { if (!c.signal.aborted) setCases(rows); }).catch(e => { if (!c.signal.aborted) setError(errorMessage(e)); }).finally(() => { if (!c.signal.aborted) setLoading(false); }); return () => c.abort(); }, [open, booking.id, refresh]);

  async function send() { if (lock.current || disabled) return; if (!description.trim()) { setError('Describe the issue so support can investigate.'); input.current?.focus(); return; } lock.current = true; setBusy(true); onBusyChange?.(true); setError(''); try { const result = await complaintService.create(booking.id, description.trim()); setCases([result]); } catch (e) { setError(errorMessage(e)); } finally { lock.current = false; setBusy(false); onBusyChange?.(false); } }

  return <View style={s.spaced}><Button secondary title={open ? 'Close issue details' : 'Report an issue / view support case'} disabled={busy || disabled} onPress={() => { setError(''); setLoading(!open); setOpen(!open); }} />{open && <View style={s.bookingInfo}><Text style={s.value}>Booking support</Text><Text style={s.caption}>{booking.reference}</Text>{loading ? <ActivityIndicator color={COLORS.primary} /> : cases.length ? cases.map(c => <View key={c.id}><Text accessibilityLiveRegion="polite" style={s.value}>Case {c.id} · {c.status}</Text><Text style={s.subtitle}>{c.description}</Text><Text style={s.subtitle}>{c.response || 'Your case is in the admin support queue. No response has been recorded yet.'}</Text></View>) : <><Text style={s.subtitle}>Describe the booking or payment problem.</Text><Text style={s.label}>Issue description *</Text><TextInput ref={input} accessibilityLabel="Issue description, required" multiline maxLength={2000} value={description} onChangeText={value => { setDescription(value); setError(''); }} style={[s.input, s.problem]} /><Button title={busy ? 'Submitting…' : 'Submit issue'} disabled={busy || disabled || !!error} onPress={send} /></>}{!!error && <><Text accessibilityRole="alert" style={s.dangerText}>{error}</Text><Button secondary title="Retry issue support" onPress={() => { setError(''); setLoading(true); setRefresh(v => v + 1); }} /></>}</View>}</View>;
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#FAFAFD' },
  accent: { position: 'absolute', width: 160, height: 160, right: -66, top: -65 },
  flowFooter: { paddingHorizontal: 20, paddingTop: 6, gap: 5, backgroundColor: '#FAFAFD', width: '100%', maxWidth: 600, alignSelf: 'center', borderTopWidth: 1, borderColor: '#ECECF1' },
  flowHeader: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 16, width: '100%', maxWidth: 600, alignSelf: 'center' },
  headingRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  back: { width: 44, minHeight: 44, justifyContent: 'center' }, backText: { fontSize: 30, color: '#272727' },
  title: { fontSize: 22, fontWeight: '700', color: '#272727', flexShrink: 1 },
  subtitle: { fontSize: 13, lineHeight: Platform.OS === 'web' ? '1.538em' : 20, color: '#6E6E76', marginTop: 5 },
  progress: { height: 5, borderRadius: 4, backgroundColor: '#ECECF1', marginTop: 14, marginBottom: 8, overflow: 'hidden' },
  progressActive: { height: 5, backgroundColor: COLORS.primary },
  flowContent: { flexGrow: 1, paddingHorizontal: 20, gap: 10, paddingTop: 4, width: '100%', maxWidth: 600, alignSelf: 'center' },

  // Top Header matching reference
  topHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 8,
  },
  topHeaderTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  appLogoBox: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#7F56D9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  appLogoText: {
    color: '#FFF',
    fontSize: 22,
    fontWeight: '800',
    fontStyle: 'italic',
  },
  headerMainTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#1D1B20',
  },
  topHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerIconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Modern Tabs matching reference
  tabsContainer: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#ECECF1',
    paddingHorizontal: 16,
    marginTop: 6,
  },
  tabItem: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  tabItemText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#98A2B3',
  },
  tabItemTextActive: {
    color: '#7F56D9',
    fontWeight: '700',
  },
  tabActiveIndicator: {
    position: 'absolute',
    bottom: -1,
    left: 10,
    right: 10,
    height: 3,
    backgroundColor: '#7F56D9',
    borderTopLeftRadius: 3,
    borderTopRightRadius: 3,
  },

  // List & Cards styling matching reference
  listContent: {
    padding: 20,
    gap: 16,
    width: '100%',
    maxWidth: 600,
    alignSelf: 'center',
  },
  refCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 28,
    padding: 16,
    boxShadow: '0px 6px 20px rgba(127, 86, 217, 0.08)',
    elevation: 3,
    borderWidth: 1,
    borderColor: '#F2F0F9',
    overflow: 'hidden',
  },
  cardCompactHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  providerPhotoWrapper: {
    width: 76,
    height: 76,
    borderRadius: 22,
    overflow: 'hidden',
    backgroundColor: '#F7F4FD',
  },
  providerPhoto: {
    width: '100%',
    height: '100%',
  },
  providerPhotoFallback: {
    width: '100%',
    height: '100%',
    backgroundColor: '#F2EEFE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  providerPhotoInitials: {
    fontSize: 22,
    fontWeight: '800',
    color: '#7F56D9',
  },
  cardMainDetails: {
    flex: 1,
    marginLeft: 14,
    marginRight: 8,
    justifyContent: 'center',
  },
  cardServiceName: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1D1B20',
  },
  cardProviderName: {
    fontSize: 13,
    color: '#6E6E76',
    marginTop: 2,
    marginBottom: 6,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 10,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  chatIconButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#F4F0FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  chevronRow: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 10,
    marginTop: 4,
  },

  // Expanded Content Details
  expandedContent: {
    marginTop: 12,
  },
  cardDivider: {
    height: 1,
    backgroundColor: '#F0EFF5',
    marginBottom: 14,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  infoLabel: {
    width: 85,
    fontSize: 13,
    color: '#6E6E76',
    fontWeight: '500',
  },
  infoValue: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    color: '#1D1B20',
  },

  // Map Graphic Container
  mapContainer: {
    height: 150,
    backgroundColor: '#F4EFFC',
    borderRadius: 22,
    marginVertical: 14,
    overflow: 'hidden',
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapGridLineHorizontal1: {
    position: 'absolute',
    top: '30%',
    left: -20,
    right: -20,
    height: 18,
    backgroundColor: 'rgba(255,255,255,0.6)',
    transform: [{ rotate: '-8deg' }],
  },
  mapGridLineHorizontal2: {
    position: 'absolute',
    top: '65%',
    left: -20,
    right: -20,
    height: 14,
    backgroundColor: 'rgba(255,255,255,0.5)',
    transform: [{ rotate: '4deg' }],
  },
  mapGridLineVertical1: {
    position: 'absolute',
    left: '35%',
    top: -20,
    bottom: -20,
    width: 16,
    backgroundColor: 'rgba(255,255,255,0.6)',
    transform: [{ rotate: '12deg' }],
  },
  mapGridLineVertical2: {
    position: 'absolute',
    left: '70%',
    top: -20,
    bottom: -20,
    width: 14,
    backgroundColor: 'rgba(255,255,255,0.5)',
    transform: [{ rotate: '-10deg' }],
  },
  mapCircleOverlay1: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 110,
    borderWidth: 1.5,
    borderColor: 'rgba(127, 86, 217, 0.12)',
  },
  mapCircleOverlay2: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 1.5,
    borderColor: 'rgba(127, 86, 217, 0.2)',
  },
  mapPinWrapper: {
    alignItems: 'center',
  },
  mapPinCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 3,
    borderColor: '#7F56D9',
    backgroundColor: '#FFF',
    overflow: 'hidden',
    boxShadow: '0px 4px 12px rgba(127,86,217,0.3)',
    elevation: 4,
  },
  mapPinImage: {
    width: '100%',
    height: '100%',
  },
  mapPinInitialsBox: {
    flex: 1,
    backgroundColor: '#F2EEFE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapPinInitials: {
    fontSize: 16,
    fontWeight: '800',
    color: '#7F56D9',
  },
  mapPinTail: {
    width: 0,
    height: 0,
    borderLeftWidth: 8,
    borderRightWidth: 8,
    borderTopWidth: 12,
    borderStyle: 'solid',
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: '#7F56D9',
    marginTop: -2,
  },

  // Expanded Actions
  expandedActionsRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 4,
  },
  actionBtnOutline: {
    flex: 1,
    height: 46,
    borderRadius: 23,
    borderWidth: 1.5,
    borderColor: '#7F56D9',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  actionBtnOutlineText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#7F56D9',
  },
  actionBtnFilled: {
    flex: 1,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#7F56D9',
  },
  actionBtnFilledText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  // Empty state
  emptyCard: {
    backgroundColor: '#FFF',
    borderRadius: 24,
    padding: 30,
    alignItems: 'center',
    boxShadow: '0px 4px 12px rgba(0,0,0,0.04)',
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1D1B20',
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#6E6E76',
    marginTop: 4,
    marginBottom: 16,
    textAlign: 'center',
  },

  // Standard modal & detail styles preserved
  card: { backgroundColor: '#FFF', padding: 16, borderRadius: 16, boxShadow: '0px 5px 12px rgba(38,38,38,0.06)' },
  providerCard: { flexDirection: 'row', alignItems: 'center', gap: 16, minHeight: 108, borderWidth: 1, borderColor: '#E3E0F2' },
  avatar: { width: 64, height: 64, alignItems: 'center', justifyContent: 'center' }, avatarLetters: { position: 'absolute', color: COLORS.primary, fontSize: 18, fontWeight: '700' },
  providerName: { fontSize: 17, color: '#272727', fontWeight: '700' },
  flex: { flex: 1, minWidth: 0 }, row: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 }, between: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 },
  availability: { color: '#08734C', backgroundColor: '#E8F7F0', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 20, fontSize: 10 },
  sectionHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12, gap: 8 }, sectionTitle: { flexShrink: 1, fontSize: 18, fontWeight: '700', color: '#272727' },
  caption: { fontSize: 11, color: '#6E6E76', lineHeight: Platform.OS === 'web' ? '1.545em' : 17 }, link: { color: COLORS.primary, fontSize: 12, lineHeight: Platform.OS === 'web' ? '1.5em' : 18 },
  weekButton: { minWidth: 44, minHeight: 44, justifyContent: 'center' },
  weekControls: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 },
  dates: { flexDirection: 'row', flexGrow: 1, gap: 5 }, date: { flex: 1, minWidth: 44, minHeight: 68, borderRadius: 14, borderWidth: 1, borderColor: '#E3E0F2', backgroundColor: '#FFF', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 6 },
  dayName: { fontSize: 10, color: '#6E6E76' }, dayNumber: { fontSize: 17, color: '#272727', fontWeight: '700' },
  active: { backgroundColor: COLORS.primary, borderColor: COLORS.primary }, noSlots: { backgroundColor: '#E8E8F0' }, white: { color: '#FFF' }, muted: { color: '#94949E' },
  timeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 }, time: { flexBasis: '45%', flexGrow: 1, minWidth: 120, minHeight: 46, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 14, borderWidth: 1, borderColor: '#E3E0F2', backgroundColor: '#FFF', flexDirection: 'column', alignItems: 'flex-start', justifyContent: 'center' },
  check: { position: 'absolute', width: 22, textAlign: 'center', color: '#FFF', fontSize: 14, fontWeight: '700' },
  value: { fontSize: 14, color: '#272727', lineHeight: Platform.OS === 'web' ? '1.5em' : 21, fontWeight: '600' }, legend: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8 },
  selection: { backgroundColor: '#F2EEFE', borderRadius: 16, borderWidth: 1, borderColor: '#D6CCFA', padding: 16, flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  button: { backgroundColor: COLORS.primary, minHeight: 52, paddingHorizontal: 12, paddingVertical: 14, borderRadius: 13, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, marginTop: 6 },
  buttonText: { flexShrink: 1, color: '#FFF', fontSize: 14, fontWeight: '600', textAlign: 'center' }, secondary: { backgroundColor: '#FFF', borderWidth: 1, borderColor: '#ECECF1' }, disabled: { opacity: 0.45 }, danger: { backgroundColor: '#FDECED' }, dangerText: { color: '#B52636' },
  label: { fontSize: 13, fontWeight: '600', color: '#272727', marginTop: 14 }, input: { minHeight: 56, padding: 16, backgroundColor: '#FFF', borderWidth: 1, borderColor: '#ECECF1', borderRadius: 12, fontSize: 13, color: '#303030' }, problem: { minHeight: 104, textAlignVertical: 'top' }, notes: { minHeight: 72, textAlignVertical: 'top' },
  spaced: { marginTop: 10 }, price: { fontSize: 16, fontWeight: '700', color: '#272727', marginTop: 8 }, grow: { flexGrow: 1, minHeight: 10 }, detail: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#ECECF1', flexDirection: 'row', gap: 10, alignItems: 'center' }, edit: { padding: 10, minHeight: 44, justifyContent: 'center' },
  successHero: { alignItems: 'center', paddingTop: 28, paddingBottom: 28, gap: 20 }, successCheck: { position: 'absolute', width: 88, lineHeight: 88, textAlign: 'center', color: COLORS.primary, fontSize: 40 }, successTitle: { fontSize: 22, fontWeight: '700', color: '#272727', textAlign: 'center', marginTop: 6 }, center: { textAlign: 'center' },
});
