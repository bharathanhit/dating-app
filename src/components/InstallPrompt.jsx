import { useState, useEffect } from 'react';
import { Snackbar, Alert, Button, Box, Typography, Dialog, DialogTitle, DialogContent, DialogActions, List, ListItem, ListItemText } from '@mui/material';
import { GetApp, Close, Apple, Android } from '@mui/icons-material';

const InstallPrompt = () => {
    const [deferredPrompt, setDeferredPrompt] = useState(null);
    const [showInstallPrompt, setShowInstallPrompt] = useState(false);
    const [showInstructions, setShowInstructions] = useState(false);
    const [isIOS, setIsIOS] = useState(false);
    const [isAndroid, setIsAndroid] = useState(false);

    useEffect(() => {
        // Detect device type
        const userAgent = window.navigator.userAgent.toLowerCase();
        const isiOS = /iphone|ipad|ipod/.test(userAgent);
        const isAndroidDevice = /android/.test(userAgent);

        setIsIOS(isiOS);
        setIsAndroid(isAndroidDevice);

        // Check if app is already installed
        const isStandalone = window.matchMedia('(display-mode: standalone)').matches
            || window.navigator.standalone
            || document.referrer.includes('android-app://');

        if (isStandalone) {
            console.log('[InstallPrompt] App already installed, not showing prompt');
            return; // Don't show if already installed
        }

        // Check if user has permanently dismissed
        const hasPermanentlyDismissed = localStorage.getItem('installPromptPermanentlyDismissed');

        if (hasPermanentlyDismissed) {
            console.log('[InstallPrompt] User permanently dismissed, not showing prompt');
            return; // Don't show if permanently dismissed
        }

        // Listen for the beforeinstallprompt event (Chrome/Edge/Android)
        const handleBeforeInstallPrompt = (e) => {
            console.log('[InstallPrompt] beforeinstallprompt event fired - Chrome/Android detected');
            e.preventDefault();
            setDeferredPrompt(e);
            // Show prompt immediately when browser says it's ready
            setShowInstallPrompt(true);
        };

        window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

        // For iOS only - show after delay since it doesn't support beforeinstallprompt
        let showPromptTimer;
        if (isiOS) {
            showPromptTimer = setTimeout(() => {
                console.log('[InstallPrompt] iOS Timer fired - showing install notification');
                setShowInstallPrompt(true);
            }, 5000);
        }

        return () => {
            window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
            if (showPromptTimer) clearTimeout(showPromptTimer);
        };
    }, []); // Empty dependency array - only run once on mount

    const handleInstallClick = async () => {
        if (deferredPrompt) {
            // Chrome/Edge/Android - use native prompt IMMEDIATELY
            try {
                await deferredPrompt.prompt();
                const { outcome } = await deferredPrompt.userChoice;

                if (outcome === 'accepted') {
                    console.log('User accepted the install prompt');
                    setShowInstallPrompt(false);
                } else {
                    console.log('User dismissed the install prompt');
                }
                setDeferredPrompt(null);
            } catch (error) {
                console.error('Native install failed:', error);
                // Fallback to instructions if native fails
                setShowInstructions(true);
            }
        } else {
            // iOS or browsers without support - show manual instructions
            setShowInstructions(true);
        }
    };

    const handleDismiss = () => {
        setShowInstallPrompt(false);
        // Don't permanently dismiss - will show again on next visit
    };

    const handlePermanentDismiss = () => {
        setShowInstallPrompt(false);
        setShowInstructions(false);
        localStorage.setItem('installPromptPermanentlyDismissed', 'true');
    };

    const handleCloseInstructions = () => {
        setShowInstructions(false);
    };

    if (!showInstallPrompt) {
        return null;
    }

    return (
        <>
            {/* Main Install Prompt */}
            <Snackbar
                open={showInstallPrompt && !showInstructions}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
                sx={{
                    bottom: { xs: 80, sm: 24 },
                    maxWidth: '90%',
                    margin: '0 auto'
                }}
            >
                <Alert
                    severity="info"
                    sx={{
                        width: '100%',
                        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                        color: 'white',
                        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
                        '& .MuiAlert-icon': {
                            color: 'white'
                        }
                    }}
                    icon={<GetApp />}
                    action={
                        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                            <Button
                                size="small"
                                onClick={handleInstallClick}
                                sx={{
                                    color: 'white',
                                    background: 'rgba(255, 255, 255, 0.2)',
                                    fontWeight: 700,
                                    '&:hover': {
                                        background: 'rgba(255, 255, 255, 0.3)',
                                    }
                                }}
                            >
                                Install
                            </Button>
                            <Button
                                size="small"
                                onClick={handleDismiss}
                                sx={{
                                    color: 'rgba(255, 255, 255, 0.8)',
                                    minWidth: 'auto',
                                    padding: '4px'
                                }}
                            >
                                <Close fontSize="small" />
                            </Button>
                        </Box>
                    }
                >
                    <Box>
                        <Typography variant="body2" sx={{ fontWeight: 700, mb: 0.5 }}>
                            📱 Install BiChat App
                        </Typography>
                        <Typography variant="caption" sx={{ opacity: 0.9 }}>
                            Get the full app experience with faster loading!
                        </Typography>
                    </Box>
                </Alert>
            </Snackbar>

            {/* Installation Instructions Dialog */}
            <Dialog
                open={showInstructions}
                onClose={handleCloseInstructions}
                maxWidth="sm"
                fullWidth
            >
                <DialogTitle sx={{
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    color: 'white',
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1
                }}>
                    {isIOS ? <Apple /> : <Android />}
                    Install BiChat App
                </DialogTitle>
                <DialogContent sx={{ mt: 2 }}>
                    {isIOS ? (
                        <>
                            <Typography variant="body1" sx={{ mb: 2, fontWeight: 600 }}>
                                📱 Install on iPhone/iPad:
                            </Typography>
                            <List>
                                <ListItem>
                                    <ListItemText
                                        primary="1. Tap the Share button"
                                        secondary="(Square with arrow pointing up at bottom of Safari)"
                                    />
                                </ListItem>
                                <ListItem>
                                    <ListItemText
                                        primary="2. Scroll down and tap 'Add to Home Screen'"
                                        secondary="Look for the icon with a plus sign"
                                    />
                                </ListItem>
                                <ListItem>
                                    <ListItemText
                                        primary="3. Tap 'Add' in the top right"
                                        secondary="The app will appear on your home screen"
                                    />
                                </ListItem>
                            </List>
                        </>
                    ) : (
                        <>
                            <Typography variant="body1" sx={{ mb: 2, fontWeight: 600 }}>
                                📱 Install on Android/Chrome:
                            </Typography>
                            <List>
                                <ListItem>
                                    <ListItemText
                                        primary="1. Tap the menu (⋮) in the top right"
                                        secondary="Three dots in Chrome browser"
                                    />
                                </ListItem>
                                <ListItem>
                                    <ListItemText
                                        primary="2. Tap 'Install app' or 'Add to Home screen'"
                                        secondary="Option appears near the top of menu"
                                    />
                                </ListItem>
                                <ListItem>
                                    <ListItemText
                                        primary="3. Tap 'Install'"
                                        secondary="The app will be added to your device"
                                    />
                                </ListItem>
                            </List>
                        </>
                    )}
                    <Box sx={{
                        mt: 2,
                        p: 2,
                        background: 'rgba(103, 126, 234, 0.1)',
                        borderRadius: 2
                    }}>
                        <Typography variant="body2" sx={{ fontWeight: 600, mb: 1 }}>
                            ✨ Benefits of Installing:
                        </Typography>
                        <Typography variant="caption" component="div">
                            • Faster loading times<br />
                            • Works offline<br />
                            • Full-screen experience<br />
                            • Easy access from home screen
                        </Typography>
                    </Box>
                </DialogContent>
                <DialogActions sx={{ p: 2 }}>
                    <Button onClick={handlePermanentDismiss} sx={{ color: 'text.secondary' }}>
                        Don't Show Again
                    </Button>
                    <Button
                        onClick={handleCloseInstructions}
                        variant="contained"
                        sx={{
                            background: 'linear-gradient(135deg, #8b9ef4ff 0%, #8858b8ff 100%)',
                            '&:hover': {
                                background: 'linear-gradient(135deg, #909ff7ff 0%, #6a3f8f 100%)',
                            }
                        }}
                    >
                        Got It
                    </Button>
                </DialogActions>
            </Dialog>
        </>
    );
};

export default InstallPrompt;
