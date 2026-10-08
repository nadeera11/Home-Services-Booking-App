import React, { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../context/AuthContext';
import { bookingService, bookingWhen } from '../../services/bookingService';
import { COLORS } from '../../constants/theme';
export default function MessagesScreen({
  embedded = false, route, bookingId = route?.params?.bookingId, openRequest = route?.params?.openRequest
}) {
  const {
      user
    } = useAuth(),
    insets = useSafeAreaInsets();
  const [jobs, setJobs] = useState([]),
    [selected, setSelected] = useState(null),
    [messages, setMessages] = useState([]),
    [text, setText] = useState(''),
    [error, setError] = useState(''),
    [loading, setLoading] = useState(true),
    [sending, setSending] = useState(false);
  const revision = useRef(0), opened = useRef(null);
  const lock = useRef(false),
    draft = useRef(null),
    scroll = useRef(null);
  const load = useCallback(signal => {
    setLoading(true);
    setError('');
    return bookingService.list(signal).then(rows => {
      if (!signal.aborted) {
        setJobs(rows.sort((a, b) => new Date(b.lastMessage?.createdAt || b.createdAt) - new Date(a.lastMessage?.createdAt || a.createdAt)));
        const target = rows.find(b => b.id === bookingId);
        if (bookingId && opened.current !== openRequest) {
          if (target) { opened.current = openRequest; revision.current++; setMessages([]); setText(''); draft.current = null; setSelected(target); }
          else setError('This booking conversation is no longer available. Refresh conversations to check again.');
        }
      }
    }).catch(e => {
      if (!signal.aborted) setError(e.response?.data?.message || 'Unable to load conversations. Try again.');
    }).finally(() => {
      if (!signal.aborted) setLoading(false);
    });
  }, [bookingId, openRequest]);
  useFocusEffect(useCallback(() => {
    const c = new AbortController();
    void load(c.signal);
    return () => c.abort();
  }, [load]));
  useFocusEffect(useCallback(() => {
    if (!selected) return;
    const c = new AbortController();
    const read = () => {
      const version = revision.current;
      return bookingService.messages(selected.id, c.signal).then(rows => {
        if (!c.signal.aborted && version === revision.current) {
          setMessages(rows);
          setError('');
        }
      }).catch(e => {
        if (!c.signal.aborted) setError(e.response?.data?.message || 'Unable to load messages. Try again.');
      });
    };
    void read();
    const timer = setInterval(read, 5000);
    return () => {
      c.abort();
      clearInterval(timer);
    };
  }, [selected]));
  function closeChat() {
    if (sending) return;
    if (selected && messages.length) setJobs(rows => rows.map(b => b.id === selected.id ? {
      ...b,
      lastMessage: messages[messages.length - 1]
    } : b));
    setSelected(null);
  }
  const who = b => user.role === 'provider' ? b.customerName : b.providerName;
  async function send() {
    if (lock.current || !text.trim()) return;
    lock.current = true;
    revision.current++;
    setSending(true);
    setError('');
    if (!draft.current || draft.current.text !== text.trim()) draft.current = {
      text: text.trim(),
      id: Date.now().toString(36) + '-' + Math.random().toString(36).slice(2) + '-message'
    };
    try {
      const rows = await bookingService.sendMessage(selected.id, draft.current.text, draft.current.id);
      revision.current++;
      setMessages(rows);
      setText('');
      draft.current = null;
    } catch (e) {
      setError(e.response?.data?.message || 'Message not sent. Your draft is kept; try again.');
    } finally {
      lock.current = false;
      setSending(false);
    }
  }
  return <View style={[s.screen, !embedded && {
    paddingTop: insets.top
  }]}>
    <ScrollView contentContainerStyle={s.content}>{!embedded && <Text style={s.title}>Messages</Text>}<Text style={s.muted}>Conversations with your {user.role === 'provider' ? 'customers' : 'providers'}, linked to each booking.</Text>{loading && <ActivityIndicator color={COLORS.primary} />}{!!error && !selected && <Text accessibilityRole="alert" style={s.error}>{error}</Text>}{!selected && <Pressable accessibilityRole="button" onPress={() => load(new AbortController().signal)} style={s.secondary}><Text style={s.link}>Refresh conversations</Text></Pressable>}{!loading && !error && !jobs.length && <View style={s.card}><Text style={s.title}>No conversations yet</Text><Text style={s.muted}>Your booking conversations will appear here after a request is sent.</Text></View>}{jobs.map(b => <Pressable key={b.id} accessibilityRole="button" accessibilityLabel={'Chat with ' + who(b) + ' about ' + b.service} onPress={() => {
        revision.current++;
        setMessages([]);
        setText('');
        setError('');
        draft.current = null;
        setSelected(b);
      }} style={[s.card, embedded && s.providerConversation]}>{embedded && <View style={s.chatAvatar}><Text style={s.chatInitials}>{who(b).split(/\s+/).slice(0, 2).map(n => n[0]).join('')}</Text></View>}<View style={{ flex: 1, gap: 6 }}><Text style={s.name}>{who(b)}</Text><Text style={s.link}>{b.service} · {b.reference.slice(-8)}</Text><Text numberOfLines={2} style={s.muted}>{b.lastMessage?.text || 'Start a conversation about this booking'}</Text></View></Pressable>)}</ScrollView>
    {!!selected && <Modal visible animationType="slide" onRequestClose={closeChat}><KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={[s.screen, {
        paddingTop: insets.top,
        paddingBottom: insets.bottom
      }]}><View style={s.content}><Pressable accessibilityRole="button" disabled={sending} onPress={closeChat}><Text style={s.link}>Back to messages</Text></Pressable><Text style={s.title}>{who(selected)}</Text><Text style={s.muted}>{selected.service} · {selected.reference.slice(-8)}</Text></View><ScrollView ref={scroll} onContentSizeChange={() => scroll.current?.scrollToEnd({
          animated: true
        })} contentContainerStyle={s.content}>{!messages.length && <Text style={s.muted}>Start the conversation about access, timing or service details.</Text>}{messages.map(m => <View key={m.id} style={[s.bubble, m.sender === String(user.id || user._id) && s.mine]}><Text style={s.message}>{m.text}</Text><Text style={s.muted}>{bookingWhen(m.createdAt)}</Text></View>)}</ScrollView><View style={s.content}>{!!error && <Text accessibilityRole="alert" style={s.error}>{error}</Text>}<TextInput accessibilityLabel="Message" multiline maxLength={2000} editable={!sending} value={text} onChangeText={setText} placeholder="Write a message…" style={s.input} /><Pressable accessibilityRole="button" disabled={sending || !text.trim()} onPress={send} style={[s.button, (sending || !text.trim()) && {
            opacity: 0.5
          }]}><Text style={s.white}>{sending ? 'Sending…' : 'Send message'}</Text></Pressable></View></KeyboardAvoidingView></Modal>}
  </View>;
}
const s = StyleSheet.create({
  providerConversation: { flexDirection: 'row', alignItems: 'center', gap: 14, borderRadius: 14, borderWidth: 1, borderColor: '#ECECF4' },
  chatAvatar: { width: 44, height: 44, borderRadius: 12, backgroundColor: '#EEEAFE', alignItems: 'center', justifyContent: 'center' },
  chatInitials: { color: COLORS.primary, fontWeight: '700', fontSize: 15 },

  screen: {
    flex: 1,
    backgroundColor: '#F9F8FD'
  },
  content: {
    padding: 20,
    gap: 14,
    maxWidth: 760,
    width: '100%',
    alignSelf: 'center'
  },
  title: {
    fontSize: 23,
    fontWeight: '700',
    color: '#272727'
  },
  name: {
    fontSize: 17,
    fontWeight: '700'
  },
  muted: {
    fontSize: 12,
    color: '#747080',
    lineHeight: 19
  },
  link: {
    color: COLORS.primary,
    fontWeight: '600'
  },
  card: {
    backgroundColor: '#FFF',
    padding: 20,
    borderRadius: 18,
    gap: 9
  },
  input: {
    backgroundColor: '#FFF',
    padding: 14,
    borderWidth: 1,
    borderColor: '#E5DFEF',
    borderRadius: 12,
    minHeight: 54,
    maxHeight: 130
  },
  button: {
    backgroundColor: COLORS.primary,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center'
  },
  white: {
    color: '#FFF',
    fontWeight: '700'
  },
  secondary: {
    padding: 12
  },
  error: {
    color: '#B3273C'
  },
  bubble: {
    backgroundColor: '#FFF',
    padding: 16,
    borderRadius: 16,
    gap: 8,
    alignSelf: 'flex-start',
    maxWidth: '90%'
  },
  mine: {
    backgroundColor: '#EEE8FF',
    alignSelf: 'flex-end'
  },
  message: {
    color: '#272727',
    fontSize: 15,
    lineHeight: 23
  }
});
