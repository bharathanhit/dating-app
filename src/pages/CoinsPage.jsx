// Version: ManualCheck_Fix_v3
import { useState, useEffect } from 'react';
import { Container, Typography, Box, Card, CardContent, Button, Grid, Paper, Divider, CircularProgress, Alert, Snackbar, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Chip, useMediaQuery, useTheme } from '@mui/material';
import { MonetizationOn, CheckCircle, History, Stars } from '@mui/icons-material';
import { useAuth } from '../context/AuthContext';
import { getCoinTransactions, addCoins } from '../services/coinService';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import SEOHead from '../components/SEOHead';
import SuccessAnimation from '../components/SuccessAnimation';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../config/firebase';

const CoinsPage = () => {
    const { user, profile, coins } = useAuth();

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
        },
        {
            id: 3,
            name: '75 Coins',
            amount: 75,
            price: '₹50',
            originalPrice: '₹80',
            discount: '37% OFF',
            popular: true,
            gradient: 'linear-gradient(43deg, #4158D0 0%, #C850C0 46%, #FFCC70 100%)',
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
    }, [user, navigate]);

    // DEBUG: Log URL params on mount/update and Handle Payment Redirects
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const paymentId = params.get('razorpay_payment_id');
        const paymentStatus = params.get('razorpay_payment_link_status');
        const signature = params.get('razorpay_signature');

        if (paymentId && user && !verifying) {
            // Check if we have a pending purchase in local storage
            const pendingPurchase = localStorage.getItem('pending_coin_purchase');

            if (pendingPurchase) {
                setVerifying(true);
                try {
                    const pkgData = JSON.parse(pendingPurchase);

                    if (paymentStatus === 'failed') {
                        setSnackbar({ open: true, severity: 'error', message: 'Payment failed or was cancelled.' });
                        localStorage.removeItem('pending_coin_purchase');
                        setVerifying(false);
                        return;
                    }

                    // Securely verify and credit coins using Cloud Function
                    const verifyPayment = httpsCallable(functions, 'verifyRazorpayPayment');
                    verifyPayment({
                        razorpay_payment_id: paymentId,
                        razorpay_order_id: pkgData.orderId,
                        razorpay_signature: signature,
                        userId: user.uid,
                        coinsAmount: pkgData.amount
                    })
                        .then((verificationResult) => {
                            if (verificationResult.data.success) {
                                setCreditedAmount(pkgData.amount);
                                setShowSuccess(true);
                                setShowPop(true);
                                setTimeout(() => setShowPop(false), 3000);

                                localStorage.removeItem('pending_coin_purchase');
                                window.history.replaceState({}, document.title, window.location.pathname);
                                getCoinTransactions(user.uid, 20).then(setTransactions);
                                setSnackbar({ open: true, severity: 'success', message: 'Payment verified and coins credited!' });
                            } else {
                                throw new Error(verificationResult.data.error || "Verification failed");
                            }
                        })
                        .catch(err => {
                            console.error("Verification failed:", err);
                            setSnackbar({ open: true, severity: 'error', message: 'Payment verified but crediting failed. Please contact support.' });
                        }).finally(() => setVerifying(false));

                } catch (e) {
                    console.error("Error parsing pending purchase", e);
                    setVerifying(false);
                }
            }
        }
    }, [window.location.search, user]);


    const handlePurchase = async (pkg) => {
        if (!user) {
            navigate('/login');
            return;
        }

        setVerifying(true);
        try {
            // 1. Create Order via Cloud Function
            const createOrder = httpsCallable(functions, 'createRazorpayOrder');
            const result = await createOrder({
                amount: Math.round(parseFloat(pkg.price.replace('₹', '')) * 100), // Send in paise
                currency: 'INR',
                packageId: pkg.id,
                coinsAmount: pkg.amount
            });

            if (!result.data.success) {
                throw new Error(result.data.error || "Failed to create order");
            }

            const { order } = result.data;
            if (!order || !order.id) {
                throw new Error("Invalid order response from server");
            }
            const order_id = order.id;
            const razorpay_key = "rzp_live_SZ2hAjWVwfPAA5"; // Shared key

            // 1.5 Store pending purchase in case of redirect
            localStorage.setItem('pending_coin_purchase', JSON.stringify({
                packageId: pkg.id,
                amount: pkg.amount,
                orderId: order_id,
                timestamp: Date.now()
            }));

            // 2. Open Razorpay Checkout Modal
            const options = {
                key: razorpay_key || "rzp_live_SZ2hAjWVwfPAA5",
                amount: Math.round(pkg.price.replace('₹', '') * 100),
                currency: "INR",
                name: "BiChat Coins",
                description: `Purchase ${pkg.name}`,
                order_id: order_id,
                prefill: {
                    name: profile?.name || user?.displayName || "",
                    email: profile?.email || user?.email || "",
                    contact: user.phoneNumber || ""
                },
                notes: {
                    userId: user.uid,
                    packageId: pkg.id,
                    coinsAmount: pkg.amount
                },
                theme: {
                    color: "#754bff"
                },
                handler: async function (response) {
                    // 3. Verify Payment via Cloud Function
                    setVerifying(true);
                    try {
                        const verifyPayment = httpsCallable(functions, 'verifyRazorpayPayment');
                        const verificationResult = await verifyPayment({
                            razorpay_order_id: response.razorpay_order_id,
                            razorpay_payment_id: response.razorpay_payment_id,
                            razorpay_signature: response.razorpay_signature,
                            userId: user.uid,
                            packageId: pkg.id,
                            coinsAmount: pkg.amount
                        });

                        if (verificationResult.data.success) {
                            setCreditedAmount(pkg.amount);
                            setShowSuccess(true);
                            setShowPop(true);
                            setTimeout(() => setShowPop(false), 3000);

                            // Refresh transaction list
                            getCoinTransactions(user.uid, 20).then(setTransactions);
                            setSnackbar({ open: true, severity: 'success', message: 'Coins credited successfully!' });
                        } else {
                            throw new Error(verificationResult.data.error || "Verification failed");
                        }
                    } catch (err) {
                        console.error("Verification failed:", err);
                        setSnackbar({ open: true, severity: 'error', message: 'Payment verified but crediting failed. Please contact support.' });
                    } finally {
                        setVerifying(false);
                    }
                },
                modal: {
                    ondismiss: function () {
                        setVerifying(false);
                    }
                }
            };

            const rzp = new window.Razorpay(options);
            rzp.open();

        } catch (error) {
            console.error("Error initiating purchase:", error);
            setSnackbar({
                open: true,
                message: error.message || "Failed to start payment.",
                severity: "error"
            });
            setVerifying(false);
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
                keywords="buy coins, purchase coins, app coins, BiChat coins"
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
                                                }}
                                                startIcon={<CheckCircle />}
                                            >
                                                Buy Now
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
                                                    {(txn.reason === 'razorpay_webhook' || txn.reason === 'razorpay_checkout' || txn.reason === 'coins_purchase')
                                                        ? 'coin purchase'
                                                        : (txn.reason?.replace(/_/g, ' ') || 'N/A')}
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
