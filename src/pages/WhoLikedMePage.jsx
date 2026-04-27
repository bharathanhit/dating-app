import React, { useEffect, useState } from 'react';
import { Box, Typography, List, Paper, Avatar, IconButton, Button } from '@mui/material';
import { ChatBubble, Favorite } from '@mui/icons-material';
import { useAuth } from '../context/AuthContext';
import { getLikedByProfiles, addLikedProfile, hasEverLikedProfile } from '../services/userService';
import { getUserCoins, deductCoins, unlockLikesFeature } from '../services/coinService';
import { useNavigate } from 'react-router-dom';

const WhoLikedMePage = () => {
    const { user, profile, refreshProfile } = useAuth();
    const navigate = useNavigate();
    const [likedBy, setLikedBy] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isUnlocked, setIsUnlocked] = useState(false);
    const [error, setError] = useState('');

    // Check unlock status
    useEffect(() => {
        if (profile?.likesUnlockExpiresAt) {
            const expiresAt = new Date(profile.likesUnlockExpiresAt);
            if (expiresAt > new Date()) {
                setIsUnlocked(true);
            } else {
                setIsUnlocked(false);
            }
        } else {
            setIsUnlocked(false);
        }
    }, [profile]);

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

    const handleUnlock = async () => {
        if (!user?.uid) return;

        if (window.confirm('Unlock "Who Liked Me" for 10 coins? Access lasts for 1 week.')) {
            setLoading(true);
            try {
                // Check coins first
                const currentCoins = await getUserCoins(user.uid);
                if (currentCoins < 10) {
                    alert('Insufficient coins! Please purchase more to unlock this feature.');
                    navigate('/coins');
                    return;
                }

                const result = await unlockLikesFeature(user.uid);
                if (result.success) {
                    await refreshProfile();
                    await fetchLikedBy();
                } else {
                    alert('Failed to unlock: ' + (result.error || 'Unknown error'));
                }
            } catch (err) {
                console.error('Error unlocking:', err);
                alert('Error processing unlock');
            } finally {
                setLoading(false);
            }
        }
    };

    const handleLikeBack = async (targetProfile) => {
        try {
            const likedUid = targetProfile.uid;
            if (!user || !user.uid) return;

            const LIKE_COST = 1;
            const hasLikedBefore = await hasEverLikedProfile(user.uid, likedUid);

            if (!hasLikedBefore) {
                const currentCoins = await getUserCoins(user.uid);
                if (currentCoins < LIKE_COST) {
                    alert('Insufficient coins! Please purchase more to like profiles.');
                    navigate('/coins');
                    return;
                }
                await deductCoins(user.uid, LIKE_COST, 'like');
            }

            await addLikedProfile(user.uid, targetProfile);
            alert(`You liked ${targetProfile.name} back! It's a match!`);
            fetchLikedBy(); // Refresh list
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

            {/* LOCKED STATE */}
            {!isUnlocked && !loading && (
                <Box sx={{ textAlign: 'center', py: 4, px: 2 }}>
                    <Box sx={{ position: 'relative', display: 'inline-block', mb: 2 }}>
                        <Favorite sx={{ fontSize: 80, color: '#ff4081', opacity: 0.2 }} />
                        <Typography sx={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', fontWeight: 800, fontSize: '1.5rem', color: '#754bffff' }}>
                            ?
                        </Typography>
                    </Box>
                    <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>Who Liked You?</Typography>
                    <Typography variant="body2" sx={{ color: 'text.secondary', mb: 3 }}>
                        See the people who liked your profile. Unlock to see their photos and start chatting!
                    </Typography>

                    {likedBy.length > 0 && (
                        <Typography sx={{ mb: 3, fontWeight: 500, color: '#754bffff' }}>
                            {likedBy.length} people liked you recently!
                        </Typography>
                    )}

                    <Button
                        variant="contained"
                        onClick={handleUnlock}
                        sx={{
                            bgcolor: '#754bffff',
                            borderRadius: 20,
                            px: 4,
                            py: 1.5,
                            fontSize: '1rem',
                            boxShadow: '0 4px 15px rgba(117, 75, 255, 0.4)',
                            '&:hover': { bgcolor: '#6438e6' }
                        }}
                    >
                        Unlock for 10 Coins (₹10 / 1 Week)
                    </Button>

                    {/* Blurry preview */}
                    <List sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 4, opacity: 0.5, pointerEvents: 'none', filter: 'blur(8px)' }}>
                        {[1, 2, 3].map((i) => (
                            <Paper key={i} elevation={1} sx={{ borderRadius: 3, p: 2, display: 'flex', alignItems: 'center', gap: 2 }}>
                                <Avatar sx={{ width: 64, height: 64 }} />
                                <Box sx={{ flex: 1 }}>
                                    <Typography variant="subtitle1" sx={{ bgcolor: '#ddd', width: '50%', height: 20, borderRadius: 1 }} />
                                    <Typography variant="body2" sx={{ bgcolor: '#eee', width: '30%', height: 15, mt: 1, borderRadius: 1 }} />
                                </Box>
                            </Paper>
                        ))}
                    </List>
                </Box>
            )}

            {/* UNLOCKED STATE */}
            {isUnlocked && !loading && (
                <Box>
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
                                        {p.age ? `${p.age} • ` : ''}{p.district || p.location || 'No location'}{p.state ? `, ${p.state}` : ''}
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
            )}
        </Box>
    );
};

export default WhoLikedMePage;
