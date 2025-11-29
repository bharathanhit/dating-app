// MessagesPage.jsx
import React, { useEffect, useState, useRef, useMemo } from "react";
import { useLocation } from "react-router-dom";
import {
  Box,
  Container,
  Grid,
  Typography,
  Avatar,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Divider,
  IconButton,
  TextField,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import SendIcon from "@mui/icons-material/Send";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { useAuth } from "../context/AuthContext";
import { getOrCreateConversation, listenForConversations } from "../services/chatServiceV2";
import {
  listenForMessagesRealtime,
  sendMessageRealtime,
  setTypingStatus,
  listenForTyping,
  markMessagesAsRead,
  setUserOnline,
  setUserOffline
} from "../services/chatRealtimeService";
import { getUserProfile } from "../services/userService";
import { ref, onValue } from "firebase/database";
import { realtimeDb } from "../config/firebase";

const IG_GRADIENT = "linear-gradient(135deg,#8e2de2 0%,#4a00e0 50%,#ff5fa2 100%)";

const formatTime = (ts) => {
  if (!ts) return "";
  const d = new Date(Number(ts));
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
};

const dateLabelFor = (ts) => {
  const d = new Date(Number(ts));
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  const yesterday = new Date();
  yesterday.setDate(now.getDate() - 1);
  const isYesterday =
    d.getFullYear() === yesterday.getFullYear() &&
    d.getMonth() === yesterday.getMonth() &&
    d.getDate() === yesterday.getDate();

  if (sameDay) return "Today";
  if (isYesterday) return "Yesterday";
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
};

// group sorted messages by date label
const groupMessagesByDate = (messages) => {
  const groups = [];
  messages.forEach((m) => {
    const ts = m.createdAt ?? m.timestamp ?? Date.now();
    const label = dateLabelFor(ts);
    const last = groups[groups.length - 1];
    if (!last || last.label !== label) {
      groups.push({ label, items: [m] });
    } else {
      last.items.push(m);
    }
  });
  return groups;
};

const MessagesPage = () => {
  const location = useLocation();
  const { user } = useAuth();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));

  const [conversations, setConversations] = useState([]);
  const [activeConv, setActiveConv] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [profileMap, setProfileMap] = useState({});
  const [status, setStatus] = useState(null);
  const messagesEndRef = useRef(null);

  // Hide footer on mount, show on unmount
  useEffect(() => {
    const footer = document.querySelector("footer");
    if (footer) footer.style.display = "none";
    return () => {
      if (footer) footer.style.display = "block";
    };
  }, []);

  // auto-scroll on messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Listen for conversations
  useEffect(() => {
    if (!user?.uid) {
      // fallback sample or empty
      setConversations([]);
      return;
    }

    let unsub;
    try {
      unsub = listenForConversations(user.uid, (list) => {
        const arr = Array.isArray(list) ? list : [];
        // normalize items: ensure id and participants exist
        const normalized = arr.map((c) => ({
          id: c.id || c.conversationId || JSON.stringify(c),
          participants: c.participants || c.users || [],
          lastMessage: (c.lastMessage && (c.lastMessage.text || c.lastMessage)) || "",
          raw: c,
        }));
        setConversations(normalized);

        // prefetch profiles for other participants so avatars show immediately
        normalized.forEach((c) => {
          const other = (c.participants || []).find((id) => id !== user.uid) || c.participants?.[0];
          if (other && !profileMap[other]) {
            getUserProfile(other)
              .then((p) => setProfileMap((m) => ({ ...m, [other]: p || { uid: other } })))
              .catch(() => { });
          }
        });
      });
    } catch (err) {
      console.error("listenForConversations threw:", err);
    }

    // handle url param open
    const params = new URLSearchParams(location.search);
    const targetUid = params.get("uid");
    if (targetUid && targetUid !== user.uid) {
      openConversationWith(targetUid).catch((e) => console.error(e));
    }

    return () => {
      if (typeof unsub === "function") unsub();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Listen for messages for active conversation (realtime)
  useEffect(() => {
    if (!activeConv?.id) {
      setMessages([]);
      return;
    }

    const convId = activeConv.id;
    let unsubMessages;
    try {
      unsubMessages = listenForMessagesRealtime(convId, (msg) => {
        if (!msg) return;
        // support createdAt or timestamp
        const normalizedMsg = {
          ...msg,
          createdAt: msg.createdAt ?? msg.timestamp ?? Date.now(),
        };

        setMessages((prev) => {
          const merged = [...prev, normalizedMsg];
          merged.sort((a, b) => (Number(a.createdAt || a.timestamp || 0) - Number(b.createdAt || b.timestamp || 0)));
          return merged;
        });

        // prefetch sender profile if missing
        if (normalizedMsg.senderId && !profileMap[normalizedMsg.senderId]) {
          getUserProfile(normalizedMsg.senderId)
            .then((p) => setProfileMap((m) => ({ ...m, [normalizedMsg.senderId]: p || { uid: normalizedMsg.senderId } })))
            .catch(() => { });
        }
      });
    } catch (err) {
      console.error("listenForMessagesRealtime threw:", err);
    }

    return () => {
      if (typeof unsubMessages === "function") unsubMessages();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeConv, profileMap]);

  // Fetch online status for active conversation's other participant
  useEffect(() => {
    if (!activeConv) return;
    const other = (activeConv.participants || []).find((id) => id !== user?.uid);
    if (!other) return;
    const statusRef = ref(realtimeDb, `status/${other}`);
    const off = onValue(statusRef, (snap) => {
      setStatus(snap.val());
    });
    return () => {
      try {
        if (typeof off === "function") off();
      } catch { }
    };
  }, [activeConv, user]);

  // open conversation with other uid (existing conv or create)
  const openConversationWith = async (otherUid) => {
    if (!user?.uid) return;
    try {
      const conv = await getOrCreateConversation(user.uid, otherUid);
      if (!conv) throw new Error("No conversation");
      // fetch other profile
      const prof = await getUserProfile(otherUid);
      setProfileMap((m) => ({ ...m, [otherUid]: prof || { uid: otherUid } }));
      // set active conv, attach otherUid for header convenience
      const enriched = {
        ...conv,
        otherUid,
      };
      setActiveConv(enriched);
      setMessages([]); // will be filled by realtime listener
    } catch (err) {
      console.error("openConversationWith failed:", err);
    }
  };

  // start with user from list
  const startWithUser = async (uid) => {
    await openConversationWith(uid);
  };

  // send message (writes to realtime via service)
  const handleSend = async () => {
    if (!text.trim()) return;
    if (!activeConv?.id) return;

    const payload = {
      senderId: user.uid,
      text: text.trim(),
      createdAt: Date.now(),
    };

    try {
      // optimistic UI
      setMessages((prev) => {
        const merged = [...prev, payload];
        merged.sort((a, b) => (Number(a.createdAt || a.timestamp || 0) - Number(b.createdAt || b.timestamp || 0)));
        return merged;
      });
      setText("");

      await sendMessageRealtime(activeConv.id, payload);
    } catch (err) {
      console.error("sendMessageRealtime error:", err);
    }
  };

  // Build grouped messages by date for rendering
  const grouped = useMemo(() => {
    const sorted = Array.isArray(messages)
      ? [...messages].sort((a, b) => (Number(a.createdAt || a.timestamp || 0) - Number(b.createdAt || b.timestamp || 0)))
      : [];
    return groupMessagesByDate(sorted);
  }, [messages]);

  // header info: other profile
  const otherUid = activeConv ? (activeConv.participants || []).find((id) => id !== user?.uid) : null;
  const otherProfile = otherUid ? profileMap[otherUid] : null;

  // UI mobile control: show list or chat
  const [mobileShowList, setMobileShowList] = useState(true);
  useEffect(() => {
    if (!isMobile) setMobileShowList(true);
  }, [isMobile]);
  useEffect(() => {
    if (isMobile && activeConv) setMobileShowList(false);
  }, [isMobile, activeConv]);

  // Updated text color to black for better readability
  const textStyle = {
    color: 'black',
  };

  return (
    <Container maxWidth={false} disableGutters sx={{ height: "100vh", display: "flex", flexDirection: "column", bgcolor: "#f0f2f5" }}>
      {/* Header */}
      <Box sx={{ display: "flex", alignItems: "center", gap: 2, px: 2, py: 2, borderBottom: "1px solid rgba(0,0,0,0.04)", bgcolor: "#fff" }}>
        <Typography variant="h6" sx={{ fontWeight: 700, color: "black" }}>Messages</Typography>
        {!isMobile && activeConv && (
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <Avatar src={otherProfile?.image || ""} sx={{ width: 36, height: 36 }} />
            <Box>
              <Typography sx={{ fontWeight: 600, fontSize: "0.95rem", color: "black" }}>
                {otherProfile?.name || otherUid || "Conversation"}
              </Typography>
              <Typography variant="caption" sx={{ color: "text.secondary" }}>
                {status?.online ? "Online" : (status?.lastSeen ? `Last seen ${new Date(status.lastSeen).toLocaleString()}` : "")}
              </Typography>
            </Box>
          </Box>
        )}
      </Box>

      <Grid container sx={{ flex: 1, minHeight: 0 }}>
        {/* Conversations List */}
        {(!isMobile || (isMobile && mobileShowList)) && (
          <Grid item xs={12} md={4} sx={{ borderRight: !isMobile ? "1px solid rgba(0,0,0,0.04)" : "none", height: "100%", overflowY: "auto", bgcolor: "#fff" }}>
            <Box sx={{ py: 1 }}>
              <List disablePadding>
                {conversations.map((c) => {
                  const other = (c.participants || []).find((id) => id !== user?.uid) || (c.participants || [])[0];
                  const prof = other ? profileMap[other] : null;
                  return (
                    <Box key={c.id}>
                      <ListItem button onClick={() => startWithUser(other)} sx={{ py: 1.25, px: 2 }}>
                        <ListItemAvatar>
                          <Avatar src={prof?.image || ""}>
                            {!prof?.image ? (prof?.name ? prof.name[0] : (other ? other[0] : "?")) : null}
                          </Avatar>
                        </ListItemAvatar>
                        <ListItemText
                          primary={prof?.name || other || "User"}
                          primaryTypographyProps={{ color: "black", fontWeight: 500 }}
                          secondary={c.lastMessage || ""}
                        />
                      </ListItem>
                      <Divider />
                    </Box>
                  );
                })}
                {conversations.length === 0 && (
                  <Box sx={{ p: 3, textAlign: "center", color: "text.secondary" }}>No conversations yet.</Box>
                )}
              </List>
            </Box>
          </Grid>
        )}

        {/* Chat Panel */}
        {(!isMobile || (isMobile && !mobileShowList)) && (
          <Grid item xs={12} md={8} sx={{ height: "100%", display: "flex", flexDirection: "column", minHeight: 0 }}>
            {/* Panel header for mobile (back + avatar + name) */}
            {isMobile && (
              <Box sx={{ display: "flex", alignItems: "center", gap: 1, px: 1, py: 1, borderBottom: "1px solid rgba(0,0,0,0.04)", bgcolor: "#fff" }}>
                <IconButton onClick={() => { setActiveConv(null); setMobileShowList(true); }}>
                  <ArrowBackIcon />
                </IconButton>
                <Avatar src={otherProfile?.image || ""} />
                <Box>
                  <Typography sx={{ fontWeight: 600, color: "black" }}>{otherProfile?.name || otherUid || "Conversation"}</Typography>
                  <Typography variant="caption" sx={{ color: "text.secondary" }}>
                    {status?.online ? "Online" : (status?.lastSeen ? `Last seen ${new Date(status.lastSeen).toLocaleString()}` : "")}
                  </Typography>
                </Box>
              </Box>
            )}

            {/* Messages area */}
            <Box sx={{ flex: 1, overflowY: "auto", px: 2, py: 2, minHeight: 0 }}>
              {!activeConv ? (
                <Box sx={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Typography variant="body1" sx={{ color: "text.secondary" }}>
                    Select a conversation to start chatting.
                  </Typography>
                </Box>
              ) : (
                <>
                  {grouped.map((g) => (
                    <Box key={g.label}>
                      {/* date separator above the group's messages */}
                      <Box sx={{ display: "flex", justifyContent: "center", my: 1 }}>
                        <Typography variant="caption" sx={{ background: "rgba(0,0,0,0.05)", color: "text.secondary", px: 2, py: 0.4, borderRadius: 20 }}>
                          {g.label}
                        </Typography>
                      </Box>

                      {g.items.map((m, i) => {
                        const isMe = m.senderId && user?.uid ? m.senderId === user.uid : false;
                        const senderProfile = m.senderId ? profileMap[m.senderId] : null;
                        return (
                          <Box key={(m.id || m.createdAt || i) + "-" + i} sx={{ display: "flex", alignItems: "flex-end", mb: 1.25 }}>
                            {/* avatar for incoming */}
                            <Box sx={{ width: 44, display: "flex", justifyContent: isMe ? "flex-end" : "flex-start", px: 1 }}>
                              {!isMe ? (
                                <Avatar src={(senderProfile && senderProfile.image) || otherProfile?.image || ""} sx={{ width: 36, height: 36 }} />
                              ) : <Box sx={{ width: 36 }} />}
                            </Box>

                            {/* bubble */}
                            <Box sx={{ flex: 1, display: "flex", justifyContent: isMe ? "flex-end" : "flex-start", px: 1 }}>
                              <Box
                                sx={{
                                  borderRadius: 20,
                                  px: 2,
                                  py: 1,
                                  maxWidth: "78%",
                                  background: isMe ? IG_GRADIENT : "#fff",
                                  color: isMe ? "#fff" : "#111",
                                  boxShadow: isMe ? "0 4px 12px rgba(74,0,224,0.2)" : "0 1px 2px rgba(0,0,0,0.1)",
                                  border: isMe ? "none" : "none",
                                }}
                              >
                                <Typography sx={{ whiteSpace: "pre-wrap" }}>{m.text}</Typography>
                                <Typography sx={{ fontSize: "0.7rem", color: isMe ? "rgba(255,255,255,0.8)" : "rgba(0,0,0,0.5)", mt: 0.5, textAlign: "right" }}>
                                  {formatTime(m.createdAt ?? m.timestamp)}
                                </Typography>
                              </Box>
                            </Box>

                            {/* spacer (balance) */}
                            <Box sx={{ width: 44 }} />
                          </Box>
                        );
                      })}
                    </Box>
                  ))}
                  <div ref={messagesEndRef} />
                </>
              )}
            </Box>

            {/* Input */}
            <Box sx={{ px: 2, py: 1, borderTop: "1px solid rgba(0,0,0,0.04)", display: "flex", gap: 1, alignItems: "center", bgcolor: "#fff" }}>
              <TextField
                fullWidth
                placeholder={activeConv ? `Message ${otherProfile?.name || ""}` : "Select a conversation"}
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleSend(); }}
                disabled={!activeConv}
                size="small"
                sx={{
                  "& .MuiOutlinedInput-root": {
                    borderRadius: 3,
                    bgcolor: "#f0f2f5",
                    "& fieldset": { border: "none" },
                  },
                  "& .MuiInputBase-input": { color: "#000" }
                }}
              />
              <IconButton color="primary" disabled={!activeConv || !text.trim()} onClick={handleSend}>
                <SendIcon />
              </IconButton>
            </Box>
          </Grid>
        )}
      </Grid>
    </Container>
  );
};

export default MessagesPage;