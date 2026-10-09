import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { bookingService, bookingDate, bookingTime } from '../services/bookingService';
import { authService } from '../services/authService';
import { useAuth } from './AuthContext';
import { providerMetrics } from '../constants/providerData';

const ProviderContext = createContext(null);
export const ProviderDataProvider = ({ children }) => {
  const { user, updateUserSession } = useAuth();
  const [online, setOnlineValue] = useState(user?.providerDetails?.acceptingRequests !== false);
  const [bookings, setBookings] = useState([]), [loading, setLoading] = useState(true), [error, setError] = useState(''), [busy, setBusy] = useState(false);
  const [account, setAccount] = useState(user), [loaded, setLoaded] = useState(false), [asOf, setAsOf] = useState(() => new Date());
  const [notifications, setNotifications] = useState([]), [notificationError, setNotificationError] = useState(''), [notificationsLoading, setNotificationsLoading] = useState(false);
  const profileRevision = useRef(0);
  const notificationRequest = useRef(null), notificationLock = useRef(false);
  const loadNotifications = useCallback(async () => {
    if (notificationLock.current) return;
    notificationRequest.current?.abort(); const c = new AbortController(); notificationRequest.current = c;
    setNotificationsLoading(true); setNotificationError('');
    try { const rows = await bookingService.notifications(c.signal); if (!c.signal.aborted) setNotifications(rows); }
    catch (e) { if (!c.signal.aborted) setNotificationError(e.response?.data?.message || 'Unable to load notifications. Check your connection and retry.'); }
    finally { if (!c.signal.aborted) setNotificationsLoading(false); }
  }, []);
  const markRead = async notification => {
    if (notificationLock.current) return false; notificationLock.current = true;
    notificationRequest.current?.abort(); setNotificationsLoading(false);
    try { await bookingService.readNotification(notification.bookingId, notification.id); setNotifications(rows => rows.map(n => n.id === notification.id ? { ...n, readAt: n.readAt || new Date().toISOString() } : n)); return true; }
    catch (e) { setNotificationError(e.response?.data?.message || 'Could not mark this notification read. Retry.'); return false; }
    finally { notificationLock.current = false; }
  };
  const request = useRef(null), lock = useRef(false);
  const load = useCallback(async (quiet = false) => {
    if (lock.current) return;
    request.current?.abort(); const c = new AbortController(); request.current = c;
    if (!quiet) { setLoading(true); setError(''); }
    try { const rows = await bookingService.list(c.signal); if (!c.signal.aborted) {
      setBookings(rows); setLoaded(true); setAsOf(new Date()); setError('');
      const reviews = rows.filter(b => Number.isInteger(b.review?.rating) && b.review.rating >= 1 && b.review.rating <= 5);
      if (reviews.length) setAccount(current => current ? { ...current, providerDetails: { ...current.providerDetails, rating: reviews.reduce((sum, b) => sum + b.review.rating, 0) / reviews.length, reviewCount: reviews.length } } : current);
    } return rows; }
    catch (e) { if (!c.signal.aborted) setError(e.response?.data?.message || 'Unable to load jobs. Check your connection and retry.'); }
    finally { if (!c.signal.aborted) setLoading(false); }
  }, []);
  // Initial network load shares the same loading/retry state as manual refresh.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load(); const timer = setInterval(() => load(true), 30000); return () => { clearInterval(timer); request.current?.abort(); }; }, [load]);
  useEffect(() => {
    let active = true; const revision = profileRevision.current;
    authService.getMe().then(result => { if (active && revision === profileRevision.current) { setAccount(result.user); setOnlineValue(result.user?.providerDetails?.acceptingRequests !== false); } }).catch(() => {});
    // Initial fetch shares the loading state used by the retry control.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadNotifications(); const timer = setInterval(loadNotifications, 30000);
    return () => { active = false; clearInterval(timer); notificationRequest.current?.abort(); };
  }, [loadNotifications]);
  const metrics = useMemo(() => providerMetrics(bookings, asOf), [bookings, asOf]);
  const onUpdate = useCallback(updated => { request.current?.abort(); setLoading(false); setAsOf(new Date()); setBookings(rows => rows.map(b => b.id === updated.id ? updated : b)); }, []);
  const update = useCallback(async (id, values) => {
    if (lock.current) return null; lock.current = true; setBusy(true); setError('');
    try { const updated = await bookingService.update(id, { ...values, bookingVersion: values.bookingVersion ?? bookings.find(b => b.id === id)?.version }); onUpdate(updated); return updated; }
    catch (e) { setError(e.response?.data?.message || 'Job was not updated. Your details are kept; retry after checking your connection.'); return null; }
    finally { lock.current = false; setBusy(false); }
  }, [onUpdate, bookings]);
  const setOnline = useCallback(async value => {
    if (lock.current) return; lock.current = true; setBusy(true); setError('');
    try { await authService.updateProfile({ acceptingRequests: value }); setOnlineValue(value); }
    catch (e) { setError(e.response?.data?.message || 'Online status was not saved. Please retry.'); }
    finally { lock.current = false; setBusy(false); }
  }, []);
  const requests = useMemo(() => bookings.filter(b => ['pending', 'time_proposed'].includes(b.status)).map(b => ({ ...b, customer: b.customerName, description: b.problem, date: bookingDate(b.startsAt), time: bookingTime(b.startsAt), photos: 0 })), [bookings]);
  const saveProfile = async values => {
    profileRevision.current++;
    const updated = await authService.updateProfile(values);
    setAccount(updated);
    await updateUserSession(updated);
    return updated;
  };
  const savePricing = async values => {
    profileRevision.current++;
    const pricing = await bookingService.savePricing(values);
    setAccount(current => ({ ...(current || user), providerDetails: { ...(current || user)?.providerDetails, pricing } }));
    return pricing;
  };
  const value = { savePricing, saveProfile, account: account || user, loaded, metrics, notifications, notificationError, notificationsLoading, loadNotifications, markRead, online, setOnline, bookings, requests, loading, error, busy, load, update, onUpdate, acceptRequest: id => update(id, { action: 'confirm' }), rejectRequest: id => update(id, { action: 'reject' }), pendingCount: requests.length, urgentCount: 0 };
  return <ProviderContext.Provider value={value}>{children}</ProviderContext.Provider>;
};
export const useProviderData = () => {
  const ctx = useContext(ProviderContext);
  if (!ctx) throw new Error('useProviderData must be used inside ProviderDataProvider');
  return ctx;
};
export default ProviderContext;
