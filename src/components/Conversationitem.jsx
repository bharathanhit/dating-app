import React, { useEffect, useState } from 'react';
import { ListItem, ListItemAvatar, Avatar, ListItemText } from '@mui/material';
import { motion, useMotionValue, useTransform } from 'framer-motion';
import { getUserProfile } from '../services/userService';

const ConversationItem = ({ conv, otherUid }) => {
  const [profile, setProfile] = useState(null);
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-200, 200], [-15, 15]);
  const opacity = useTransform(x, [-200, 0, 200], [0, 1, 0]);

  useEffect(() => {
    if (!otherUid) return;
    let active = true;
    getUserProfile(otherUid).then((p) => { if (active) setProfile(p); }).catch((e) => console.warn(e));
    return () => { active = false; };
  }, [otherUid]);

  return (
    <motion.div style={{ x, rotate, opacity }} drag="x" dragConstraints={{ left: 0, right: 0 }} whileTap={{ scale: 1.03 }}>
      <ListItem button sx={{ transition: 'all 0.15s ease', '&:hover': { background: 'rgba(122,47,255,0.04)' } }}>
        <ListItemAvatar>
          <Avatar src={profile?.image || ''} sx={{ border: '2px solid transparent' }} />
        </ListItemAvatar>
        <ListItemText primary={profile?.name || otherUid} secondary={conv?.lastMessage?.text || 'No messages yet'} />
      </ListItem>
    </motion.div>
  );
};

export default ConversationItem;