import React, { useCallback, useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StatusBar,
  StyleSheet,
  Alert,
  Modal,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  Image,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useFocusEffect } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../../context/AuthContext";
import { bookingService, bookingWhen } from "../../services/bookingService";
import { COLORS } from "../../constants/theme";

const getInitials = (name = "") => {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
};

// Default Contacts & Seed Messages matching reference UI
const DEMO_CONTACTS = [
  {
    id: "demo-1",
    name: "Jenny Wilson",
    service: "House Cleaning",
    unread: 2,
    time: "13.29",
    avatar: require("../../../assets/images/Home/Sanduni rathnayake.jpg"),
    lastMessage: "I have booked your house cleaning service...",
    initialMessages: [
      { id: "m1", sender: "user", text: "Hi Jenny, good morning 😊", time: "10:00" },
      { id: "m2", sender: "user", text: "I have booked your house cleaning service for December 23 at 10 AM 😊", time: "10:00" },
      { id: "m3", sender: "other", text: "Hi, morning too Andrew!", time: "10:00" },
      { id: "m4", sender: "other", text: "Yes, I have received your order. I will come on that date! 😁😁", time: "10:00" },
      { id: "m5", sender: "user", text: "Good, thanks Jenny...", time: "10:01" },
      {
        id: "m6",
        sender: "user",
        text: "Here I send a photo of room & my house 😁",
        time: "10:01",
        images: [
          require("../../../assets/images/Home/full home deep clean.jpg"),
          require("../../../assets/images/Home/Single room painting.jpg"),
        ],
      },
    ],
  },
  {
    id: "demo-2",
    name: "Alfonzo Schuessler",
    service: "Floor Cleaning",
    unread: 3,
    time: "10:48",
    avatar: require("../../../assets/images/Home/Arjun perera.jpg"),
    lastMessage: "I just finished it 😂😂",
    initialMessages: [
      { id: "a1", sender: "other", text: "Hi! I am arriving in 10 minutes.", time: "10:30" },
      { id: "a2", sender: "user", text: "Awesome, the front door is unlocked!", time: "10:32" },
      { id: "a3", sender: "other", text: "I just finished it 😂😂", time: "10:48" },
    ],
  },
  {
    id: "demo-3",
    name: "Benny Spanbauer",
    service: "Plumbing Service",
    unread: 0,
    time: "09.25",
    avatar: require("../../../assets/images/Home/Leaking tap repair.jpg"),
    lastMessage: "omg, this is amazing 🔥🔥🔥",
    initialMessages: [
      { id: "b1", sender: "other", text: "Fixed the tap leak under the kitchen sink!", time: "09:20" },
      { id: "b2", sender: "user", text: "omg, this is amazing 🔥🔥🔥", time: "09:25" },
    ],
  },
  {
    id: "demo-4",
    name: "Kylee Danford",
    service: "Painting",
    unread: 0,
    time: "Dec 20",
    avatar: require("../../../assets/images/Home/Single room painting.jpg"),
    lastMessage: "just ideas for next time 😆",
    initialMessages: [
      { id: "k1", sender: "other", text: "Check out the color swatch for the living room.", time: "Dec 20" },
      { id: "k2", sender: "user", text: "just ideas for next time 😆", time: "Dec 20" },
    ],
  },
];

export default function MessagesScreen({
  embedded = false,
  route,
  bookingId = route?.params?.bookingId,
  openRequest = route?.params?.openRequest,
}) {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();

  // State
  const [jobs, setJobs] = useState([]);
  const [selected, setSelected] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [attachedImage, setAttachedImage] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showNewChatModal, setShowNewChatModal] = useState(false);

  const revision = useRef(0);
  const opened = useRef(null);
  const lock = useRef(false);
  const scrollRef = useRef(null);
  const role = user?.role;

  // Load bookings from API
  const load = useCallback(
    (signal) => {
      setLoading(true);
      setError("");
      return bookingService
        .list(signal)
        .then((rows) => {
          if (!signal.aborted) {
            const sorted = rows.sort(
              (a, b) =>
                new Date(b.lastMessage?.createdAt || b.createdAt) -
                new Date(a.lastMessage?.createdAt || a.createdAt)
            );
            setJobs(sorted);
            const target = rows.find((b) => b.id === bookingId);
            if (bookingId && opened.current !== openRequest) {
              if (target) {
                opened.current = openRequest;
                revision.current++;
                setMessages([]);
                setText("");
                setSelected({
                  id: target.id,
                  name: role === "provider" ? target.customerName : target.providerName,
                  service: target.service,
                  isBackendBooking: true,
                });
              }
            }
          }
        })
        .catch((e) => {
          if (!signal.aborted)
            setError(e.response?.data?.message || "Unable to load conversations.");
        })
        .finally(() => {
          if (!signal.aborted) setLoading(false);
        });
    },
    [bookingId, openRequest, role]
  );

  useFocusEffect(
    useCallback(() => {
      const c = new AbortController();
      void load(c.signal);
      return () => c.abort();
    }, [load])
  );

  // Load messages for backend selected chat
  useFocusEffect(
    useCallback(() => {
      if (!selected || !selected.isBackendBooking) return;
      const c = new AbortController();
      const read = () => {
        const version = revision.current;
        return bookingService
          .messages(selected.id, c.signal)
          .then((rows) => {
            if (!c.signal.aborted && version === revision.current) {
              setMessages(
                rows.map((m) => ({
                  id: m.id,
                  sender: m.sender === String(user.id || user._id) ? "user" : "other",
                  text: m.text,
                  time: bookingWhen(m.createdAt),
                }))
              );
              setError("");
            }
          })
          .catch((e) => {
            if (!c.signal.aborted)
              setError(e.response?.data?.message || "Unable to load messages.");
          });
      };
      void read();
      const timer = setInterval(read, 5000);
      return () => {
        c.abort();
        clearInterval(timer);
      };
    }, [selected, user.id, user._id])
  );

  const closeChat = () => {
    if (sending) return;
    setSelected(null);
    setAttachedImage(null);
    setText("");
  };

  const openConversation = (contact) => {
    revision.current++;
    setSelected(contact);
    setAttachedImage(null);
    if (contact.initialMessages) {
      setMessages(contact.initialMessages);
    } else {
      setMessages([]);
    }
    setText("");
    setError("");
  };

  // Image Picker attachment
  const handlePickImage = async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert("Permission Required", "Please allow access to your photos to attach an image.");
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setAttachedImage(result.assets[0].uri);
      }
    } catch (_e) {
      Alert.alert("Error", "Could not attach image.");
    }
  };

  // Send Message
  const handleSend = async () => {
    if (lock.current || (!text.trim() && !attachedImage)) return;
    lock.current = true;
    setSending(true);

    const nowTime = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    const newMessageObj = {
      id: Date.now().toString(),
      sender: "user",
      text: text.trim(),
      time: nowTime,
      ...(attachedImage ? { images: [attachedImage] } : {}),
    };

    if (selected?.isBackendBooking) {
      try {
        const rows = await bookingService.sendMessage(selected.id, text.trim(), Date.now().toString());
        setMessages(
          rows.map((m) => ({
            id: m.id,
            sender: m.sender === String(user.id || user._id) ? "user" : "other",
            text: m.text,
            time: bookingWhen(m.createdAt),
          }))
        );
        setText("");
        setAttachedImage(null);
      } catch (_e) {
        setError("Failed to send message. Please try again.");
      } finally {
        lock.current = false;
        setSending(false);
      }
    } else {
      // Demo Chat send state
      setMessages((prev) => [...prev, newMessageObj]);
      setText("");
      setAttachedImage(null);
      setSending(false);
      lock.current = false;

      // Simulated realistic auto reply after 1.5 seconds!
      setTimeout(() => {
        setMessages((prev) => [
          ...prev,
          {
            id: (Date.now() + 1).toString(),
            sender: "other",
            text: "Got it! Thanks for letting me know 😊",
            time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          },
        ]);
      }, 1500);
    }
  };

  // Combine real backend conversations & demo contacts
  const allConversations = [
    ...jobs.map((b) => ({
      id: b.id,
      name: user.role === "provider" ? b.customerName : b.providerName,
      service: b.service,
      lastMessage: b.lastMessage?.text || "Tap to chat about this booking",
      time: b.lastMessage ? bookingWhen(b.lastMessage.createdAt) : "New",
      unread: 0,
      avatar: null,
      isBackendBooking: true,
    })),
    ...DEMO_CONTACTS,
  ];

  const filteredConversations = searchQuery.trim()
    ? allConversations.filter(
        (c) =>
          c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          c.lastMessage.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : allConversations;

  return (
    <View style={[styles.screen, !embedded && { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.background} />

      {/* Inbox Header */}
      {!embedded && (
        <View style={styles.inboxHeader}>
          <View style={styles.inboxTitleRow}>
            <View style={styles.appLogoCircle}>
              <Text style={styles.appLogoText}>h</Text>
            </View>
            <Text style={styles.inboxTitle}>Inbox</Text>
          </View>

          <View style={styles.headerActions}>
            <TouchableOpacity
              style={styles.iconBtn}
              onPress={() => setShowSearch(!showSearch)}
            >
              <MaterialCommunityIcons name="magnify" size={24} color={COLORS.textPrimary} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.iconBtn}
              onPress={() => Alert.alert("Options", "Message settings")}
            >
              <MaterialCommunityIcons name="dots-horizontal-circle-outline" size={24} color={COLORS.textPrimary} />
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Search Input Bar */}
      {showSearch && (
        <View style={styles.searchBarContainer}>
          <MaterialCommunityIcons name="magnify" size={20} color={COLORS.primary} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search messages or contacts..."
            placeholderTextColor="#94A3B8"
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoFocus
          />
          {!!searchQuery && (
            <TouchableOpacity onPress={() => setSearchQuery("")}>
              <MaterialCommunityIcons name="close-circle" size={18} color="#94A3B8" />
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Conversations List */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
      >
        {loading && <ActivityIndicator color={COLORS.primary} style={{ marginVertical: 20 }} />}
        {!!error && <Text style={{ color: COLORS.error, marginVertical: 8 }}>{error}</Text>}

        {filteredConversations.map((item) => (
          <TouchableOpacity
            key={item.id}
            style={styles.conversationItem}
            activeOpacity={0.75}
            onPress={() => openConversation(item)}
          >
            {item.avatar ? (
              <Image source={item.avatar} style={styles.avatarImage} />
            ) : (
              <View style={styles.avatarCircle}>
                <Text style={styles.avatarText}>{getInitials(item.name)}</Text>
              </View>
            )}

            <View style={styles.chatInfo}>
              <Text style={styles.chatName}>{item.name}</Text>
              <Text style={styles.chatPreview} numberOfLines={1}>
                {item.lastMessage}
              </Text>
            </View>

            <View style={styles.chatMeta}>
              <Text style={styles.chatTime}>{item.time}</Text>
              {item.unread > 0 && (
                <View style={styles.unreadBadge}>
                  <Text style={styles.unreadText}>{item.unread}</Text>
                </View>
              )}
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Floating Action Button (+) */}
      <TouchableOpacity
        style={styles.fabBtn}
        activeOpacity={0.88}
        onPress={() => setShowNewChatModal(true)}
        accessibilityRole="button"
        accessibilityLabel="New chat"
      >
        <MaterialCommunityIcons name="plus" size={28} color="#FFFFFF" />
      </TouchableOpacity>

      {/* --------------------------------------------------------------------------- */}
      {/* DIRECT CHAT MODAL (Matching Reference Images 1, 2, 3)                       */}
      {/* --------------------------------------------------------------------------- */}
      {!!selected && (
        <Modal
          visible
          animationType="slide"
          onRequestClose={closeChat}
        >
          <SafeAreaView style={{ flex: 1, backgroundColor: "#FFFFFF" }}>
            {/* Chat Screen Header */}
            <View style={styles.chatHeader}>
              <TouchableOpacity style={styles.backBtn} onPress={closeChat}>
                <MaterialCommunityIcons name="arrow-left" size={24} color={COLORS.textPrimary} />
              </TouchableOpacity>

              <Text style={styles.chatHeaderName} numberOfLines={1}>
                {selected.name}
              </Text>

              <View style={styles.chatHeaderActions}>
                <TouchableOpacity
                  style={styles.chatHeaderIcon}
                  onPress={() => Alert.alert("Options", `Chat options for ${selected.name}`)}
                >
                  <MaterialCommunityIcons name="dots-horizontal-circle-outline" size={24} color={COLORS.textPrimary} />
                </TouchableOpacity>
              </View>
            </View>

            {/* Chat Body & Messages */}
            <KeyboardAvoidingView
              behavior={Platform.OS === "ios" ? "padding" : undefined}
              style={{ flex: 1 }}
            >
              <ScrollView
                ref={scrollRef}
                onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
                contentContainerStyle={styles.messagesContainer}
                showsVerticalScrollIndicator={false}
              >
                {/* Date separator badge */}
                <View style={styles.dateBadgeContainer}>
                  <View style={styles.dateBadge}>
                    <Text style={styles.dateBadgeText}>Today</Text>
                  </View>
                </View>

                {messages.map((m) => {
                  const isUser = m.sender === "user";
                  return (
                    <View
                      key={m.id}
                      style={[
                        styles.bubbleWrapper,
                        isUser ? styles.bubbleWrapperUser : styles.bubbleWrapperOther,
                      ]}
                    >
                      <View
                        style={[
                          styles.bubble,
                          isUser ? styles.bubbleUser : styles.bubbleOther,
                        ]}
                      >
                        <Text style={[styles.messageText, isUser ? styles.messageTextUser : styles.messageTextOther]}>
                          {m.text}
                        </Text>
                        <Text style={[styles.timeStamp, isUser ? styles.timeStampUser : styles.timeStampOther]}>
                          {m.time}
                        </Text>
                      </View>

                      {/* Attached Images inside chat message */}
                      {m.images && m.images.length > 0 && (
                        <View style={styles.chatImagesRow}>
                          {m.images.map((img, idx) => (
                            <Image
                              key={idx}
                              source={typeof img === "string" ? { uri: img } : img}
                              style={styles.chatAttachedImage}
                            />
                          ))}
                        </View>
                      )}
                    </View>
                  );
                })}
              </ScrollView>

              {/* Image Preview attachment badge before send */}
              {attachedImage && (
                <View style={styles.attachedImagePreviewRow}>
                  <Image source={{ uri: attachedImage }} style={styles.attachedPreviewThumb} />
                  <Text style={styles.attachedPreviewText}>Image Attached</Text>
                  <TouchableOpacity onPress={() => setAttachedImage(null)}>
                    <MaterialCommunityIcons name="close-circle" size={20} color={COLORS.error} />
                  </TouchableOpacity>
                </View>
              )}

              {/* Message Input Bar (Matching Reference Images 1, 2, 3) */}
              <View style={[styles.inputBarRow, { paddingBottom: Math.max(12, insets.bottom) }]}>
                <View style={styles.textInputBox}>
                  <TextInput
                    style={styles.chatInput}
                    placeholder="Message..."
                    placeholderTextColor="#94A3B8"
                    value={text}
                    onChangeText={setText}
                    multiline
                  />
                  <TouchableOpacity
                    style={styles.attachBtn}
                    onPress={handlePickImage}
                  >
                    <MaterialCommunityIcons name="image-outline" size={22} color="#94A3B8" />
                  </TouchableOpacity>
                </View>

                <TouchableOpacity
                  style={styles.sendFabBtn}
                  onPress={handleSend}
                  disabled={sending || (!text.trim() && !attachedImage)}
                >
                  <MaterialCommunityIcons
                    name={text.trim() || attachedImage ? "send" : "microphone"}
                    size={22}
                    color="#FFFFFF"
                  />
                </TouchableOpacity>
              </View>
            </KeyboardAvoidingView>
          </SafeAreaView>
        </Modal>
      )}

      {/* NEW CHAT MODAL */}
      <Modal
        visible={showNewChatModal}
        animationType="slide"
        onRequestClose={() => setShowNewChatModal(false)}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: "#FFFFFF" }}>
          <View style={styles.chatHeader}>
            <TouchableOpacity style={styles.backBtn} onPress={() => setShowNewChatModal(false)}>
              <MaterialCommunityIcons name="close" size={24} color={COLORS.textPrimary} />
            </TouchableOpacity>
            <Text style={styles.chatHeaderName}>New Message</Text>
            <View style={{ width: 40 }} />
          </View>

          <ScrollView contentContainerStyle={{ padding: 20 }}>
            <Text style={{ fontSize: 16, fontWeight: "800", marginBottom: 14 }}>Select Contact</Text>
            {DEMO_CONTACTS.map((c) => (
              <TouchableOpacity
                key={c.id}
                style={styles.conversationItem}
                onPress={() => {
                  setShowNewChatModal(false);
                  openConversation(c);
                }}
              >
                <Image source={c.avatar} style={styles.avatarImage} />
                <View style={styles.chatInfo}>
                  <Text style={styles.chatName}>{c.name}</Text>
                  <Text style={styles.chatPreview}>{c.service}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  // Inbox Header
  inboxHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: COLORS.background,
  },
  inboxTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  appLogoCircle: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  appLogoText: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "900",
  },
  inboxTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: COLORS.textPrimary,
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  searchBarContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    marginHorizontal: 20,
    marginBottom: 12,
    paddingHorizontal: 14,
    height: 46,
    borderRadius: 14,
    gap: 10,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: COLORS.textPrimary,
  },
  // Conversation List
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 80,
    maxWidth: 640,
    width: "100%",
    alignSelf: "center",
  },
  conversationItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  avatarImage: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#F3E8FF",
    resizeMode: "cover",
  },
  avatarCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#F3E8FF",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    fontSize: 18,
    fontWeight: "800",
    color: COLORS.primary,
  },
  chatInfo: {
    flex: 1,
    marginLeft: 14,
    marginRight: 10,
  },
  chatName: {
    fontSize: 16,
    fontWeight: "800",
    color: COLORS.textPrimary,
  },
  chatPreview: {
    fontSize: 13,
    color: COLORS.textMuted,
    marginTop: 3,
  },
  chatMeta: {
    alignItems: "flex-end",
    gap: 6,
  },
  chatTime: {
    fontSize: 12,
    color: COLORS.textMuted,
    fontWeight: "500",
  },
  unreadBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  unreadText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  fabBtn: {
    position: "absolute",
    bottom: 24,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },

  // Direct Chat Screen
  chatHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
    backgroundColor: "#FFFFFF",
  },
  backBtn: {
    padding: 6,
  },
  chatHeaderName: {
    fontSize: 18,
    fontWeight: "800",
    color: COLORS.textPrimary,
    flex: 1,
    marginLeft: 8,
  },
  chatHeaderActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  chatHeaderIcon: {
    padding: 6,
  },
  messagesContainer: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    maxWidth: 640,
    width: "100%",
    alignSelf: "center",
  },
  dateBadgeContainer: {
    alignItems: "center",
    marginVertical: 12,
  },
  dateBadge: {
    backgroundColor: "#F1F5F9",
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 12,
  },
  dateBadgeText: {
    fontSize: 12,
    fontWeight: "600",
    color: COLORS.textMuted,
  },
  bubbleWrapper: {
    marginBottom: 12,
    maxWidth: "82%",
  },
  bubbleWrapperUser: {
    alignSelf: "flex-end",
  },
  bubbleWrapperOther: {
    alignSelf: "flex-start",
  },
  bubble: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 18,
  },
  bubbleUser: {
    backgroundColor: COLORS.primary,
    borderBottomRightRadius: 4,
  },
  bubbleOther: {
    backgroundColor: "#F1F5F9",
    borderBottomLeftRadius: 4,
  },
  messageText: {
    fontSize: 14,
    lineHeight: 20,
  },
  messageTextUser: {
    color: "#FFFFFF",
    fontWeight: "500",
  },
  messageTextOther: {
    color: COLORS.textPrimary,
    fontWeight: "500",
  },
  timeStamp: {
    fontSize: 10,
    marginTop: 4,
    alignSelf: "flex-end",
  },
  timeStampUser: {
    color: "rgba(255, 255, 255, 0.75)",
  },
  timeStampOther: {
    color: COLORS.textMuted,
  },
  chatImagesRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 8,
  },
  chatAttachedImage: {
    width: 140,
    height: 140,
    borderRadius: 16,
    resizeMode: "cover",
  },
  attachedImagePreviewRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: "#F3E8FF",
    gap: 10,
  },
  attachedPreviewThumb: {
    width: 36,
    height: 36,
    borderRadius: 8,
  },
  attachedPreviewText: {
    flex: 1,
    fontSize: 12,
    fontWeight: "700",
    color: COLORS.primary,
  },
  // Input Bar
  inputBarRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 10,
    backgroundColor: "#FFFFFF",
    gap: 10,
    maxWidth: 640,
    width: "100%",
    alignSelf: "center",
  },
  textInputBox: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F8F9FE",
    borderRadius: 24,
    paddingHorizontal: 16,
    minHeight: 48,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  chatInput: {
    flex: 1,
    fontSize: 14,
    color: COLORS.textPrimary,
    maxHeight: 100,
    paddingVertical: 10,
  },
  attachBtn: {
    padding: 6,
  },
  sendFabBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
});

