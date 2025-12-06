import React, { useEffect, useState, useRef } from 'react';
import { Snackbar, Slide, Box, Typography, Avatar, IconButton } from '@mui/material';
import { Close } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { subscribeToLikedBy } from '../services/userService';

const TransitionUp = (props) => {
    return <Slide {...props} direction="down" />;
};

const LikeNotification = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [open, setOpen] = useState(false);
    const [notification, setNotification] = useState(null); // { name, image, uid }

    // Keep track of known liked IDs to detect *new* ones
    const knownLikesRef = useRef(new Set());
    const isFirstLoadRef = useRef(true);

    useEffect(() => {
        if (!user?.uid) return;

        const unsubscribe = subscribeToLikedBy(user.uid, (profiles) => {
            // If profiles is empty, just reset
            if (profiles.length === 0) {
                knownLikesRef.current = new Set();
                return;
            }

            // Collect current IDs
            const currentIds = new Set(profiles.map(p => p.uid));

            // On first load, just populate the ref so we don't notify for existing likes
            if (isFirstLoadRef.current) {
                knownLikesRef.current = currentIds;
                isFirstLoadRef.current = false;
                return;
            }

            // Find new likes (present in currentIds but NOT in knownLikesRef)
            const newLikes = profiles.filter(p => !knownLikesRef.current.has(p.uid));

            if (newLikes.length > 0) {
                // Show notification for the most recent new like
                // (If multiple come in at once, we just show the last one effectively, or queue them in a real app)
                // Sort by likedAt if available, otherwise just take the last one from the incoming list
                const latestInfo = newLikes[newLikes.length - 1];

                setNotification({
                    name: latestInfo.name || 'Someone',
                    image: latestInfo.image,
                    uid: latestInfo.uid
                });
                setOpen(true);
            }

            // Update known likes
            knownLikesRef.current = currentIds;
        });

        return () => unsubscribe();
    }, [user?.uid]);

    const handleClose = (event, reason) => {
        if (reason === 'clickaway') {
            return;
        }
        setOpen(false);
    };

    const handleClick = () => {
        setOpen(false);
        navigate('/likes'); // Optionally pass state to switch tab if possible
    };

    if (!notification) return null;

    return (
        <Snackbar
            open={open}
            autoHideDuration={4000}
            onClose={handleClose}
            TransitionComponent={TransitionUp}
            anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
            sx={{ top: { xs: 20, sm: 24 } }}
        >
            <Box
                onClick={handleClick}
                sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 2,
                    bgcolor: 'rgba(255, 255, 255, 0.95)',
                    backdropFilter: 'blur(10px)',
                    color: '#000',
                    py: 1.5,
                    px: 2,
                    borderRadius: 4,
                    boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
                    border: '1px solid rgba(0,0,0,0.05)',
                    cursor: 'pointer',
                    maxWidth: '90vw',
                    width: 'auto',
                    minWidth: 280
                }}
            >
                <Avatar
                    src={notification.image}
                    sx={{ width: 40, height: 40, border: '2px solid #7a2fff' }}
                />
                <Box sx={{ flex: 1 }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 700, lineHeight: 1.2 }}>
                        {notification.name}
                    </Typography>
                    <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: '0.8rem' }}>
                        liked your profile!
                    </Typography>
                </Box>
                <IconButton size="small" onClick={(e) => { e.stopPropagation(); handleClose(); }}>
                    <Close fontSize="small" />
                </IconButton>
            </Box>
        </Snackbar>
    );
};

export default LikeNotification;
