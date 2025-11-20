import React from 'react';
import { Box, Typography } from '@mui/material';

const ChatMessageBubble = ({ m, meId }) => {
  const isMine = m.senderId === meId;
  const messageDate = m.timestamp ? new Date(m.timestamp) : null;

  return (
    <Box sx={{ display: 'flex', justifyContent: isMine ? 'flex-end' : 'flex-start', mb: 1 }}>
      <Box sx={{
        maxWidth: '75%',
        p: 1.25,
        borderRadius: 2,
        background: isMine ? 'linear-gradient(135deg, #7a2fff 0%, #ff5fa2 100%)' : 'linear-gradient(135deg, #f0f0f0 0%, #e8e8e8 100%)',
        boxShadow: isMine ? '0 4px 12px rgba(122,47,255,0.18)' : '0 2px 6px rgba(0,0,0,0.06)',
        color: isMine ? 'white' : '#333'
      }}>
        <Typography sx={{ whiteSpace: 'pre-wrap', fontWeight: 500 }}>{m.text}</Typography>
        {messageDate && !isNaN(messageDate.getTime()) && (
          <Typography sx={{ fontSize: '0.75rem', color: isMine ? 'rgba(255,255,255,0.85)' : 'rgba(0,0,0,0.6)', mt: 0.5 }}>
            {messageDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </Typography>
        )}
      </Box>
    </Box>
  );
};

export default ChatMessageBubble;