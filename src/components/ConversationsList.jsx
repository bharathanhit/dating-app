import React, { useEffect, useState } from "react";
import {
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Avatar,
  Typography,
  Divider,
  Badge,
} from "@mui/material";
import { ref, onValue } from "firebase/database";
import { realtimeDb } from "../config/firebase";

const ConversationsList = ({
  conversations,
  user,
  activeConv,
  onConversationClick,
  loading,
}) => {
  const [onlineStatuses, setOnlineStatuses] = useState({});

  // Listen to online status for all conversation participants
  useEffect(() => {
    if (!conversations || conversations.length === 0) return;

    const unsubscribers = [];

    conversations.forEach((c) => {
      const otherUid = c.participants?.find((id) => id !== user?.uid);
      if (!otherUid) return;

      const statusRef = ref(realtimeDb, `status/${otherUid}`);
      const unsubscribe = onValue(statusRef, (snap) => {
        const status = snap.val();
        setOnlineStatuses((prev) => ({
          ...prev,
          [otherUid]: status?.online || false,
        }));
      });

      unsubscribers.push(unsubscribe);
    });

    return () => {
      unsubscribers.forEach((unsub) => unsub());
    };
  }, [conversations, user]);

  return (
    <>
      <Typography
        variant="subtitle1"
        sx={{
          px: 1,
          py: 0.5,
          background: "linear-gradient(90deg, #7a2fff 0%, #ff5fa2 100%)",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
          fontWeight: 600,
        }}
      >
        Conversations
      </Typography>

      <Divider />

      <List>
        {conversations.map((c) => {
          const otherUid = c.participants?.find((id) => id !== user?.uid);

          // This MUST come from Firestore (fixed)
          const otherProfile = c?.profiles?.[otherUid] || null;
          const isOnline = onlineStatuses[otherUid] || false;

          return (
            <ListItem
              key={c.id}
              button
              onClick={() => onConversationClick(c)}
              sx={{
                background:
                  activeConv?.id === c.id
                    ? "rgba(122,47,255,0.08)"
                    : "transparent",
                "&:hover": {
                  background: "rgba(122,47,255,0.06)",
                },
              }}
            >
              <ListItemAvatar>
                <Badge
                  overlap="circular"
                  anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
                  variant="dot"
                  sx={{
                    "& .MuiBadge-badge": {
                      backgroundColor: isOnline ? "#44b700" : "transparent",
                      color: isOnline ? "#44b700" : "transparent",
                      boxShadow: `0 0 0 2px ${isOnline ? "#fff" : "transparent"}`,
                      width: 12,
                      height: 12,
                      borderRadius: "50%",
                      "&::after": isOnline
                        ? {
                          position: "absolute",
                          top: 0,
                          left: 0,
                          width: "100%",
                          height: "100%",
                          borderRadius: "50%",
                          animation: "ripple 1.2s infinite ease-in-out",
                          border: "1px solid currentColor",
                          content: '""',
                        }
                        : {},
                    },
                    "@keyframes ripple": {
                      "0%": {
                        transform: "scale(.8)",
                        opacity: 1,
                      },
                      "100%": {
                        transform: "scale(2.4)",
                        opacity: 0,
                      },
                    },
                  }}
                >
                  <Avatar
                    src={
                      otherProfile?.image ||
                      otherProfile?.photoURL ||
                      ""
                    }
                  />
                </Badge>
              </ListItemAvatar>

              <ListItemText
                primary={
                  otherProfile?.name ||
                  otherProfile?.displayName ||
                  "Unknown User"
                }
                secondary={c.lastMessage?.text || "No messages yet"}
              />
            </ListItem>
          );
        })}

        {conversations.length === 0 && (
          <ListItem>
            <ListItemText
              primary={
                loading
                  ? "Loading conversations..."
                  : "No conversations yet. Like someone to start!"
              }
            />
          </ListItem>
        )}
      </List>
    </>
  );
};

export default ConversationsList;