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
  Menu,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Button,
  Skeleton,
} from "@mui/material";
import SendIcon from "@mui/icons-material/Send";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import { useAuth } from "../context/AuthContext";
import { deductCoins } from '../services/coinService';
import { getOrCreateConversation, listenForConversations } from '../services/chatServiceV2';
import {
  listenForMessagesRealtime,
  sendMessageRealtime,
  markMessagesAsRead,
  setUserOnline,
  setUserOffline
} from "../services/chatRealtimeService";
import { getUserProfile, getBlockedUsers, blockUser, unblockUser, isUserBlocked, reportUser } from "../services/userService";
import { ref, onValue } from "firebase/database";
import { realtimeDb } from "../config/firebase";
import { getValidImageUrl } from "../utils/imageUtils";
import SEOHead from "../components/SEOHead.jsx";
import ReportDialog from "../components/ReportDialog";
import { Mic, Stop, Check, Block, PlayArrow, Pause, Cancel, DeleteOutline } from "@mui/icons-material";
import { convertBlobToBase64 } from "../services/storageService";
import { updateMessageAudioStatus, setAudioTrust, checkAudioTrust } from "../services/chatRealtimeService";

const IG_GRADIENT = "linear-gradient(135deg, #754bffff 0%, #7f0f98ff 100%)";

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

const MessagesPageV2 = () => {
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
  const [isRandomChat, setIsRandomChat] = useState(false);
  const [blockedUsers, setBlockedUsers] = useState([]);
  const [isOtherUserBlocked, setIsOtherUserBlocked] = useState(false);
  const [menuAnchor, setMenuAnchor] = useState(null);
  const [blockDialogOpen, setBlockDialogOpen] = useState(false);
  const [reportDialogOpen, setReportDialogOpen] = useState(false);



  // Audio Recording State
  const [isRecording, setIsRecording] = useState(0); // 0: idle, 1: recording, 2: review
  const [recordingDuration, setRecordingDuration] = useState(0);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const timerRef = useRef(null);

  // Audio Review State (Missing refs fixed here)
  const audioPlayerRef = useRef(new Audio());
  const [audioBlobToReview, setAudioBlobToReview] = useState(null);
  const [isPlayingReview, setIsPlayingReview] = useState(false);

  const messagesEndRef = useRef(null);

  // Hide footer when a conversation is active
  useEffect(() => {
    const footer = document.getElementById("app-footer");
    const appContainer = document.querySelector(".app");

    if (activeConv) {
      if (footer) footer.style.display = "none";
      if (appContainer) appContainer.style.paddingBottom = "0";
    } else {
      if (footer) footer.style.display = "flex";
      if (appContainer) appContainer.style.paddingBottom = ""; // Restore default from CSS
    }

    return () => {
      // Cleanup: ensure footer is visible when leaving the component
      if (footer) footer.style.display = "flex";
      if (appContainer) appContainer.style.paddingBottom = "";
    };
  }, [activeConv]);

  // Scroll to bottom of messages
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  // Set user online status
  useEffect(() => {
    if (user?.uid) {
      setUserOnline(user.uid);
      const handleOffline = () => setUserOffline(user.uid);
      window.addEventListener("beforeunload", handleOffline);
      return () => {
        setUserOffline(user.uid);
        window.removeEventListener("beforeunload", handleOffline);
      };
    }
  }, [user?.uid]);

  // Fetch blocked users
  useEffect(() => {
    if (!user?.uid) return;
    (async () => {
      try {
        const blocked = await getBlockedUsers(user.uid);
        setBlockedUsers(blocked);
      } catch (error) {
        console.error('Failed to fetch blocked users:', error);
      }
    })();
  }, [user?.uid]);

  // Listen for conversations
  useEffect(() => {
    if (!user?.uid) return;

    const unsubscribe = listenForConversations(user.uid, (convs) => {
      setConversations(convs);
      // Fetch profiles for all participants in all conversations
      const allParticipantIds = new Set();
      convs.forEach((conv) => {
        conv.participants.forEach((pId) => allParticipantIds.add(pId));
      });
      allParticipantIds.forEach(async (pId) => {
        if (!profileMap[pId]) {
          try {
            const profile = await getUserProfile(pId);
            if (profile) {
              setProfileMap((prev) => ({ ...prev, [pId]: profile }));
            } else {
              // Handle deleted/missing users so displayed skeleton stops
              setProfileMap((prev) => ({ ...prev, [pId]: { name: "User", image: null } }));
            }
          } catch (e) {
            console.warn("Failed to fetch profile for", pId, e);
            setProfileMap((prev) => ({ ...prev, [pId]: { name: "User", image: null } }));
          }
        }
      });
    });

    return () => unsubscribe();
  }, [user?.uid, profileMap]); // Added profileMap dependency to ensure we don't re-fetch knowns repeatedly, but need care. Actually removing profileMap from dep array is safer to avoid loops, but logic handles check. Ideally keep it simple.

  // Check if other user in active conversation is blocked
  useEffect(() => {
    if (!user?.uid || !activeConv) {
      setIsOtherUserBlocked(false);
      return;
    }
    const otherUid = activeConv.participants.find((id) => id !== user.uid);
    if (!otherUid) {
      setIsOtherUserBlocked(false);
      return;
    }
    (async () => {
      try {
        const blocked = await isUserBlocked(user.uid, otherUid);
        setIsOtherUserBlocked(blocked);
      } catch (error) {
        console.error('Failed to check if other user is blocked:', error);
      }
    })();
  }, [user?.uid, activeConv]);

  // Handle initial conversation from location state OR query param
  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const queryUid = searchParams.get("uid");
    const randomFlag = searchParams.get("random") === "true";
    setIsRandomChat(randomFlag);
    let recipientId = location.state?.recipientId || queryUid;

    // Validate recipientId
    if (recipientId === "undefined" || recipientId === "null") {
      recipientId = null;
    }

    console.log('[MessagesPageV2] Init check:', {
      queryUid,
      random: randomFlag,
      stateRecipient: location.state?.recipientId,
      finalRecipientId: recipientId,
      myUid: user?.uid
    });

    if (recipientId && user?.uid) {
      const findOrCreate = async () => {
        try {
          console.log('[MessagesPageV2] Calling getOrCreateConversation...');
          const conv = await getOrCreateConversation(user.uid, recipientId);
          console.log('[MessagesPageV2] Conversation result:', conv);
          setActiveConv(conv);

          // Pre-fetch recipient profile if not already in map
          if (!profileMap[recipientId]) {
            const profile = await getUserProfile(recipientId);
            if (profile) {
              setProfileMap((prev) => ({ ...prev, [recipientId]: profile }));
            } else {
              setProfileMap((prev) => ({ ...prev, [recipientId]: { name: "User", image: null } }));
            }
          }
        } catch (err) {
          console.error('[MessagesPageV2] Failed to get/create conversation:', err);
        }
      };
      findOrCreate();
    }
  }, [location.state?.recipientId, location.search, user?.uid, profileMap]);

  // Listen for messages in the active conversation
  useEffect(() => {
    if (!activeConv?.id) {
      setMessages([]);
      return;
    }

    const unsubscribe = listenForMessagesRealtime(activeConv.id, (newMessages) => {
      setMessages(newMessages);
      // Mark messages as read when they are loaded
      if (user?.uid) {
        // Filter for unread messages sent by the other user
        const unreadIds = newMessages
          .filter(m => !m.read && m.senderId !== user.uid)
          .map(m => m.id);

        if (unreadIds.length > 0) {
          markMessagesAsRead(activeConv.id, unreadIds, user.uid);
        }
      }
    });

    return () => unsubscribe();
  }, [activeConv?.id, user?.uid]);

  // Listen for other user's online status and last seen
  useEffect(() => {
    if (!activeConv || !user?.uid) {
      setStatus(null);
      return;
    }

    const otherUid = activeConv.participants.find((id) => id !== user.uid);
    if (!otherUid) {
      setStatus(null);
      return;
    }

    const statusRef = ref(realtimeDb, `status/${otherUid}`);
    const unsubscribe = onValue(statusRef, (snapshot) => {
      const data = snapshot.val();
      setStatus(data);
    });

    return () => unsubscribe();
  }, [activeConv, user?.uid]);

  const startWithUser = async (recipientId) => {
    if (!user?.uid) return;
    const conv = await getOrCreateConversation(user.uid, recipientId);
    setActiveConv(conv);
  };

  const handleSend = async () => {
    if (!text.trim() || !activeConv?.id || !user?.uid) return;

    const payload = {
      senderId: user.uid,
      text: text.trim(),
      createdAt: Date.now(),
    };

    try {
      // If not a random chat and it's the first message, deduct coins first
      if (!isRandomChat && messages.length === 0) {
        const deducted = await deductCoins(user.uid, 3, 'message');
        if (!deducted) {
          alert('Insufficient coins to start conversation');
          return;
        }
      }

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

  const handleMenuOpen = (event) => {
    setMenuAnchor(event.currentTarget);
  };

  const handleMenuClose = () => {
    setMenuAnchor(null);
  };

  // ==================== AUDIO RECORDING ====================

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      audioChunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorderRef.current.onstop = () => {
        // Stop all tracks to release microphone
        stream.getTracks().forEach(track => track.stop());

        // Process the audio blob immediately
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });

        // Only send if we have data (and duration > 0 check optionally)
        if (audioBlob.size > 0) {
          setAudioBlobToReview(audioBlob); // Store for review
          setIsRecording(2); // Set state to recorded
        } else {
          console.error("Audio blob was empty");
          alert("Recording failed: No audio data captured.");
          setIsRecording(0); // Reset to idle
        }
      };

      mediaRecorderRef.current.start();
      setIsRecording(1); // Set state to recording
      setRecordingDuration(0);

      timerRef.current = setInterval(() => {
        setRecordingDuration(prev => prev + 1);
      }, 1000);

    } catch (error) {
      console.error("Error starting recording:", error);
      alert("Could not access microphone. Please check permissions.");
      setIsRecording(0); // Reset to idle
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording === 1) {
      mediaRecorderRef.current.stop();
      clearInterval(timerRef.current);
      // Logic moved to onstop
    }
  };

  const cancelRecording = () => {
    if (mediaRecorderRef.current && (isRecording === 1 || isRecording === 2)) {
      // If recording, stop it and clear tracks
      if (mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.onstop = () => {
          if (mediaRecorderRef.current && mediaRecorderRef.current.stream) {
            mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
          }
        };
        mediaRecorderRef.current.stop();
      } else if (mediaRecorderRef.current.stream) {
        // If already stopped but stream is active (e.g., after onstop but before user cancels review)
        mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
      }

      clearInterval(timerRef.current);
      audioChunksRef.current = [];
      setAudioBlobToReview(null);
      setIsRecording(0); // Reset to idle
      setIsPlayingReview(false);
      if (audioPlayerRef.current) {
        audioPlayerRef.current.pause();
        audioPlayerRef.current.src = '';
      }
    }
  };

  const sendAudioMessage = async (audioBlob) => {
    if (!activeConv?.id || !user?.uid || !audioBlob) {
      console.error("Missing activeConv, user, or audioBlob", { activeConv, user, audioBlob });
      alert("Cannot send: Missing conversation, user details, or audio data.");
      return;
    }

    try {
      console.log("Starting audio conversion...");
      // 1. Convert to Base64
      const base64Audio = await convertBlobToBase64(audioBlob);
      console.log("Audio converted. Length:", base64Audio.length);

      // 2. Check if I am trusted (one-time acceptance)
      let initialStatus = 'pending';
      try {
        const isTrusted = await checkAudioTrust(activeConv.id, user.uid);
        if (isTrusted) {
          initialStatus = 'accepted';
          console.log("User is trusted for audio, sending as accepted.");
        }
      } catch (err) {
        console.warn("Error checking trust:", err);
      }

      // 3. Send message with type 'audio'
      const payload = {
        senderId: user.uid,
        text: "🎤 Audio Message", // Fallback text
        type: 'audio',
        audioUrl: base64Audio, // Storing Base64 direct string
        audioStatus: initialStatus, // pending | accepted | denied
        duration: recordingDuration,
        createdAt: Date.now(),
      };

      console.log("Sending payload:", payload);

      // Optimistic UI update
      setMessages((prev) => {
        const merged = [...prev, payload];
        merged.sort((a, b) => (Number(a.createdAt || a.timestamp || 0) - Number(b.createdAt || b.timestamp || 0)));
        return merged;
      });

      await sendMessageRealtime(activeConv.id, payload);
      console.log("Audio message sent successfully.");

      // Reset audio state after sending
      cancelRecording(); // This will clear blob, duration, and reset isRecording to 0

    } catch (error) {
      console.error("Error sending audio message:", error);
      alert(`Failed to send audio message: ${error.message}`);
    }
  };

  const handleSendAudio = () => {
    if (audioBlobToReview) {
      sendAudioMessage(audioBlobToReview);
    }
  };

  const toggleReviewPlayback = () => {
    if (audioPlayerRef.current) {
      if (isPlayingReview) {
        audioPlayerRef.current.pause();
      } else {
        audioPlayerRef.current.play();
      }
      setIsPlayingReview(!isPlayingReview);
    }
  };

  useEffect(() => {
    if (audioPlayerRef.current) {
      audioPlayerRef.current.onended = () => setIsPlayingReview(false);
      audioPlayerRef.current.onpause = () => setIsPlayingReview(false);
    }
  }, [audioPlayerRef.current]);

  const formatDuration = (sec) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const handleAudioAction = async (msgId, status) => {
    if (!activeConv?.id) return;
    try {
      await updateMessageAudioStatus(activeConv.id, msgId, status, user.uid);

      // If accepted, set trust for this sender
      if (status === 'accepted') {
        const msg = messages.find(m => m.id === msgId);
        if (msg && msg.senderId) {
          await setAudioTrust(activeConv.id, msg.senderId);
        }
      }
    } catch (error) {
      console.error("Error updating audio status:", error);
    }
  };

  const handleBlockClick = () => {
    handleMenuClose();
    setBlockDialogOpen(true);
  };

  const handleBlockConfirm = async () => {
    const otherUid = activeConv?.participants.find((id) => id !== user?.uid);
    if (!otherUid) return;

    try {
      if (isOtherUserBlocked) {
        await unblockUser(user.uid, otherUid);
        setIsOtherUserBlocked(false);
        // Refresh blocked users list
        const blocked = await getBlockedUsers(user.uid);
        setBlockedUsers(blocked);
        alert('User unblocked successfully');
      } else {
        await blockUser(user.uid, otherUid);
        setIsOtherUserBlocked(true);
        // Refresh blocked users list
        const blocked = await getBlockedUsers(user.uid);
        setBlockedUsers(blocked);
        alert('User blocked successfully. This conversation will be hidden.');
        // Close the conversation
        setActiveConv(null);
        setMobileShowList(true);
      }
      setBlockDialogOpen(false);
    } catch (error) {
      console.error('Error blocking/unblocking user:', error);
      alert(`Failed to ${isOtherUserBlocked ? 'unblock' : 'block'} user: ${error.message || 'Unknown error'}. Please try again.`);
    }
  };

  const handleReportClick = () => {
    handleMenuClose();
    setReportDialogOpen(true);
  };

  const handleReportSubmit = async (category, reason) => {
    const otherUid = activeConv?.participants.find((id) => id !== user?.uid);
    if (!otherUid) return;

    try {
      await reportUser(user.uid, otherUid, category, reason);
      alert('Report submitted successfully. Our team will review it.');
    } catch (error) {
      console.error('Error reporting user:', error);
      throw error;
    }
  };

  // Build grouped messages by date for rendering
  const grouped = useMemo(() => {
    const sorted = Array.isArray(messages)
      ? [...messages].sort((a, b) => (Number(a.createdAt || a.timestamp || 0) - Number(b.createdAt || b.timestamp || 0)))
      : [];
    return groupMessagesByDate(sorted);
  }, [messages]);

  // Filter conversations to exclude blocked users
  const filteredConversations = useMemo(() => {
    return conversations.filter((c) => {
      const other = (c.participants || []).find((id) => id !== user?.uid);
      return other && !blockedUsers.includes(other);
    });
  }, [conversations, blockedUsers, user?.uid]);

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

  return (
    <>
      <SEOHead
        title="Messages | Bichat Dating"
        description="Chat with your matches on Bichat"
        noindex={true}
      />
      <Container maxWidth={false} disableGutters sx={{ height: "100dvh", display: "flex", flexDirection: "column", bgcolor: "#f0f2f5" }}>
        {/* Header - Hide on mobile if in active conversation (chat view) */}
        {(!isMobile || !activeConv) && (
          <Box sx={{ display: "flex", alignItems: "center", gap: 2, px: 2, py: 2, borderBottom: "1px solid rgba(0,0,0,0.04)", bgcolor: "#fff" }}>
            <Typography variant="h6" sx={{ fontWeight: 700, color: "black" }}>Messages</Typography>
            {!isMobile && activeConv && (
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                {otherProfile ? (
                  <Avatar src={getValidImageUrl(otherProfile?.image)} sx={{ width: 36, height: 36 }} />
                ) : (
                  <Skeleton variant="circular" width={36} height={36} animation="wave" />
                )}
                <Box>
                  <Typography sx={{ fontWeight: 600, fontSize: "0.95rem", color: "black" }}>
                    {otherProfile?.name || (otherUid ? <Skeleton width={120} animation="wave" /> : "Conversation")}
                  </Typography>
                  <Typography variant="caption" sx={{ color: "text.secondary" }}>
                    {status?.online ? "Online" : (status?.lastSeen ? `Last seen ${new Date(status.lastSeen).toLocaleString()}` : "")}
                  </Typography>
                </Box>
                <IconButton onClick={handleMenuOpen} size="small" sx={{ ml: "auto" }}>
                  <MoreVertIcon />
                </IconButton>
              </Box>
            )}
          </Box>
        )}

        <Grid container sx={{ flex: 1, minHeight: 0 }}>
          {/* Conversations List */}
          {(!isMobile || (isMobile && mobileShowList)) && (
            <Grid item xs={12} md={3} sx={{
              borderRight: !isMobile ? "1px solid rgba(0,0,0,0.04)" : "none",
              height: "100%",
              overflowY: "auto",
              bgcolor: "#fff",
              // Custom Scrollbar
              '&::-webkit-scrollbar': { width: '5px' },
              '&::-webkit-scrollbar-track': { background: 'transparent' },
              '&::-webkit-scrollbar-thumb': { background: '#bdbdbd', borderRadius: '10px' },
              '&::-webkit-scrollbar-thumb:hover': { background: '#9e9e9e' },
            }}>
              <Box sx={{ py: 1 }}>
                <List disablePadding>
                  {filteredConversations.map((c) => {
                    const other = (c.participants || []).find((id) => id !== user?.uid) || (c.participants || [])[0];
                    const prof = other ? profileMap[other] : null;
                    return (
                      <Box key={c.id}>
                        <ListItem button onClick={() => startWithUser(other)} sx={{ py: 1.25, px: 2 }}>
                          <ListItemAvatar>
                            {prof ? (
                              <Avatar src={getValidImageUrl(prof?.image)}>
                                {!getValidImageUrl(prof?.image) ? (prof?.name ? prof.name[0] : (other ? other[0] : "?")) : null}
                              </Avatar>
                            ) : (
                              <Skeleton variant="circular" width={40} height={40} animation="wave" />
                            )}
                          </ListItemAvatar>
                          <ListItemText
                            primary={prof ? (prof.name) : <Skeleton width="70%" animation="wave" sx={{ my: 0.5 }} />}
                            primaryTypographyProps={{ color: "black", fontWeight: 500 }}
                            secondary={prof ? (c.lastMessage || "") : <Skeleton width="40%" animation="wave" />}
                          />
                        </ListItem>
                        <Divider />
                      </Box>
                    );
                  })}
                  {filteredConversations.length === 0 && (
                    <Box sx={{ p: 3, textAlign: "center", color: "text.secondary" }}>No conversations yet.</Box>
                  )}
                </List>
              </Box>
            </Grid>
          )}

          {/* Chat Panel */}
          {(!isMobile || (isMobile && !mobileShowList)) && (
            <Grid item xs={12} md={9} sx={{ height: "100%", display: "flex", flexDirection: "column", minHeight: 0 }}>
              {/* Panel header for mobile (back + avatar + name) */}
              {isMobile && (
                <Box sx={{ display: "flex", alignItems: "center", gap: 1, px: 1, py: 1, borderBottom: "1px solid rgba(0,0,0,0.04)", bgcolor: "#fff" }}>
                  <IconButton onClick={() => { setActiveConv(null); setMobileShowList(true); }}>
                    <ArrowBackIcon />
                  </IconButton>
                  {otherProfile ? (
                    <Avatar src={getValidImageUrl(otherProfile?.image)} />
                  ) : (
                    <Skeleton variant="circular" width={40} height={40} animation="wave" />
                  )}
                  <Box sx={{ flex: 1 }}>
                    <Typography sx={{ fontWeight: 600, color: "black" }}>
                      {otherProfile?.name || (otherUid ? <Skeleton width={140} animation="wave" /> : "Conversation")}
                    </Typography>
                    <Typography variant="caption" sx={{ color: "text.secondary" }}>
                      {status?.online ? "Online" : (status?.lastSeen ? `Last seen ${new Date(status.lastSeen).toLocaleString()}` : "")}
                    </Typography>
                  </Box>
                  <IconButton onClick={handleMenuOpen} size="small">
                    <MoreVertIcon />
                  </IconButton>
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
                                  <Avatar src={getValidImageUrl((senderProfile && senderProfile.image) || otherProfile?.image)} sx={{ width: 36, height: 36 }} />
                                ) : <Box sx={{ width: 36 }} />}
                              </Box>

                              {/* bubble */}
                              <Box sx={{ flex: 1, display: "flex", justifyContent: isMe ? "flex-end" : "flex-start", px: 1 }}>
                                <Box
                                  sx={{
                                    borderRadius: "18px",
                                    px: m.type === 'audio' ? 1 : 2,
                                    py: m.type === 'audio' ? 0.5 : 1,
                                    maxWidth: "85%",
                                    background: isMe ? IG_GRADIENT : "#fff",
                                    color: isMe ? "#fff" : "#111",
                                    boxShadow: isMe ? "0 4px 12px rgba(74,0,224,0.2)" : "0 1px 2px rgba(0,0,0,0.1)",
                                    border: isMe ? "none" : "none",
                                  }}
                                >
                                  {m.type === 'audio' ? (
                                    <Box sx={{ width: 200 }}>
                                      {/* Audio Logic */}
                                      {m.audioStatus === 'denied' ? (
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, opacity: 0.7 }}>
                                          <Block fontSize="small" />
                                          <Typography variant="body2" sx={{ fontStyle: 'italic' }}>
                                            Audio message denied
                                          </Typography>
                                        </Box>
                                      ) : (
                                        <>
                                          {/* Show Player if Accepted OR Sender */}
                                          {(m.audioStatus === 'accepted' || isMe) ? (
                                            <Box>
                                              {/* Waiting text removed as per request */}

                                              {/* Wrapper to target shadow DOM controls */}
                                              <Box sx={{
                                                '& audio': { width: '100%', height: 28 }, // Compact height
                                                '& audio::-webkit-media-controls-mute-button': { display: 'none !important' },
                                                '& audio::-webkit-media-controls-volume-slider': { display: 'none !important' },
                                                '& audio::-webkit-media-controls-volume-control-container': { display: 'none !important' },
                                              }}>
                                                <audio
                                                  controls
                                                  controlsList="nodownload noplaybackrate"
                                                  src={m.audioUrl}
                                                />
                                              </Box>

                                              {/* Show duration if available */}
                                              {m.duration > 0 && (
                                                <Typography variant="caption" sx={{ display: 'block', mt: 0, opacity: 0.8, textAlign: 'right', fontSize: '0.65rem' }}>
                                                  {formatDuration(m.duration)}
                                                </Typography>
                                              )}
                                            </Box>
                                          ) : (
                                            // Receiver View: Pending
                                            <Box>
                                              <Typography variant="body2" sx={{ mb: 1, fontWeight: 500 }}>
                                                🎤 Voice Message
                                              </Typography>
                                              <Box sx={{ display: 'flex', gap: 1 }}>
                                                <Button
                                                  variant="contained"
                                                  size="small"
                                                  color="success"
                                                  startIcon={<Check />}
                                                  onClick={() => handleAudioAction(m.id, 'accepted')}
                                                  sx={{ flex: 1, fontSize: '0.75rem' }}
                                                >
                                                  Accept
                                                </Button>
                                                <Button
                                                  variant="outlined"
                                                  size="small"
                                                  color="error"
                                                  startIcon={<Block />}
                                                  onClick={() => handleAudioAction(m.id, 'denied')}
                                                  sx={{ flex: 1, fontSize: '0.75rem' }}
                                                >
                                                  Deny
                                                </Button>
                                              </Box>
                                            </Box>
                                          )}
                                        </>
                                      )}
                                    </Box>
                                  ) : (
                                    <Typography sx={{ whiteSpace: "pre-wrap" }}>{m.text}</Typography>
                                  )}

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
              <Box sx={{
                px: 2,
                py: 1,
                borderTop: "1px solid rgba(0,0,0,0.04)",
                display: "flex",
                gap: 1,
                alignItems: "center",
                bgcolor: "#fff",
                flexShrink: 0, // Prevent collapsing
                zIndex: 10,    // Ensure on top
                position: "relative",
                minHeight: "60px"
              }}>
                {isRecording ? (
                  <Box sx={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "space-between", pl: 1 }}>
                    {/* Left: Delete / Cancel */}
                    <IconButton onClick={cancelRecording} sx={{ color: "text.secondary" }}>
                      <DeleteOutline />
                    </IconButton>

                    {/* Center: Timer & Indicator */}
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                      <Box
                        sx={{
                          width: 10,
                          height: 10,
                          borderRadius: "50%",
                          bgcolor: "error.main",
                          animation: "pulse 1.5s infinite"
                        }}
                      />
                      <Typography sx={{ fontWeight: 500, fontSize: "1.1rem", color: "text.primary", minWidth: 45 }}>
                        {formatDuration(recordingDuration)}
                      </Typography>
                    </Box>

                    {/* Right: Send */}
                    <IconButton color="primary" onClick={stopRecording} sx={{ bgcolor: "primary.main", color: "#fff", '&:hover': { bgcolor: "primary.dark" } }}>
                      <SendIcon />
                    </IconButton>
                  </Box>
                ) : (
                  <>
                    <IconButton
                      color="primary"
                      onClick={startRecording}
                      disabled={!activeConv}
                      sx={{
                        bgcolor: "rgba(117, 75, 255, 0.1)",
                        '&:hover': { bgcolor: "rgba(117, 75, 255, 0.2)" },
                        flexShrink: 0
                      }}
                    >
                      <Mic />
                    </IconButton>
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
                  </>
                )}
              </Box>
            </Grid>
          )}
        </Grid>

        {/* Menu */}
        <Menu
          anchorEl={menuAnchor}
          open={Boolean(menuAnchor)}
          onClose={handleMenuClose}
        >
          <MenuItem onClick={handleBlockClick}>
            {isOtherUserBlocked ? 'Unblock User' : 'Block User'}
          </MenuItem>
          <MenuItem onClick={handleReportClick}>Report User</MenuItem>
        </Menu>

        {/* Block Confirmation Dialog */}
        <Dialog open={blockDialogOpen} onClose={() => setBlockDialogOpen(false)}>
          <DialogTitle>{isOtherUserBlocked ? 'Unblock User' : 'Block User'}?</DialogTitle>
          <DialogContent>
            <DialogContentText>
              {isOtherUserBlocked
                ? `Are you sure you want to unblock ${otherProfile?.name || 'this user'}? You will be able to see their messages again.`
                : `Are you sure you want to block ${otherProfile?.name || 'this user'}? You won't receive messages from them and this conversation will be hidden.`}
            </DialogContentText>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setBlockDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleBlockConfirm} color="error" variant="contained">
              {isOtherUserBlocked ? 'Unblock' : 'Block'}
            </Button>
          </DialogActions>
        </Dialog>

        {/* Report Dialog */}
        <ReportDialog
          open={reportDialogOpen}
          onClose={() => setReportDialogOpen(false)}
          onSubmit={handleReportSubmit}
          reportedUserName={otherProfile?.name}
        />
      </Container>
    </>
  );
};

export default MessagesPageV2;