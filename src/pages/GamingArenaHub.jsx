import React from 'react';
import { Box, Typography, Container, Button, Stack, Paper } from '@mui/material';
import { SportsEsports, Gamepad, EmojiEvents, Bolt, Stars, RocketLaunch, VideogameAsset, Extension, Casino } from '@mui/icons-material';
import { motion, AnimatePresence } from 'framer-motion';
import SEOHead from '../components/SEOHead';
import { useNavigate } from 'react-router-dom';

const GamingArenaHub = () => {
    const navigate = useNavigate();

    const floatingIcons = [
        { Icon: SportsEsports, color: '#ff00ff', size: 40, x: '10%', y: '20%', duration: 4 },
        { Icon: Gamepad, color: '#00ffff', size: 30, x: '80%', y: '15%', duration: 5 },
        { Icon: RocketLaunch, color: '#7a2fff', size: 35, x: '15%', y: '70%', duration: 6 },
        { Icon: VideogameAsset, color: '#ffbd03', size: 45, x: '75%', y: '80%', duration: 7 },
        { Icon: Extension, color: '#39ff14', size: 25, x: '40%', y: '10%', duration: 5.5 },
        { Icon: Casino, color: '#ff4444', size: 30, x: '60%', y: '85%', duration: 6.5 },
        { Icon: Stars, color: '#ffffff', size: 20, x: '25%', y: '30%', duration: 4.5 },
    ];

    const triggeringTexts = [
        "Play with Friends",
        "Win Epic Rewards",
        "Global Leaderboards",
        "Instant Fun",
        "Next-Gen Socializing"
    ];

    return (
        <Box sx={{ 
            minHeight: '100vh', 
            bgcolor: '#0f0c29',
            backgroundImage: 'linear-gradient(to bottom, #0f0c29, #302b63, #24243e)',
            color: '#fff',
            position: 'relative',
            overflow: 'hidden',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            py: 4
        }}>
            <SEOHead 
                title="Gaming Hub | BiChat" 
                description="The ultimate social gaming destination. Play, compete, and win with BiChat."
            />

            {/* Premium Floating Elements */}
            <Box sx={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, pointerEvents: 'none' }}>
                {floatingIcons.map((item, i) => (
                    <motion.div
                        key={i}
                        style={{
                            position: 'absolute',
                            left: item.x,
                            top: item.y,
                            zIndex: 1,
                            opacity: 0.4
                        }}
                        animate={{
                            y: [0, -30, 0],
                            rotate: [0, 15, -15, 0],
                            scale: [1, 1.1, 1],
                        }}
                        transition={{
                            duration: item.duration,
                            repeat: Infinity,
                            ease: "easeInOut",
                        }}
                    >
                        <item.Icon sx={{ fontSize: item.size, color: item.color, filter: `drop-shadow(0 0 10px ${item.color})` }} />
                    </motion.div>
                ))}

                {/* Glassmorphic Background Blobs */}
                <Box sx={{ 
                    position: 'absolute', 
                    top: '20%', 
                    left: '10%', 
                    width: 300, 
                    height: 300, 
                    bgcolor: 'rgba(122, 47, 255, 0.3)', 
                    borderRadius: '50%', 
                    filter: 'blur(100px)',
                    animation: 'float-blob 10s infinite alternate'
                }} />
                <Box sx={{ 
                    position: 'absolute', 
                    bottom: '20%', 
                    right: '10%', 
                    width: 350, 
                    height: 350, 
                    bgcolor: 'rgba(0, 255, 255, 0.2)', 
                    borderRadius: '50%', 
                    filter: 'blur(120px)',
                    animation: 'float-blob 12s infinite alternate-reverse'
                }} />
            </Box>

            <Container maxWidth="md" sx={{ position: 'relative', zIndex: 10, textAlign: 'center' }}>
                <motion.div
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ duration: 0.8, type: 'spring' }}
                >
                    <Box sx={{ position: 'relative', display: 'inline-block', mb: 6 }}>
                        <motion.div
                            animate={{ 
                                rotate: [0, 360],
                                scale: [1, 1.05, 1]
                            }}
                            transition={{ 
                                rotate: { duration: 15, repeat: Infinity, ease: "linear" },
                                scale: { duration: 3, repeat: Infinity, ease: "easeInOut" }
                            }}
                        >
                            <Box sx={{ 
                                p: 4, 
                                borderRadius: '40%', 
                                background: 'linear-gradient(135deg, #7a2fff, #ff00ff, #00ffff)',
                                boxShadow: '0 0 50px rgba(122, 47, 255, 0.5)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                            }}>
                                <SportsEsports sx={{ fontSize: 90, color: 'white' }} />
                            </Box>
                        </motion.div>
                        <motion.div
                            animate={{ scale: [1, 1.2, 1] }}
                            transition={{ duration: 2, repeat: Infinity }}
                            style={{ position: 'absolute', top: -15, right: -15 }}
                        >
                            <Box sx={{ 
                                bgcolor: '#39ff14', 
                                p: 1.5, 
                                borderRadius: '50%',
                                boxShadow: '0 0 20px #39ff14',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                            }}>
                                <Bolt sx={{ color: '#0f0c29', fontSize: 30 }} />
                            </Box>
                        </motion.div>
                    </Box>

                    <Typography variant="h1" sx={{ 
                        fontWeight: 900, 
                        fontSize: { xs: '2.8rem', sm: '4rem', md: '7rem' },
                        mb: 1,
                        background: 'linear-gradient(45deg, #ffffff 30%, #7a2fff, #00ffff)',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                        filter: 'drop-shadow(0 5px 15px rgba(0,0,0,0.5))',
                        letterSpacing: { xs: -1, md: -2 },
                        textTransform: 'uppercase'
                    }}>
                        Coming Soon
                    </Typography>

                    <Typography variant="h4" sx={{ 
                        fontWeight: 700, 
                        color: 'rgba(255,255,255,0.8)', 
                        mb: 6,
                        letterSpacing: 2,
                        textTransform: 'uppercase',
                        fontSize: { xs: '1rem', md: '1.8rem' }
                    }}>
                        Prepare for the Ultimate Experience
                    </Typography>

                    <Stack 
                        direction="row" 
                        spacing={2} 
                        flexWrap="wrap" 
                        justifyContent="center" 
                        sx={{ gap: 2, mb: 8 }}
                    >
                        {triggeringTexts.map((text, i) => (
                            <motion.div
                                key={i}
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: i * 0.1 }}
                                whileHover={{ y: -10, scale: 1.05 }}
                            >
                                <Paper elevation={0} sx={{ 
                                    px: 4, 
                                    py: 1.5, 
                                    borderRadius: 10,
                                    bgcolor: 'rgba(255, 255, 255, 0.05)',
                                    backdropFilter: 'blur(10px)',
                                    border: '1px solid rgba(255, 255, 255, 0.1)',
                                    color: '#fff',
                                    fontWeight: 700,
                                    fontSize: '0.9rem',
                                    cursor: 'default',
                                    transition: 'all 0.3s ease',
                                    '&:hover': {
                                        bgcolor: 'rgba(255, 255, 255, 0.15)',
                                        borderColor: '#00ffff',
                                        boxShadow: '0 0 20px rgba(0, 255, 255, 0.3)'
                                    }
                                }}>
                                    {text}
                                </Paper>
                            </motion.div>
                        ))}
                    </Stack>

                    <Box sx={{ mb: 8 }}>
                        <Button
                            variant="contained"
                            onClick={() => navigate('/')}
                            sx={{
                                background: 'linear-gradient(45deg, #7a2fff, #ff00ff)',
                                borderRadius: 12,
                                px: { xs: 4, sm: 6, md: 10 },
                                py: { xs: 1.5, sm: 2, md: 2.5 },
                                fontSize: { xs: '1rem', sm: '1.2rem', md: '1.4rem' },
                                fontWeight: 900,
                                boxShadow: '0 15px 40px rgba(122, 47, 255, 0.5)',
                                textTransform: 'uppercase',
                                letterSpacing: 1,
                                transition: 'all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
                                '&:hover': {
                                    transform: 'scale(1.05) translateY(-5px)',
                                    boxShadow: '0 20px 50px rgba(122, 47, 255, 0.7)',
                                    background: 'linear-gradient(45deg, #ff00ff, #7a2fff)',
                                }
                            }}
                        >
                            Return Home
                        </Button>
                    </Box>

                    <Stack direction="row" justifyContent="center" spacing={6}>
                        {[
                            { Icon: EmojiEvents, label: 'REWARDS', color: '#ffbd03' },
                            { Icon: Stars, label: 'LEVELS', color: '#7a2fff' },
                            { Icon: Casino, label: 'MYSTERY', color: '#00ffff' }
                        ].map((item, i) => (
                            <Box key={i} sx={{ textAlign: 'center' }}>
                                <motion.div
                                    animate={{ y: [0, -10, 0] }}
                                    transition={{ duration: 3, repeat: Infinity, delay: i * 0.5 }}
                                >
                                    <item.Icon sx={{ fontSize: 50, color: item.color, mb: 1, filter: `drop-shadow(0 0 10px ${item.color})` }} />
                                </motion.div>
                                <Typography variant="caption" sx={{ display: 'block', fontWeight: 900, letterSpacing: 1, color: 'rgba(255,255,255,0.6)' }}>
                                    {item.label}
                                </Typography>
                            </Box>
                        ))}
                    </Stack>
                </motion.div>
            </Container>

            <style>
                {`
                @keyframes float-blob {
                    0% { transform: translate(0, 0) scale(1); }
                    100% { transform: translate(50px, 50px) scale(1.1); }
                }
                `}
            </style>
        </Box>
    );
};

export default GamingArenaHub;
