import { useState, useEffect } from 'react';
import { Container, Typography, Box, Card, CardContent, Button, Grid, Paper, Divider, CircularProgress, Alert, Snackbar, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Chip, Dialog, DialogTitle, DialogContent, DialogActions, TextField, useMediaQuery, useTheme } from '@mui/material';
import QRCode from 'react-qr-code';
import { MonetizationOn, CheckCircle, History } from '@mui/icons-material';
import { useAuth } from '../context/AuthContext';
import { getCoinTransactions, submitPaymentProof } from '../services/coinService';
import { useNavigate } from 'react-router-dom';
import SEOHead from '../components/SEOHead';

const CoinsPage = () => {
    const { user, coins } = useAuth();
    const navigate = useNavigate();
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
    const [transactions, setTransactions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [purchasingId, setPurchasingId] = useState(null);
    const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

    // Manual Payment State
    const [openPaymentDialog, setOpenPaymentDialog] = useState(false);
    const [selectedPackage, setSelectedPackage] = useState(null);
    const [utrNumber, setUtrNumber] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [paymentMethod, setPaymentMethod] = useState(null); // 'gpay' | 'phonepe' | null

    const handlePaymentMethodClick = (method) => {
        setPaymentMethod(method);

        if (!selectedPackage) return;

        // Extract numeric price from string (e.g., '₹10' -> 10)
        const numericPrice = parseFloat(selectedPackage.price.replace(/[^0-9.]/g, ''));

        // Construct UPI Link
        // pa = Payee Address
        // pn = Payee Name
        // am = Amount (use actual price, not coin amount)
        // cu = Currency
        // tn = Transaction Note (optional)
        const upiLink = `upi://pay?pa=abharathan61-2@okaxis&pn=Bichat&am=${numericPrice}&cu=INR&tn=Coin Purchase`;

        // Create a temporary anchor element and click it (more reliable than window.location)
        const anchor = document.createElement('a');
        anchor.href = upiLink;
        anchor.target = '_blank';
        anchor.rel = 'noopener noreferrer';
        document.body.appendChild(anchor);
        anchor.click();
        document.body.removeChild(anchor);

        // Show a message to the user
        setTimeout(() => {
            setSnackbar({
                open: true,
                message: 'If the app didn\'t open, please copy the UPI ID and pay manually.',
                severity: 'info'
            });
        }, 1000);
    };

    // Coin packages
    const coinPackages = [
        {
            id: 1,
            name: '10 Coins',
            amount: 1,
            price: '₹10',
            popular: false,
            gradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        },
        {
            id: 2,
            name: '25 Coins',
            amount: 2,
            price: '₹20',
            priceColor: '#FFD700', // Gold color for price
            originalPrice: '₹25',
            discount: '20% OFF',
            popular: false,
            gradient: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
        },
        {
            id: 3,
            name: '62 Coins',
            amount: 10,
            price: '₹50',
            originalPrice: '₹75',
            discount: '33% OFF',
            popular: true,
            gradient: 'linear-gradient(43deg, #4158D0 0%, #C850C0 46%, #FFCC70 100%)', // Premium gradient
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

        // Check for success/cancel params (Legacy or if redirected back)
        const params = new URLSearchParams(window.location.search);
        if (params.get('success')) {
            setSnackbar({
                open: true,
                message: 'Payment notification processed.',
                severity: 'success'
            });
            window.history.replaceState({}, document.title, window.location.pathname);
        }
    }, [user, navigate]);

    const handlePurchase = (pkg) => {
        setSelectedPackage(pkg);
        setUtrNumber('');
        setOpenPaymentDialog(true);
    };

    const handleSubmitPayment = async () => {
        if (!utrNumber || !selectedPackage) return;

        setSubmitting(true);
        try {
            await submitPaymentProof(
                user.uid,
                selectedPackage.amount,
                selectedPackage.name,
                selectedPackage.price,
                selectedPackage.id,
                utrNumber
            );

            setOpenPaymentDialog(false);
            setSnackbar({
                open: true,
                message: 'Payment proof submitted! Coins will be added after admin verification.',
                severity: 'success'
            });

            // Optionally add a temporary "pending" transaction to the list or refresh
            // For now, refreshing transactions might not show it unless the backend added a record we can see in getCoinTransactions
            // Current getCoinTransactions queries users/{uid}/coinTransactions. 
            // The Cloud Function doesn't add a transaction record until "Approved". 
            // So we just show the success message.

            setUtrNumber('');
            setSelectedPackage(null);
        } catch (error) {
            console.error('Error submitting proof:', error);
            setSnackbar({
                open: true,
                message: 'Failed to submit proof. Please try again.',
                severity: 'error'
            });
        } finally {
            setSubmitting(false);
        }
    };

    const formatDate = (timestamp) => {
        if (!timestamp) return 'N/A';

        // Handle Firestore Timestamp
        let date;
        if (timestamp.toDate) {
            date = timestamp.toDate();
        } else if (timestamp.seconds) {
            date = new Date(timestamp.seconds * 1000);
        } else {
            date = new Date(timestamp);
        }

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
                title="Buy Coins | Bichat"
                description="Purchase coins to like profiles and unlock premium features on Bichat."
                keywords="buy coins, purchase coins, dating app coins, Bichat coins"
                url="https://bichat-make-friendswith-bichat.netlify.app/coins"
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
                                                disabled={!!purchasingId}
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
                                                startIcon={purchasingId === pkg.id ? <CircularProgress size={20} color="inherit" /> : <CheckCircle />}
                                            >
                                                Purchase
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
                </Container>
            </Box >

            {/* Payment Verification Dialog */}
            < Dialog
                open={openPaymentDialog}
                onClose={() => {
                    setOpenPaymentDialog(false);
                    setPaymentMethod(null);
                }}
                maxWidth="xs"
                fullWidth
            >
                <DialogTitle sx={{ textAlign: 'center', fontWeight: 'bold' }}>
                    {isMobile
                        ? (paymentMethod ? 'Complete Payment' : 'Choose Payment App')
                        : 'Scan or Pay via UPI'
                    }
                </DialogTitle>
                <DialogContent>
                    <Box sx={{ textAlign: 'center', mb: 1 }}>
                        {isMobile ? (
                            // Mobile View
                            !paymentMethod ? (
                                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 2 }}>
                                    <Button
                                        variant="contained"
                                        size="large"
                                        onClick={() => handlePaymentMethodClick('gpay')}
                                        sx={{
                                            background: '#fff',
                                            color: '#3c4043',
                                            border: '1px solid #dadce0',
                                            textTransform: 'none',
                                            fontSize: '1.1rem',
                                            fontWeight: 500,
                                            py: 1.5,
                                            '&:hover': { background: '#f8f9fa' },
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            gap: 1
                                        }}
                                    >
                                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                            <path d="M4.5 9C4.5 8.01 5.31 7.2 6.3 7.2H17.7C18.69 7.2 19.5 8.01 19.5 9V17.7C19.5 18.69 18.69 19.5 17.7 19.5H6.3C5.31 19.5 4.5 18.69 4.5 17.7V9Z" fill="white" />
                                            <path d="M21.5 9.00001C21.5 8.35801 21.054 7.82401 20.469 7.64401L13.131 4.71301C12.408 4.42501 11.595 4.42501 10.872 4.71301L3.534 7.64401C2.946 7.82401 2.5 8.36101 2.5 9.00001V12.984C2.5 17.436 5.568 21.579 9.876 22.809C11.235 23.199 12.768 23.199 14.127 22.809C18.432 21.579 21.5 17.436 21.5 12.984V9.00001Z" fill="#4285F4" />
                                            <path d="M10.974 15.066H9.849V19.128H8.859V12.189H10.974C11.664 12.189 12.195 12.339 12.567 12.639C12.942 12.936 13.128 13.344 13.128 13.863V13.896C13.128 14.28 13.008 14.595 12.768 14.85C12.531 15.105 12.192 15.285 11.751 15.39L13.353 19.128H12.261L10.797 15.54H10.974C11.361 15.54 11.667 15.432 11.892 15.216C12.12 14.997 12.234 14.706 12.234 14.343V14.31C12.234 13.776 11.814 13.509 10.974 15.066ZM14.7738 12.189H17.4198V13.062H15.7638V14.757H17.2218V15.63H15.7638V19.128H14.7738V12.189ZM7.13204 15.939C6.88904 16.176 6.55904 16.293 6.14204 16.293C5.64104 16.293 5.25704 16.128 4.99004 15.798C4.72604 15.465 4.59404 14.985 4.59404 14.358V14.325C4.59404 13.689 4.73504 13.197 5.01704 12.852C5.30204 12.504 5.71004 12.33 6.24104 12.33C6.72404 12.33 7.09904 12.483 7.36604 12.789C7.63604 13.092 7.77104 13.539 7.77104 14.133V14.619H5.53904C5.55104 14.997 5.64704 15.267 5.82704 15.429C6.00704 15.588 6.24404 15.669 6.53804 15.669C6.97904 15.669 7.27904 15.474 7.43804 15.084L8.27504 15.435C8.03504 16.035 7.65404 16.335 7.13204 15.939ZM6.24104 12.981C5.97104 12.981 5.77604 13.068 5.65604 13.242C5.53904 13.413 5.48504 13.665 5.49404 13.998H6.84404V13.887C6.84404 13.587 6.79004 13.368 6.68204 13.23C6.57704 13.092 6.43004 13.023 6.24104 13.023V12.981Z" fill="white" />
                                        </svg>
                                        Google Pay
                                    </Button>
                                    <Button
                                        variant="contained"
                                        size="large"
                                        onClick={() => handlePaymentMethodClick('phonepe')}
                                        sx={{
                                            background: '#5f259f',
                                            color: 'white',
                                            textTransform: 'none',
                                            fontSize: '1.1rem',
                                            fontWeight: 600,
                                            py: 1.5,
                                            '&:hover': { background: '#4a1d7c' },
                                        }}
                                    >
                                        PhonePe
                                    </Button>
                                </Box>
                            ) : (
                                <>
                                    <Typography variant="body1" sx={{ mb: 2 }}>
                                        Pay <b>{selectedPackage?.price}</b> via UPI to:
                                    </Typography>
                                    <Box
                                        sx={{
                                            p: 2,
                                            background: '#f5f5f5',
                                            borderRadius: 2,
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            gap: 1,
                                            mb: 2,
                                            cursor: 'pointer'
                                        }}
                                        onClick={() => {
                                            navigator.clipboard.writeText('abharathan61-2@okaxis');
                                            setSnackbar({ open: true, message: 'UPI ID Copied!', severity: 'success' });
                                        }}
                                    >
                                        <Typography variant="h6" sx={{ fontWeight: 'bold', userSelect: 'all' }}>
                                            abharathan61-2@okaxis
                                        </Typography>
                                        <Chip label="Copy" size="small" color="primary" clickable />
                                    </Box>
                                    <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                                        If the app didn't open, copy the ID above and pay manually in your UPI app.
                                    </Typography>
                                    <Divider sx={{ mb: 3 }} />
                                    <Typography variant="body2" sx={{ mb: 1, textAlign: 'left' }}>
                                        After payment, enter the <b>Transaction ID / UTR</b> below:
                                    </Typography>
                                    <TextField
                                        fullWidth
                                        label="Transaction ID / UTR"
                                        placeholder="e.g. 334512345678"
                                        value={utrNumber}
                                        onChange={(e) => setUtrNumber(e.target.value)}
                                        variant="outlined"
                                        size="small"
                                        autoFocus
                                    />
                                </>
                            )
                        ) : (
                            // Desktop View
                            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                <Typography variant="body1" sx={{ mb: 2 }}>
                                    Scan with <b>GPay</b> or <b>PhonePe</b> to pay <b>{selectedPackage?.price}</b>
                                </Typography>

                                <Box sx={{ p: 2, background: 'white', borderRadius: 2, boxShadow: '0 4px 12px rgba(0,0,0,0.1)', mb: 3 }}>
                                    {selectedPackage && (
                                        <QRCode
                                            value={`upi://pay?pa=abharathan61-2@okaxis&pn=Bichat Coin Purchase&am=${parseFloat(selectedPackage.price.replace(/[^0-9.]/g, ''))}&cu=INR`}
                                            size={200}
                                        />
                                    )}
                                </Box>

                                <Typography variant="body2" sx={{ mb: 2 }}>
                                    UPI ID: <span style={{ fontWeight: 'bold' }}>abharathan61-2@okaxis</span>
                                </Typography>

                                <Divider sx={{ width: '100%', mb: 3 }} />

                                <Typography variant="body2" sx={{ mb: 1, textAlign: 'left', width: '100%' }}>
                                    After scanning & paying, enter <b>UTR</b> below:
                                </Typography>
                                <TextField
                                    fullWidth
                                    label="Transaction ID / UTR"
                                    placeholder="e.g. 334512345678"
                                    value={utrNumber}
                                    onChange={(e) => setUtrNumber(e.target.value)}
                                    variant="outlined"
                                    size="small"
                                    autoFocus
                                />
                            </Box>
                        )}
                    </Box>
                </DialogContent>
                <DialogActions sx={{ px: 3, pb: 3, justifyContent: 'space-between' }}>
                    {isMobile && paymentMethod ? (
                        <Button onClick={() => setPaymentMethod(null)} color="inherit">
                            Back
                        </Button>
                    ) : (
                        <Button onClick={() => setOpenPaymentDialog(false)} color="inherit">
                            Cancel
                        </Button>
                    )}

                    {(!isMobile || (isMobile && paymentMethod)) && (
                        <Button
                            onClick={handleSubmitPayment}
                            variant="contained"
                            color="primary"
                            disabled={!utrNumber || submitting}
                            startIcon={submitting ? <CircularProgress size={20} /> : <CheckCircle />}
                        >
                            {submitting ? 'Verifying...' : 'Submit Proof'}
                        </Button>
                    )}
                </DialogActions>
            </Dialog >
        </>
    );
};

export default CoinsPage;














