import React, { useEffect } from 'react';
import { Box, Typography, keyframes, styled } from '@mui/material';
import { CheckCircle } from '@mui/icons-material';

// Animations
const popIn = keyframes`
  0% { transform: scale(0); opacity: 0; }
  70% { transform: scale(1.2); opacity: 1; }
  100% { transform: scale(1); opacity: 1; }
`;

const shine = keyframes`
  0% { transform: translateX(-100%) rotate(45deg); }
  100% { transform: translateX(200%) rotate(45deg); }
`;

const float = keyframes`
  0% { transform: translateY(0px); }
  50% { transform: translateY(-10px); }
  100% { transform: translateY(0px); }
`;

const confetti = keyframes`
  0% { transform: translateY(0) rotate(0deg); opacity: 1; }
  100% { transform: translateY(100vh) rotate(720deg); opacity: 0; }
`;

// Styled Components
const Overlay = styled(Box)(({ theme }) => ({
    position: 'fixed',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999,
    backdropFilter: 'blur(8px)',
    animation: `${keyframes`0% {opacity: 0} 100% {opacity: 1}`} 0.3s ease-out`
}));

const CoinIcon = styled(Box)(({ theme }) => ({
    width: 120,
    height: 120,
    borderRadius: '50%',
    background: 'linear-gradient(135deg, #FFD700 0%, #FFA500 100%)',
    border: '4px solid #FFF',
    boxShadow: '0 0 50px #FFD700',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    fontSize: '60px',
    fontWeight: 'bold',
    color: '#FFF',
    marginBottom: theme.spacing(3),
    position: 'relative',
    overflow: 'hidden',
    animation: `${popIn} 0.6s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards, ${float} 3s ease-in-out infinite 0.6s`,
    '&::after': {
        content: '""',
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        background: 'rgba(255,255,255,0.4)',
        transform: 'translateX(-100%) rotate(45deg)',
        animation: `${shine} 3s infinite`
    }
}));

const SuccessText = styled(Typography)(({ theme }) => ({
    color: '#FFF',
    fontWeight: 800,
    textAlign: 'center',
    animation: `${popIn} 0.6s cubic-bezier(0.175, 0.885, 0.32, 1.275) 0.2s forwards`,
    opacity: 0,
    transform: 'scale(0)'
}));

// Generates random confetti particles
const ConfettiParticle = styled(Box)(({ color, left, delay, duration }) => ({
    position: 'fixed',
    top: '-20px',
    left: left, // string like "10%"
    width: '10px',
    height: '20px',
    backgroundColor: color,
    animation: `${confetti} ${duration}s linear ${delay}s forwards`,
}));

const SuccessAnimation = ({ amount, onClose }) => {
    // Auto close after few seconds
    useEffect(() => {
        const timer = setTimeout(() => {
            onClose();
        }, 3500);
        return () => clearTimeout(timer);
    }, [onClose]);

    // Generate some random confetti
    const particles = Array.from({ length: 30 }).map((_, i) => ({
        id: i,
        color: ['#FFD700', '#FF6347', '#4169E1', '#32CD32', '#FF69B4'][Math.floor(Math.random() * 5)],
        left: `${Math.random() * 100}%`,
        delay: Math.random() * 2,
        duration: 2 + Math.random() * 2
    }));

    return (
        <Overlay>
            {particles.map(p => (
                <ConfettiParticle
                    key={p.id}
                    color={p.color}
                    left={p.left}
                    delay={p.delay}
                    duration={p.duration}
                />
            ))}

            <CoinIcon>
                $
            </CoinIcon>

            <SuccessText variant="h3" sx={{ mb: 1, textShadow: '0 4px 20px rgba(0,0,0,0.5)' }}>
                PAYMENT SUCCESS!
            </SuccessText>

            <SuccessText variant="h4" sx={{ color: '#FFD700' }}>
                +{amount} Coins Added
            </SuccessText>

            <Box sx={{ mt: 4, display: 'flex', alignItems: 'center', gap: 1, opacity: 0.8 }}>
                <CheckCircle sx={{ color: '#4caf50' }} />
                <Typography variant="body1" sx={{ color: 'white' }}>Transaction Verified</Typography>
            </Box>
        </Overlay>
    );
};

export default SuccessAnimation;
