import React, { useRef, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Linking, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import * as Location from 'expo-location';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../context/AuthContext';
import { authService } from '../../services/authService';
import { COLORS } from '../../constants/theme';
const errorText = e => e.response?.data?.message || e.message || 'Unable to save. Try again.';
function Button({
  title,
  onPress,
  disabled,
  secondary
}) {
  return <Pressable accessibilityRole="button" accessibilityLabel={title} disabled={disabled} onPress={onPress} style={[s.button, secondary && s.secondary, disabled && {
    opacity: 0.5
  }]}><Text style={secondary ? s.link : s.white}>{title}</Text></Pressable>;
}
function Field({
  label,
  ...props
}) {
  return <View style={s.field}><Text style={s.label}>{label}</Text><TextInput accessibilityLabel={label} style={s.input} {...props} /></View>;
}
export function LocationEditor({
  onClose
}) {
  const {
      user,
      updateUserSession
    } = useAuth(),
    insets = useSafeAreaInsets(),
    lock = useRef(false);
  const [address, setAddress] = useState(user.location?.address || ''),
    [city, setCity] = useState(user.location?.city || ''),
    [latitude, setLatitude] = useState(user.location?.latitude == null ? '' : String(user.location.latitude)),
    [longitude, setLongitude] = useState(user.location?.longitude == null ? '' : String(user.location.longitude));
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [coordinates, setCoordinates] = useState(false);
  async function gps() {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError('');
    try {
      const p = await Location.requestForegroundPermissionsAsync();
      if (p.status !== 'granted') throw new Error('Location permission was denied. You can enter your address manually.');
      const pos = await Promise.race([Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced
      }), new Promise((_, reject) => setTimeout(() => reject(new Error('GPS took too long. Try again or enter your address.')), 15000))]);
      setLatitude(String(pos.coords.latitude));
      setLongitude(String(pos.coords.longitude));
      setCoordinates(true);
    } catch (e) {
      setError(errorText(e));
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  async function save() {
    if (lock.current) return;
    if (!address.trim() && !city.trim() || !!latitude.trim() !== !!longitude.trim() || latitude && (!Number.isFinite(Number(latitude)) || Math.abs(Number(latitude)) > 90) || longitude && (!Number.isFinite(Number(longitude)) || Math.abs(Number(longitude)) > 180)) {
      setError('Enter a street address or city, and valid coordinates together if used.');
      return;
    }
    lock.current = true;
    setBusy(true);
    setError('');
    try {
      const u = await authService.updateProfile({
        location: {
          address: address.trim(),
          city: city.trim(),
          latitude: latitude.trim() ? Number(latitude) : null,
          longitude: longitude.trim() ? Number(longitude) : null
        }
      });
      await updateUserSession(u);
      onClose();
    } catch (e) {
      setError(errorText(e));
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return <Modal visible transparent animationType="slide" onRequestClose={() => {
    if (!busy) onClose();
  }}><KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.overlay}><View style={[s.sheet, {
        paddingBottom: Math.max(24, insets.bottom)
      }]}><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={s.form}><Text style={s.title}>Update Your Location</Text><Text style={s.muted}>Save your address and optional GPS coordinates for nearby providers. Check the service address for each booking.</Text><Field label="Street Address" maxLength={300} value={address} onChangeText={v => {
            setAddress(v);
            setLatitude('');
            setLongitude('');
          }} /><Field label="City / Town" maxLength={120} value={city} onChangeText={v => {
            setCity(v);
            setLatitude('');
            setLongitude('');
          }} /><Button title={busy ? 'Please wait…' : 'Use Device GPS'} disabled={busy} secondary onPress={gps} /><Button title="Set coordinates / view map" secondary disabled={busy} onPress={() => setCoordinates(!coordinates)} />{coordinates && <><Text style={s.muted}>Enter a known map pin or use GPS. Opening the map previews your coordinates; it does not automatically select a new pin.</Text><Field label="Latitude" keyboardType="numbers-and-punctuation" value={latitude} onChangeText={setLatitude} /><Field label="Longitude" keyboardType="numbers-and-punctuation" value={longitude} onChangeText={setLongitude} /><Button secondary title="Open map" onPress={() => {
              const valid = latitude.trim() && longitude.trim() && Number.isFinite(Number(latitude)) && Number.isFinite(Number(longitude)) && Math.abs(Number(latitude)) <= 90 && Math.abs(Number(longitude)) <= 180;
              Linking.openURL('https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(valid ? latitude + ',' + longitude : [address, city, 'Sri Lanka'].filter(Boolean).join(', '))).catch(() => setError('Unable to open maps.'));
            }} /></>}{!!error && <Text accessibilityRole="alert" style={s.error}>{error}</Text>}<Button title="Save Location" disabled={busy} onPress={save} /><Button secondary title="Cancel location changes" disabled={busy} onPress={onClose} /></ScrollView></View></KeyboardAvoidingView></Modal>;
}
export default function ProfileScreen({
  embedded = false,
  children
}) {
  const {
      user,
      logout,
      updateUserSession
    } = useAuth(),
    insets = useSafeAreaInsets(),
    lock = useRef(false);
  const [edit, setEdit] = useState(false),
    [location, setLocation] = useState(false),
    [signout, setSignout] = useState(false),
    [name, setName] = useState(''),
    [phone, setPhone] = useState(''),
    [bio, setBio] = useState(''),
    [area, setArea] = useState(''),
    [experience, setExperience] = useState(''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [notice, setNotice] = useState('');
  const provider = user.role === 'provider';
  async function save() {
    if (lock.current) return;
    if (!name.trim() || !/^\+?[\d\s-]{7,18}$/.test(phone.trim())) {
      setError('Enter your name and a valid phone number.');
      return;
    }
    lock.current = true;
    setBusy(true);
    setError('');
    try {
      const u = await authService.updateProfile({
        name,
        phone,
        ...(provider ? {
          providerDetails: {
            bio,
            serviceArea: area,
            experience
          }
        } : {})
      });
      await updateUserSession(u);
      setEdit(false);
      setNotice('Profile updated.');
    } catch (e) {
      setError(errorText(e));
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return <View style={s.screen}><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={[s.content, !embedded && {
      paddingTop: insets.top + 24
    }]}>{!embedded && <Text style={s.title}>{provider ? 'Profile & earnings' : 'My profile'}</Text>}{provider ? <View style={s.providerCard}><View style={s.providerRow}><View style={s.providerAvatar}><Text style={s.providerInitials}>{user.name?.split(/\s+/).slice(0, 2).map(n => n[0]).join('')}</Text></View><View style={s.providerIdentity}><Text style={s.providerName}>{user.name}</Text><Text style={s.link}>{user.providerDetails?.category || 'Service provider'}</Text><Text style={s.muted}>{user.providerDetails?.experience || 'Experience not listed'}</Text></View></View><View style={s.providerBadge}><Text style={s.providerBadgeText}>{user.isApprovedByAdmin && user.isVerified ? 'Verified provider' : 'Pending verification'}</Text></View><View style={s.providerContact}><Text style={s.muted}>{user.email}</Text><Text style={s.muted}>{user.phone}</Text><Text style={s.muted}>{user.providerDetails?.serviceArea || 'Service area not set'}</Text></View>{!!user.providerDetails?.bio && <Text style={s.muted}>{user.providerDetails.bio}</Text>}</View> : <View style={s.card}><Text style={s.avatar}>{user.name?.split(/\s+/).slice(0, 2).map(n => n[0]).join('')}</Text><Text style={s.title}>{user.name}</Text><Text style={s.link}>{provider ? user.providerDetails?.category : 'FixMate Customer'}</Text><Text style={s.muted}>{user.email}</Text><Text style={s.muted}>{user.phone}</Text>{provider && <Text style={s.link}>{user.isApprovedByAdmin ? 'Verified provider' : 'Pending verification'} · {user.providerDetails?.experience || 'Experience not listed'}</Text>}{provider && !!user.providerDetails?.bio && <Text style={s.muted}>{user.providerDetails.bio}</Text>}{provider && <Text style={s.muted}>{user.providerDetails?.serviceArea || 'Service area not set'}</Text>}</View>}{!!notice && <Text accessibilityRole="alert" style={s.link}>{notice}</Text>}<Button title="Edit profile" onPress={() => {
        setName(user.name);
        setPhone(user.phone);
        setBio(user.providerDetails?.bio || '');
        setArea(user.providerDetails?.serviceArea || '');
        setExperience(user.providerDetails?.experience || '');
        setError('');
        setEdit(true);
      }} />{!provider && <View style={s.card}><Text style={s.label}>Saved location</Text><Text style={s.muted}>{[user.location?.address, user.location?.city].filter(Boolean).join(', ') || 'No location saved'}</Text><Button secondary title="Update location" onPress={() => setLocation(true)} /></View>}{children}{signout ? <View style={s.card}><Text style={s.label}>Log out of FixMate?</Text><Button title="Confirm logout" onPress={logout} /><Button title="Stay signed in" secondary onPress={() => setSignout(false)} /></View> : <Button title="Log out" secondary onPress={() => setSignout(true)} />}</ScrollView>{location && <LocationEditor onClose={() => setLocation(false)} />}{edit && <Modal visible animationType="slide" onRequestClose={() => {
      if (!busy) setEdit(false);
    }}><KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.screen}><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={[s.content, {
          paddingTop: insets.top + 24,
          paddingBottom: insets.bottom + 24
        }]}><Text style={s.title}>Edit profile</Text><Text style={s.muted}>Email, service category and verification records are managed separately.</Text><Field label="Full name" maxLength={120} value={name} onChangeText={setName} /><Field label="Phone number" maxLength={18} keyboardType="phone-pad" value={phone} onChangeText={setPhone} />{provider && <><Field label="About your services" multiline maxLength={2000} value={bio} onChangeText={setBio} /><Field label="Service area" maxLength={300} value={area} onChangeText={setArea} /><Field label="Experience" maxLength={120} value={experience} onChangeText={setExperience} /></>}{!!error && <Text accessibilityRole="alert" style={s.error}>{error}</Text>}{busy && <ActivityIndicator color={COLORS.primary} />}<Button title="Save profile" disabled={busy} onPress={save} /><Button title="Cancel editing" secondary disabled={busy} onPress={() => setEdit(false)} /></ScrollView></KeyboardAvoidingView></Modal>}</View>;
}
const s = StyleSheet.create({
  providerCard: { backgroundColor: '#FFF', borderWidth: 1, borderColor: '#ECECF4', borderRadius: 14, padding: 20, gap: 14 },
  providerRow: { flexDirection: 'row', gap: 14, alignItems: 'center' },
  providerAvatar: { width: 64, height: 64, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: '#EEEAFE' },
  providerInitials: { color: COLORS.primary, fontSize: 23, fontWeight: '700' },
  providerIdentity: { flex: 1, gap: 4 },
  providerName: { color: '#20283D', fontSize: 19, fontWeight: '700' },
  providerBadge: { backgroundColor: '#E7F8F0', borderRadius: 6, paddingHorizontal: 10, paddingVertical: 6, alignSelf: 'flex-start' },
  providerBadgeText: { color: '#128560', fontSize: 11, fontWeight: '600' },
  providerContact: { borderTopWidth: 1, borderTopColor: '#F0EDF6', paddingTop: 12, gap: 4 },

  screen: {
    flex: 1,
    backgroundColor: '#F9F8FD'
  },
  content: {
    padding: 20,
    paddingBottom: 32,
    gap: 16,
    width: '100%',
    maxWidth: 760,
    alignSelf: 'center'
  },
  title: {
    fontSize: 23,
    fontWeight: '700',
    color: '#272727'
  },
  muted: {
    fontSize: 13,
    color: '#716C7E',
    lineHeight: 21
  },
  card: {
    backgroundColor: '#FFF',
    borderRadius: 20,
    padding: 22,
    gap: 12
  },
  avatar: {
    fontSize: 26,
    fontWeight: '700',
    color: COLORS.primary,
    backgroundColor: '#EEE8FF',
    padding: 20,
    alignSelf: 'flex-start',
    borderRadius: 18
  },
  link: {
    color: COLORS.primary,
    fontWeight: '600'
  },
  white: {
    color: '#FFF',
    fontWeight: '700'
  },
  button: {
    backgroundColor: COLORS.primary,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center'
  },
  secondary: {
    backgroundColor: '#EEE8FF'
  },
  input: {
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#E5DFEF',
    borderRadius: 12,
    padding: 14,
    minHeight: 50,
    color: '#272727'
  },
  label: {
    color: '#272727',
    fontWeight: '600'
  },
  field: {
    gap: 8
  },
  error: {
    color: '#B3273C'
  },
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.45)'
  },
  sheet: {
    backgroundColor: '#F9F8FD',
    maxHeight: '90%',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    width: '100%',
    maxWidth: 600,
    alignSelf: 'center'
  },
  form: {
    gap: 16
  }
});
