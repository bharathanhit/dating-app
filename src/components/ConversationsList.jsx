import React from "react";
import {
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Avatar,
  Typography,
  Divider,
} from "@mui/material";

const ConversationsList = ({
  conversations,
  user,
  activeConv,
  onConversationClick,
  loading,
}) => {
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
        Conversationsssss
      </Typography>

      <Divider />

      <List>
        {conversations.map((c) => {
          const otherUid = c.participants?.find((id) => id !== user?.uid);

          // This MUST come from Firestore (fixed)
          const otherProfile = c?.profiles?.[otherUid] || null;

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
                <Avatar
                  src={
                    otherProfile?.image ||
                    otherProfile?.photoURL ||
                    ""
                  }
                />
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