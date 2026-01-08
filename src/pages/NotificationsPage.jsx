import React, { useEffect, useState } from 'react';
import { Box, Typography, List, Paper, Avatar, ListItem, ListItemAvatar, ListItemText, ListItemButton, Alert, Chip, IconButton } from '@mui/material';
import { Favorite, Warning as WarningIcon, CheckCircle as CheckCircleIcon } from '@mui/icons-material';
import { useAuth } from '../context/AuthContext';
import { subscribeToLikedBy, getUserNotifications, markNotificationAsRead } from '../services/userService';
import { useNavigate } from 'react-router-dom';
import SEOHead from '../components/SEOHead.jsx';

const NotificationsPage = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [likeCount, setLikeCount] = useState(0);
    const [notifications, setNotifications] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let unsubscribe = () => { };

        if (user?.uid) {
            unsubscribe = subscribeToLikedBy(user.uid, (profiles) => {
                setLikeCount(profiles.length);
                setLoading(false);
            });

            // Fetch notifications
            getUserNotifications(user.uid).then(notifs => {
                setNotifications(notifs);
            }).catch(err => {
                console.error('Error fetching notifications:', err);
            });
        } else {
            setLoading(false);
        }

        return () => {
            unsubscribe();
        };
    }, [user?.uid]);

    const handleMarkAsRead = async (notificationId) => {
        try {
            await markNotificationAsRead(user.uid, notificationId);
            setNotifications(prev =>
                prev.map(notif =>
                    notif.id === notificationId ? { ...notif, read: true } : notif
                )
            );
        } catch (error) {
            console.error('Error marking notification as read:', error);
        }
    };

    const formatTimestamp = (timestamp) => {
        if (!timestamp) return '';
        const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        if (diffDays < 7) return `${diffDays}d ago`;
        return date.toLocaleDateString();
    };

    const handleLikeClick = () => {
        navigate('/likes', { state: { tab: 1 } });
    };

    return (
        <>
            <SEOHead
                title="Notifications | BiChat Dating"
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
                    {/* Report Warnings */}
                    {!loading && notifications.filter(n => n.type === 'report_warning').map((notification) => (
                        <Paper
                            key={notification.id}
                            elevation={notification.read ? 1 : 3}
                            sx={{
                                borderRadius: 3,
                                overflow: 'hidden',
                                bgcolor: notification.read ? '#fff' : '#fff8e1',
                                border: notification.read ? '1px solid rgba(0,0,0,0.1)' : '2px solid #ff5252',
                            }}
                        >
                            <ListItem sx={{ flexDirection: 'column', alignItems: 'flex-start', p: 2, gap: 1 }}>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%' }}>
                                    <WarningIcon sx={{ color: 'error.main' }} />
                                    <Typography variant="subtitle1" sx={{ fontWeight: 700, flex: 1, color: 'error.main' }}>
                                        {notification.title}
                                    </Typography>
                                    {!notification.read && (
                                        <Chip label="New" size="small" color="error" sx={{ height: 20 }} />
                                    )}
                                </Box>
                                <Alert severity="error" sx={{ width: '100%', mt: 1 }}>
                                    {notification.message}
                                </Alert>
                                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', mt: 1 }}>
                                    <Typography variant="caption" color="text.secondary">
                                        {formatTimestamp(notification.createdAt)}
                                    </Typography>
                                    {!notification.read && (
                                        <IconButton
                                            size="small"
                                            onClick={() => handleMarkAsRead(notification.id)}
                                            sx={{ color: 'success.main' }}
                                        >
                                            <CheckCircleIcon fontSize="small" />
                                        </IconButton>
                                    )}
                                </Box>
                            </ListItem>
                        </Paper>
                    ))}

                    {/* Likes Notification */}
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
