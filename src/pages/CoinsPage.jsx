import { useState, useEffect } from 'react';
import { Container, Typography, Box, Card, CardContent, Button, Grid, Paper, Divider, CircularProgress, Alert, Snackbar, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Chip } from '@mui/material';
import { MonetizationOn, CheckCircle, History } from '@mui/icons-material';
import { useAuth } from '../context/AuthContext';
import { getCoinTransactions, purchaseCoins } from '../services/coinService';
import { useNavigate } from 'react-router-dom';
import SEOHead from '../components/SEOHead';

const CoinsPage = () => {
    const { user, coins } = useAuth();
    const navigate = useNavigate();
    const [transactions, setTransactions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

    // Coin packages
    const coinPackages = [
        {
            id: 1,
            name: '100 Coins',
            amount: 100,
            price: '$4.99',
            popular: false,
            gradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        },
        {
            id: 2,
            name: '500 Coins',
            amount: 500,
            price: '$19.99',
            originalPrice: '$24.95',
            discount: '20% OFF',
            popular: true,
            gradient: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
        },
        {
            id: 3,
            name: '1000 Coins',
            amount: 1000,
            price: '$34.99',
            originalPrice: '$49.90',
            discount: '30% OFF',
            popular: false,
            gradient: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
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

    const handlePurchase = async (pkg) => {
        try {
            await purchaseCoins(user.uid, pkg.amount, pkg.name);
            setSnackbar({
                open: true,
                message: `Successfully purchased ${pkg.amount} coins!`,
                severity: 'success',
            });

            // Refresh transactions
            const txns = await getCoinTransactions(user.uid, 20);
            setTransactions(txns);
        } catch (error) {
            console.error('Error purchasing coins:', error);
            setSnackbar({
                open: true,
                message: 'Failed to purchase coins. Please try again.',
                severity: 'error',
            });
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
            <Box
                sx={{
                    minHeight: '100vh',
                    background: 'linear-gradient(135deg, #1e3c72 0%, #2a5298 25%, #7e22ce 75%, #a855f7 100%)',
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
                        <Typography variant="h4" sx={{ mb: 3, fontWeight: 700, textAlign: 'center', color: 'white' }}>
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
                                            <Typography variant="h3" sx={{ fontWeight: 800, mb: 1 }}>
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
                                                Purchase
                                            </Button>
                                        </CardContent>
                                    </Card>
                                </Grid>
                            ))}
                        </Grid>
                    </Box>

                    <Divider sx={{ my: 6, borderColor: 'rgba(255, 255, 255, 0.2)' }} />

                    {/* Transaction History */}
                    <Box>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
                            <History sx={{ fontSize: 32, color: '#FFD700' }} />
                            <Typography variant="h4" sx={{ fontWeight: 700, color: 'white' }}>
                                Transaction History
                            </Typography>
                        </Box>

                        {loading ? (
                            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                                <CircularProgress sx={{ color: '#FFD700' }} />
                            </Box>
                        ) : transactions.length === 0 ? (
                            <Paper sx={{ p: 4, textAlign: 'center', borderRadius: 2, background: 'rgba(255, 255, 255, 0.1)', backdropFilter: 'blur(10px)' }}>
                                <Typography variant="body1" sx={{ color: 'rgba(255, 255, 255, 0.8)' }}>
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
            </Box>
        </>
    );
};

export default CoinsPage;
