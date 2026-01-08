// Version: ManualCheck_Fix_v3
import { useState, useEffect } from 'react';
import { Container, Typography, Box, Card, CardContent, Button, Grid, Paper, Divider, CircularProgress, Alert, Snackbar, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Chip, useMediaQuery, useTheme } from '@mui/material';
import { MonetizationOn, CheckCircle, History, Stars } from '@mui/icons-material';
import { useAuth } from '../context/AuthContext';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../config/firebase';
import { getCoinTransactions } from '../services/coinService';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import SEOHead from '../components/SEOHead';
import SuccessAnimation from '../components/SuccessAnimation';

const CoinsPage = () => {
    const { user, coins } = useAuth();

    const navigate = useNavigate();
    const theme = useTheme();
    // const isMobile = useMediaQuery(theme.breakpoints.down('sm')); // Not needed for simplified flow
    const [transactions, setTransactions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

    // Payment verification dialog state - REMOVED MANUAL DIALOG
    const [verifying, setVerifying] = useState(false);
    const [showSuccess, setShowSuccess] = useState(false);
    const [creditedAmount, setCreditedAmount] = useState(0);
    const [showPop, setShowPop] = useState(false);

    // Coin packages
    const coinPackages = [
        {
            id: 1,
            name: '10 Coins',
            amount: 10,
            price: '₹10',
            popular: false,
            gradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            paymentLink: 'https://imjo.in/NbaCv6'
        },
        {
            id: 2,
            name: '25 Coins',
            amount: 25,
            price: '₹20',
            priceColor: '#FFD700',
            originalPrice: '₹30',
            discount: '33% OFF',
            popular: false,
            gradient: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
            paymentLink: 'https://imjo.in/p7dNcP'
        },
        {
            id: 3,
            name: '65 Coins',
            amount: 65,
            price: '₹50',
            originalPrice: '₹80',
            discount: '40% OFF',
            popular: true,
            gradient: 'linear-gradient(43deg, #4158D0 0%, #C850C0 46%, #FFCC70 100%)',
            paymentLink: 'https://imjo.in/EAhRc6'
        },
    ];

    useEffect(() => {
        if (!user) {
            navigate('/login');
            return;
        }

        const fetchTransactions = async () => {
            setLoading(true);
            try {
                const txns = await getCoinTransactions(user.uid, 20);
                setTransactions(txns);
            } catch (error) {
                console.error('Error fetching transactions:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchTransactions();

        // Check for Redirect Return (payment_id)
        const params = new URLSearchParams(window.location.search);
        const urlPaymentId = params.get('payment_id');
        const urlStatus = params.get('payment_status'); // Sometimes sent by gateway

        if (urlPaymentId) {
            handleAutoVerify(urlPaymentId);
        }

    }, [user, navigate]);

    // DEBUG: Log URL params on mount/update
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        console.log("CoinsPage URL Params:", Object.fromEntries(params.entries()));
    }, [window.location.search]);

    const handleManualCheck = () => {
        const params = new URLSearchParams(window.location.search);
        const urlPaymentId = params.get('payment_id');
        if (urlPaymentId) {
            handleAutoVerify(urlPaymentId);
        } else {
            setSnackbar({ open: true, message: 'No pending purchase found to claim. Please complete a payment first.', severity: 'warning' });
        }
    };


    const handleAutoVerify = async (paymentId) => {
        setVerifying(true);
        try {
            // Retrieve pending package from LocalStorage
            const storedPkg = localStorage.getItem('pendingCoinPurchase');
            let packageId = null;
            let packageName = 'Coins';
            let amount = 0;

            if (storedPkg) {
                const pkg = JSON.parse(storedPkg);
                packageId = pkg.id;
                packageName = pkg.name;
                amount = pkg.amount;
            }

            console.log('Verifying payment:', paymentId, 'for package:', packageId);

            const verifyPayment = httpsCallable(functions, 'verifyInstamojoPayment');

            const result = await verifyPayment({
                paymentId: paymentId,
                packageId: packageId
            });

            if (!result.data || !result.data.success) {
                throw new Error(result.data?.error || "Verification failed");
            }

            // If we reach here, verification was successful
            setCreditedAmount(amount || 0);
            setShowSuccess(true);
            setShowPop(true);
            setTimeout(() => setShowPop(false), 3000);

            setSnackbar({
                open: true,
                message: 'Payment Claimed Successfully!',
                severity: 'success'
            });

            // Cleanup
            localStorage.removeItem('pendingCoinPurchase');
            window.history.replaceState({}, document.title, window.location.pathname); // Clear URL params

            // Refresh transactions
            const txns = await getCoinTransactions(user.uid, 20);
            setTransactions(txns);

        } catch (error) {
            console.error('Auto verification failed:', error);
            let errorMessage = 'Payment verification failed. Please contact support if money was deducted.';

            if (error.code === 'functions/already-exists') {
                errorMessage = 'This payment has already been processed.';
            }

            setSnackbar({
                open: true,
                message: errorMessage,
                severity: 'error'
            });
        } finally {
            setVerifying(false);
        }
    };

    const handlePurchase = async (pkg) => {
        if (!user) return;

        try {
            setLoading(true);

            // 1. Save state to localStorage
            localStorage.setItem('pendingCoinPurchase', JSON.stringify({
                id: pkg.id,
                name: pkg.name,
                amount: pkg.amount,
                price: pkg.price,
                timestamp: Date.now()
            }));

            // 3. Call Firebase Cloud Function (Secure & Dedicated)
            const createPayment = httpsCallable(functions, 'createInstamojoPayment');

            const result = await createPayment({
                packageId: pkg.id
            });

            if (result.data && result.data.paymentUrl) {
                window.location.href = result.data.paymentUrl;
            } else {
                throw new Error(result.data?.error || "Failed to create payment link");
            }

        } catch (error) {
            console.error('Error initiating purchase:', error);
            setSnackbar({
                open: true,
                message: String(error.message || 'Failed to initiate purchase.'),
                severity: 'error'
            });
            setLoading(false);
        }
    };

    const formatDate = (dateValue) => {
        if (!dateValue) return 'N/A';

        let date;
        // Handle Firestore Timestamp objects
        if (dateValue && typeof dateValue.toDate === 'function') {
            date = dateValue.toDate();
        } else {
            date = new Date(dateValue);
        }

        if (isNaN(date.getTime())) return 'Invalid Date';

        return date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    const getTransactionColor = (type) => {
        return type === 'credit' ? 'success' : 'error';
    };

    const getTransactionIcon = (type) => {
        return type === 'credit' ? '+' : '-';
    };

    return (
        <>
            <SEOHead
                title="Buy Coins | BiChat"
                description="Purchase coins to like profiles and unlock premium features on BiChat."
                keywords="buy coins, purchase coins, dating app coins, BiChat coins"
                url="https://bi-chat.online/coins"
            />

            {/* Premium Fixed Background */}
            <Box
                sx={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    background: 'linear-gradient(135deg, #0f0c29 0%, #302b63 50%, #24243e 100%)',
                    zIndex: -1,
                }}
            />

            {/* DEBUG BANNER TO VERIFY VERSION */}


            <Box
                sx={{
                    minHeight: '100vh',
                    pb: { xs: 12, sm: 10 },
                    pt: 4,
                }}
            >
                <Container maxWidth="lg">
                    {/* Header Section */}
                    <Box sx={{ textAlign: 'center', mb: 6 }}>
                        <Button
                            variant="contained"
                            size="large"
                            onClick={handleManualCheck}
                            startIcon={<Stars />}
                            sx={{
                                mb: 3,
                                background: 'linear-gradient(45deg, #FFD700 30%, #FFA500 90%)',
                                color: '#000',
                                fontWeight: 800,
                                px: 4,
                                py: 1.5,
                                borderRadius: '50px',
                                boxShadow: '0 4px 15px rgba(255, 215, 0, 0.4)',
                                textTransform: 'uppercase',
                                letterSpacing: '1px',
                                '&:hover': {
                                    background: 'linear-gradient(45deg, #FFC800 30%, #FF9100 90%)',
                                    transform: 'scale(1.05)',
                                    boxShadow: '0 6px 20px rgba(255, 215, 0, 0.6)',
                                },
                                transition: 'all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
                            }}
                        >
                            Claim My Coins
                        </Button>
                        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 2, mb: 2 }}>
                            <MonetizationOn sx={{ fontSize: 48, color: '#FFD700' }} />
                            <Typography variant="h3" sx={{ fontWeight: 700, color: '#FFD700' }}>
                                Your Coins
                            </Typography>
                        </Box>

                        {/* Current Balance */}
                        <Paper
                            elevation={8}
                            sx={{
                                display: 'inline-block',
                                px: 6,
                                py: 3,
                                borderRadius: 4,
                                background: 'linear-gradient(135deg, #FFD700 0%, #FFA500 100%)',
                                boxShadow: '0 8px 32px rgba(255, 215, 0, 0.4)',
                            }}
                        >
                            <Typography variant="h2" sx={{ fontWeight: 800, color: '#000' }}>
                                {coins || 0}
                            </Typography>
                            <Typography variant="body1" sx={{ color: '#000', fontWeight: 600 }}>
                                Available Coins
                            </Typography>
                        </Paper>
                    </Box>

                    {/* Coin Packages */}
                    <Box sx={{ mb: 6 }}>
                        <Typography variant="h4" sx={{ mb: 3, fontWeight: 700, textAlign: 'center', color: 'black' }}>
                            Purchase Coins
                        </Typography>
                        <Grid container spacing={3} justifyContent="center">
                            {coinPackages.map((pkg) => (
                                <Grid item xs={12} sm={6} md={4} key={pkg.id}>
                                    <Card
                                        sx={{
                                            height: '100%',
                                            position: 'relative',
                                            borderRadius: 3,
                                            background: pkg.gradient,
                                            color: 'white',
                                            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
                                            transition: 'transform 0.3s ease, box-shadow 0.3s ease',
                                            '&:hover': {
                                                transform: 'translateY(-8px)',
                                                boxShadow: '0 12px 48px rgba(0, 0, 0, 0.4)',
                                            },
                                        }}
                                    >
                                        {pkg.popular && (
                                            <Chip
                                                label="MOST POPULAR"
                                                sx={{
                                                    position: 'absolute',
                                                    top: 16,
                                                    right: 16,
                                                    background: '#FFD700',
                                                    color: '#000',
                                                    fontWeight: 700,
                                                    fontSize: '0.75rem',
                                                }}
                                            />
                                        )}
                                        <CardContent sx={{ textAlign: 'center', py: 4 }}>
                                            <MonetizationOn sx={{ fontSize: 64, mb: 2, opacity: 0.9 }} />
                                            <Typography variant="h5" sx={{ fontWeight: 700, mb: 1 }}>
                                                {pkg.name}
                                            </Typography>
                                            <Typography variant="h3" sx={{ fontWeight: 800, mb: 1, color: pkg.priceColor || 'inherit', textShadow: pkg.priceColor ? '0px 2px 4px rgba(0,0,0,0.3)' : 'none' }}>
                                                {pkg.price}
                                            </Typography>
                                            {pkg.originalPrice && (
                                                <Box sx={{ mb: 2 }}>
                                                    <Typography variant="body2" sx={{ textDecoration: 'line-through', opacity: 0.7 }}>
                                                        {pkg.originalPrice}
                                                    </Typography>
                                                    <Chip
                                                        label={pkg.discount}
                                                        size="small"
                                                        sx={{
                                                            mt: 1,
                                                            background: 'rgba(255, 255, 255, 0.3)',
                                                            color: 'white',
                                                            fontWeight: 700,
                                                        }}
                                                    />
                                                </Box>
                                            )}
                                            <Button
                                                variant="contained"
                                                fullWidth
                                                onClick={() => handlePurchase(pkg)}
                                                disabled={loading || !pkg.paymentLink}
                                                sx={{
                                                    mt: 2,
                                                    py: 1.5,
                                                    background: 'rgba(255, 255, 255, 0.9)',
                                                    color: '#000',
                                                    fontWeight: 700,
                                                    fontSize: '1rem',
                                                    '&:hover': {
                                                        background: 'rgba(255, 255, 255, 1)',
                                                    },
                                                    '&:disabled': {
                                                        background: 'rgba(255, 255, 255, 0.5)',
                                                        color: 'rgba(0, 0, 0, 0.5)',
                                                    }
                                                }}
                                                startIcon={loading ? <CircularProgress size={20} color="inherit" /> : <CheckCircle />}
                                            >
                                                {loading ? 'Processing...' : (pkg.paymentLink ? 'Buy Now' : 'Unavailable')}
                                            </Button>
                                        </CardContent>
                                    </Card>
                                </Grid>
                            ))}
                        </Grid>
                    </Box>

                    <Box sx={{ textAlign: 'center', mb: 6 }}>
                        <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.7)' }}>
                            By purchasing, you agree to our <span
                                style={{ textDecoration: 'underline', cursor: 'pointer', color: 'white' }}
                                onClick={() => navigate('/refund-policy')}
                            >
                                Refund and Cancellation Policy
                            </span>
                        </Typography>
                    </Box>

                    <Divider sx={{ my: 6, borderColor: 'rgba(255, 255, 255, 0.2)' }} />

                    {/* Transaction History */}
                    <Box>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
                            <History sx={{ fontSize: 32, color: '#FFD700' }} />
                            <Typography variant="h4" sx={{ fontWeight: 700, color: 'black' }}>
                                Transaction History
                            </Typography>
                        </Box>

                        {loading ? (
                            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                                <CircularProgress sx={{ color: '#FFD700' }} />
                            </Box>
                        ) : transactions.length === 0 ? (
                            <Paper sx={{ p: 4, textAlign: 'center', borderRadius: 2, background: 'rgba(255, 255, 255, 0.1)', backdropFilter: 'blur(10px)' }}>
                                <Typography variant="body1" sx={{ color: 'rgba(144, 138, 138, 0.8)' }}>
                                    No transactions yet. Purchase coins to get started!
                                </Typography>
                            </Paper>
                        ) : (
                            <TableContainer
                                component={Paper}
                                sx={{
                                    borderRadius: 2,
                                    background: 'rgba(255, 255, 255, 0.95)',
                                    backdropFilter: 'blur(10px)',
                                    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
                                }}
                            >
                                <Table>
                                    <TableHead>
                                        <TableRow sx={{ background: 'linear-gradient(135deg, #1e3c72 0%, #2a5298 100%)' }}>
                                            <TableCell sx={{ color: 'white', fontWeight: 700 }}>Date</TableCell>
                                            <TableCell sx={{ color: 'white', fontWeight: 700 }}>Type</TableCell>
                                            <TableCell sx={{ color: 'white', fontWeight: 700 }}>Reason</TableCell>
                                            <TableCell align="right" sx={{ color: 'white', fontWeight: 700 }}>Amount</TableCell>
                                            <TableCell align="right" sx={{ color: 'white', fontWeight: 700 }}>Balance</TableCell>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {transactions.map((txn, index) => (
                                            <TableRow
                                                key={txn.id || index}
                                                sx={{
                                                    '&:nth-of-type(odd)': { background: 'rgba(0, 0, 0, 0.02)' },
                                                    '&:hover': { background: 'rgba(0, 0, 0, 0.04)' },
                                                }}
                                            >
                                                <TableCell>{formatDate(txn.createdAt)}</TableCell>
                                                <TableCell>
                                                    <Chip
                                                        label={txn.type === 'credit' ? 'Credit' : 'Debit'}
                                                        color={getTransactionColor(txn.type)}
                                                        size="small"
                                                        sx={{ fontWeight: 600 }}
                                                    />
                                                </TableCell>
                                                <TableCell sx={{ textTransform: 'capitalize' }}>
                                                    {txn.reason?.replace(/_/g, ' ') || 'N/A'}
                                                </TableCell>
                                                <TableCell align="right" sx={{ fontWeight: 700, color: txn.type === 'credit' ? 'success.main' : 'error.main' }}>
                                                    {getTransactionIcon(txn.type)}{txn.amount}
                                                </TableCell>
                                                <TableCell align="right" sx={{ fontWeight: 600 }}>
                                                    {txn.balanceAfter || 0}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </TableContainer>
                        )}
                    </Box>

                    {/* Pop Animation for Claiming */}
                    <AnimatePresence>
                        {showPop && (
                            <motion.div
                                initial={{ opacity: 0, scale: 0.5, y: 50 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.5, y: -50 }}
                                style={{
                                    position: 'fixed',
                                    top: '40%',
                                    left: '50%',
                                    transform: 'translate(-50%, -50%)',
                                    zIndex: 9999,
                                    pointerEvents: 'none'
                                }}
                            >
                                <Paper
                                    elevation={24}
                                    sx={{
                                        p: 4,
                                        borderRadius: 8,
                                        background: 'rgba(255, 215, 0, 0.95)',
                                        backdropFilter: 'blur(10px)',
                                        textAlign: 'center',
                                        border: '4px solid #FFF',
                                        boxShadow: '0 0 50px rgba(255, 215, 0, 0.8)'
                                    }}
                                >
                                    <motion.div
                                        animate={{
                                            rotate: [0, -10, 10, -10, 10, 0],
                                            scale: [1, 1.1, 1]
                                        }}
                                        transition={{ duration: 0.5, repeat: Infinity }}
                                    >
                                        <Stars sx={{ fontSize: 80, color: '#000' }} />
                                    </motion.div>
                                    <Typography variant="h3" sx={{ fontWeight: 900, color: '#000', mt: 2 }}>
                                        +{creditedAmount}
                                    </Typography>
                                    <Typography variant="h5" sx={{ fontWeight: 700, color: '#000', textTransform: 'uppercase' }}>
                                        Coins Claimed!
                                    </Typography>
                                </Paper>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* Success Animation Overlay */}
                    {showSuccess && (
                        <SuccessAnimation
                            amount={creditedAmount}
                            onClose={() => setShowSuccess(false)}
                        />
                    )}

                    {/* Snackbar for notifications */}
                    <Snackbar
                        open={snackbar.open}
                        autoHideDuration={4000}
                        onClose={() => setSnackbar({ ...snackbar, open: false })}
                        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
                    >
                        <Alert
                            onClose={() => setSnackbar({ ...snackbar, open: false })}
                            severity={snackbar.severity}
                            sx={{ width: '100%' }}
                        >
                            {snackbar.message}
                        </Alert>
                    </Snackbar>
                </Container >
            </Box >
        </>
    );
};

export default CoinsPage;
