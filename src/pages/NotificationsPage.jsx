import React, { useEffect, useState } from 'react';
import { Box, Typography, List, Paper, Avatar, ListItem, ListItemAvatar, ListItemText, ListItemButton } from '@mui/material';
import { Favorite } from '@mui/icons-material';
import { useAuth } from '../context/AuthContext';
import { subscribeToLikedBy } from '../services/userService';
import { useNavigate } from 'react-router-dom';
import SEOHead from '../components/SEOHead.jsx';

const NotificationsPage = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [likeCount, setLikeCount] = useState(0);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let unsubscribe = () => { };

        if (user?.uid) {
            unsubscribe = subscribeToLikedBy(user.uid, (profiles) => {
                setLikeCount(profiles.length);
                setLoading(false);
            });
        } else {
            setLoading(false);
        }

        return () => {
            unsubscribe();
        };
    }, [user?.uid]);

    const handleLikeClick = () => {
        navigate('/likes', { state: { tab: 1 } });
    };

    return (
        <>
            <SEOHead
                title="Notifications | Bichat Dating"
                description="Your notifications"
                noindex={true}
            />
            <Box sx={{ p: { xs: 2, md: 4 }, bgcolor: 'background.default', minHeight: '80vh', maxWidth: 600, mx: 'auto' }}>
                <Typography variant="h5" sx={{ mb: 3, color: '#7a2fff', fontWeight: 700, textAlign: 'center', letterSpacing: 1 }}>
                    Notifications
                </Typography>

                {loading && <Typography sx={{ color: '#888', textAlign: 'center', my: 4 }}>Loading...</Typography>}

                {!loading && likeCount === 0 && (
                    <Typography sx={{ color: '#333', textAlign: 'center', mt: 6 }}>
                        No new notifications.
                    </Typography>
                )}

                <List sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 2 }}>
                    {!loading && likeCount > 0 && (
                        <Paper elevation={2} sx={{ borderRadius: 3, overflow: 'hidden' }}>
                            <ListItemButton onClick={handleLikeClick} sx={{ p: 2 }}>
                                <ListItemAvatar>
                                    <Avatar sx={{ bgcolor: '#ff4081' }}>
                                        <Favorite />
                                    </Avatar>
                                </ListItemAvatar>
                                <ListItemText
                                    primary={
                                        <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                                            {likeCount} people liked you
                                        </Typography>
                                    }
                                    secondary="Check who liked your profile!"
                                />
                            </ListItemButton>
                        </Paper>
                    )}
                </List>
            </Box>
        </>
    );
};

export default NotificationsPage;
