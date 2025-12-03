import React, { useEffect, useState } from 'react';
import { Box, Typography, List, Paper, Avatar, IconButton, Button } from '@mui/material';
import { ChatBubble, Favorite } from '@mui/icons-material';
import { useAuth } from '../context/AuthContext';
import { getLikedByProfiles, addLikedProfile } from '../services/userService';
import { useNavigate } from 'react-router-dom';

const WhoLikedMePage = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [likedBy, setLikedBy] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const fetchLikedBy = async () => {
        if (!user || !user.uid) return;
        setLoading(true);
        setError('');
        try {
            const data = await getLikedByProfiles(user.uid);
            setLikedBy(data);
        } catch (err) {
            setError('Failed to load profiles');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchLikedBy();
        // eslint-disable-next-line
    }, [user?.uid]);

    const handleLikeBack = async (profile) => {
        try {
            if (!user || !user.uid) return;
            await addLikedProfile(user.uid, profile);
            // Optionally show success or change UI state
            alert(`You liked ${profile.name} back! It's a match!`);
        } catch (err) {
            console.error('Failed to like back', err);
        }
    };

    return (
        <Box sx={{ p: { xs: 2, md: 4 }, bgcolor: 'background.default', minHeight: '80vh', maxWidth: 600, mx: 'auto' }}>
            <Typography variant="h5" sx={{ mb: 3, color: '#754bffff', fontWeight: 700, textAlign: 'center', letterSpacing: 1 }}>
                Who Liked Me
            </Typography>

            {loading && <Typography sx={{ color: '#888', textAlign: 'center', my: 4 }}>Loading...</Typography>}
            {error && <Typography sx={{ color: 'red', textAlign: 'center', my: 2 }}>{error}</Typography>}

            {!loading && likedBy.length === 0 && (
                <Typography sx={{ color: '#333', textAlign: 'center', mt: 6 }}>
                    No one has liked you yet. Keep your profile updated!
                </Typography>
            )}

            <List sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 2 }}>
                {likedBy.map((p) => (
                    <Paper key={p.uid} elevation={3} sx={{ borderRadius: 3, p: 2, display: 'flex', alignItems: 'center', gap: 2, transition: 'box-shadow 0.2s', '&:hover': { boxShadow: 6 } }}>
                        <Avatar src={p.image || ''} sx={{ width: 64, height: 64, border: '2px solid #754bffff' }} />

                        <Box sx={{ flex: 1, minWidth: 0, cursor: 'pointer' }} onClick={() => navigate(`/profile/${p.uid}`)}>
                            <Typography variant="subtitle1" sx={{ color: '#222', fontWeight: 700, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                                {p.name || 'Unknown'}
                            </Typography>
                            <Typography variant="body2" sx={{ color: '#666' }}>
                                {p.age ? `${p.age} • ` : ''}{p.location || 'No location'}
                            </Typography>
                        </Box>

                        <IconButton
                            edge="end"
                            onClick={() => navigate('/messagesv2', { state: { recipientId: p.uid, recipientName: p.name } })}
                            aria-label={`message ${p.name}`}
                            size="medium"
                            sx={{ bgcolor: '#f0f0f0', '&:hover': { bgcolor: '#e0e0e0' } }}
                        >
                            <ChatBubble sx={{ color: '#754bffff' }} />
                        </IconButton>

                        <Button
                            variant="contained"
                            size="small"
                            startIcon={<Favorite />}
                            onClick={() => handleLikeBack(p)}
                            sx={{
                                bgcolor: '#ff4081',
                                color: 'white',
                                textTransform: 'none',
                                borderRadius: 20,
                                '&:hover': { bgcolor: '#f50057' }
                            }}
                        >
                            Like Back
                        </Button>
                    </Paper>
                ))}
            </List>
        </Box>
    );
};

export default WhoLikedMePage;
