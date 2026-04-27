import React, { useEffect, useState } from 'react';
import {
    Box,
    Container,
    Typography,
    Paper,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Avatar,
    Chip,
    IconButton,
    TextField,
    InputAdornment,
    CircularProgress,
    Tooltip,
    Button,
    Tabs,
    Tab,
    Divider,
    List,
    ListItem,
    ListItemText,
    ListItemIcon
} from '@mui/material';
import { Search, Refresh, Block, Delete, ContentCopy, Email, Circle, History, AddCircle, TrendingUp, TrendingDown, MonetizationOn } from '@mui/icons-material';
import { getAllUserProfiles } from '../services/userService';
import { adminBlockUser, adminUnblockUser } from '../services/userService_admin';
import { addCoins, getCoinTransactions } from '../services/coinService';
import { useAuth } from '../context/AuthContext';
import { signInWithEmailAndPassword, GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth'; // Import Auth methods
import { auth, db } from '../config/firebase'; // Import auth instance
import SEOHead from '../components/SEOHead';
import { listenForAllOnlineUsers, setUserOffline } from '../services/chatServiceV2';
import { collection, query, where, getDocs, writeBatch, serverTimestamp } from 'firebase/firestore';
import { Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions } from '@mui/material';

const AdminUserList = () => {
    const { user } = useAuth();
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [filteredUsers, setFilteredUsers] = useState([]);
    const [onlineUsers, setOnlineUsers] = useState({});
    const [filterTab, setFilterTab] = useState('all');

    // Fetch initial user list
    const fetchUsers = async () => {
        setLoading(true);
        try {
            const allUsers = await getAllUserProfiles();
            setUsers(allUsers);
        } catch (error) {
            console.error("Failed to fetch users:", error);
        } finally {
            setLoading(false);
        }
    };

    // Debug: Log users whenever they change
    useEffect(() => {
        if (users.length > 0) {
            console.log("[AdminUserList] Loaded users:", users.length);
            console.log("[AdminUserList] Sample user:", users[0]);
            const blocked = users.filter(u => u.isBlocked === true);
            const reported = users.filter(u => (Number(u.reportCount) || 0) > 0);
            console.log(`[AdminUserList] Blocked: ${blocked.length}, Reported: ${reported.length}`);
        }
    }, [users]);

    const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(false);
    const [adminEmail, setAdminEmail] = useState('');
    const [adminPassword, setAdminPassword] = useState('');
    const [passwordError, setPasswordError] = useState(false);

    // Dialog state
    const [openBlockDialog, setOpenBlockDialog] = useState(false);
    const [selectedUser, setSelectedUser] = useState(null);
    const [blockReason, setBlockReason] = useState('');

    // Coin Management State
    const [openHistoryDialog, setOpenHistoryDialog] = useState(false);
    const [openAddCoinsDialog, setOpenAddCoinsDialog] = useState(false);
    const [transactionHistory, setTransactionHistory] = useState([]);
    const [historyLoading, setHistoryLoading] = useState(false);
    const [addCoinAmount, setAddCoinAmount] = useState(10);
    const [addCoinReason, setAddCoinReason] = useState('Admin Reward');
    const [isUpdatingCoins, setIsUpdatingCoins] = useState(false);

    useEffect(() => {
        const allowedAdminEmail = import.meta.env.VITE_ADMIN_EMAIL;
        
        // Auto-authenticate if the main session already matches the admin email
        if (user && user.email && allowedAdminEmail && 
            user.email.toLowerCase() === allowedAdminEmail.toLowerCase()) {
            console.log("[AdminUserList] Auto-authenticated matching session:", user.email);
            setIsAdminAuthenticated(true);
        } else {
            setIsAdminAuthenticated(false);
        }
    }, [user]);

    // Action Handlers
    const handleOpenBlockDialog = (user) => {
        setSelectedUser(user);
        setBlockReason('');
        setOpenBlockDialog(true);
    };

    const handleCloseBlockDialog = () => {
        setOpenBlockDialog(false);
        setSelectedUser(null);
    };

    const handleConfirmBlock = async () => {
        if (!selectedUser || !blockReason) return;

        console.log("Attempting to ban user:", selectedUser.uid);
        try {
            await adminBlockUser(selectedUser.uid, blockReason);
            console.log("Ban function returned success.");

            setOpenBlockDialog(false);

            // Force refresh
            const updatedList = await getAllUserProfiles();
            setUsers(updatedList);

            // Verify manually
            const check = updatedList.find(u => u.uid === selectedUser.uid);
            console.log("User state after refresh:", check);

            if (check) {
                if (check.isBlocked) {
                    alert("SUCCESS! User is now BLOCKED in the database.");
                } else {
                    alert("WARNING: The database rejected the block status override.");
                }
            }

        } catch (error) {
            console.error("Failed to block user:", error);
            alert("Failed to block user: " + error.message);
        }
    };

    const handleUnblock = async (user) => {
        if (!window.confirm(`Are you sure you want to unblock ${user.name}?`)) return;

        try {
            await adminUnblockUser(user.uid);
            await fetchUsers(); // Refresh list
        } catch (error) {
            console.error("Failed to unblock user:", error);
            alert("Failed to unblock user: " + error.message);
        }
    };

    const handleOpenHistory = async (user) => {
        setSelectedUser(user);
        setOpenHistoryDialog(true);
        setHistoryLoading(true);
        try {
            const history = await getCoinTransactions(user.uid, 50);
            setTransactionHistory(history);
        } catch (error) {
            console.error("Failed to fetch history:", error);
        } finally {
            setHistoryLoading(false);
        }
    };

    const handleOpenAddCoins = (user) => {
        setSelectedUser(user);
        setAddCoinAmount(10);
        setAddCoinReason('Admin Reward');
        setOpenAddCoinsDialog(true);
    };

    const handleConfirmAddCoins = async () => {
        if (!selectedUser || !addCoinAmount || addCoinAmount <= 0) return;

        setIsUpdatingCoins(true);
        try {
            await addCoins(selectedUser.uid, Number(addCoinAmount), addCoinReason);
            alert(`Successfully added ${addCoinAmount} coins to ${selectedUser.name}`);
            setOpenAddCoinsDialog(false);
            fetchUsers(); // Refresh the list to see new balance
        } catch (error) {
            console.error("Failed to add coins:", error);
            alert("Failed to add coins: " + error.message);
        } finally {
            setIsUpdatingCoins(false);
        }
    };

    const handleAdminLogin = async (e) => {
        e.preventDefault();

        // Security Check: Match against environment variables
        const allowedAdminEmail = import.meta.env.VITE_ADMIN_EMAIL;
        const requiredDashboardPassword = import.meta.env.VITE_ADMIN_PASSWORD;

        if (adminEmail.toLowerCase() === allowedAdminEmail?.toLowerCase() && 
            adminPassword === requiredDashboardPassword) {
            console.log("Admin manual bypass successful.");
            setIsAdminAuthenticated(true);
            setPasswordError(false);
        } else {
            console.warn("Unauthorized manual access attempt.");
            setPasswordError(true);
            alert("ACCESS DENIED: Incorrect Admin credentials.");
        }
    };

    const handleAdminGoogleLogin = async () => {
        try {
            const provider = new GoogleAuthProvider();
            const result = await signInWithPopup(auth, provider);
            const user = result.user;
            const allowedAdminEmail = import.meta.env.VITE_ADMIN_EMAIL;

            if (user.email?.toLowerCase() === allowedAdminEmail?.toLowerCase()) {
                setIsAdminAuthenticated(true);
            } else {
                alert(`ACCESS DENIED: ${user.email} is not the authorized admin.`);
                await signOut(auth);
            }
        } catch (error) {
            console.error("Admin Google Login Failed:", error);
            alert("Google Login Failed: " + error.message);
        }
    };

    // Filter users when search or users/online status changes
    useEffect(() => {
        if (isAdminAuthenticated) {
            fetchUsers();
        }
    }, [isAdminAuthenticated]);

    // Subscribe to online status (Firestore)
    useEffect(() => {
        if (!isAdminAuthenticated) return;

        const unsubscribe = listenForAllOnlineUsers((onlineMap) => {
            setOnlineUsers(onlineMap);
        });

        return () => unsubscribe();
    }, [isAdminAuthenticated]);


    // Filter users when search or users/online status changes
    useEffect(() => {
        const term = searchTerm.toLowerCase();
        let filtered = users.map(u => ({
            ...u,
            isOnline: (onlineUsers && onlineUsers[u.uid] === true) // Strict check
        }));

        // Apply Tab Filter
        if (filterTab === 'blocked') {
            filtered = filtered.filter(u => u.isBlocked === true);
        } else if (filterTab === 'reported') {
            filtered = filtered.filter(u => (Number(u.reportCount) || 0) > 0);
        } else if (filterTab === 'online') {
            filtered = filtered.filter(u => u.isOnline);
        }

        // Apply Search Filter
        filtered = filtered.filter(u =>
            (u.name && u.name.toLowerCase().includes(term)) ||
            (u.email && u.email.toLowerCase().includes(term)) ||
            (u.uid && u.uid.toLowerCase().includes(term))
        );

        // Sort: Blocked first, then Online, then Name
        filtered.sort((a, b) => {
            if (a.isBlocked !== b.isBlocked) return a.isBlocked ? -1 : 1;
            if (a.isOnline !== b.isOnline) return a.isOnline ? -1 : 1;
            return 0;
        });
        setFilteredUsers(filtered);
    }, [searchTerm, users, onlineUsers, filterTab]);

    const copyToClipboard = (text) => {
        navigator.clipboard.writeText(text);
    };

    if (!isAdminAuthenticated) {
        return (
            <>
                <SEOHead title="Admin Login | BiChat" noindex={true} />
                <Container maxWidth="xs" sx={{ mt: 10, mb: 10 }}>
                    <Paper sx={{ p: 4, borderRadius: 3, boxShadow: '0 8px 30px rgba(0,0,0,0.1)' }}>
                        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', mb: 3 }}>
                            <Avatar sx={{ m: 1, bgcolor: 'secondary.main' }}>
                                <Block />
                            </Avatar>
                            <Typography component="h1" variant="h5" fontWeight="bold">
                                Admin Access
                            </Typography>
                        </Box>
                        <Box component="form" onSubmit={handleAdminLogin} noValidate>
                            <TextField
                                margin="normal"
                                required
                                fullWidth
                                label="Admin Email"
                                name="email"
                                autoComplete="email"
                                autoFocus
                                value={adminEmail}
                                onChange={(e) => setAdminEmail(e.target.value)}
                            />
                            <TextField
                                margin="normal"
                                required
                                fullWidth
                                label="Admin Password"
                                type="password"
                                value={adminPassword}
                                onChange={(e) => {
                                    setAdminPassword(e.target.value);
                                    setPasswordError(false);
                                }}
                                error={passwordError}
                                helperText={passwordError ? "Incorrect password" : ""}
                                autoFocus
                            />
                            <Button
                                type="submit"
                                fullWidth
                                variant="contained"
                                sx={{ mt: 3, mb: 1, py: 1.5, fontWeight: 'bold' }}
                            >
                                Enter Dashboard
                            </Button>

                            <Divider sx={{ my: 2 }}>OR</Divider>

                            <Button
                                fullWidth
                                variant="outlined"
                                startIcon={<Email />}
                                onClick={handleAdminGoogleLogin}
                                sx={{ py: 1.5, fontWeight: 'bold', textTransform: 'none' }}
                            >
                                Sign in with Google Admin Account
                            </Button>
                        </Box>
                    </Paper>
                </Container>
            </>
        );
    }

    return (
        <>
            <SEOHead title="Admin Dashboard | BiChat" noindex={true} />
            <Container maxWidth="xl" sx={{ mt: 4, mb: 10 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                    <Typography variant="h4" sx={{ fontWeight: 700, color: '#333' }}>
                        User Management
                    </Typography>
                    <Button
                        startIcon={<Refresh />}
                        variant="outlined"
                        onClick={fetchUsers}
                    >
                        Refresh List
                    </Button>
                    <Box sx={{ ml: 2 }}>
                        <Button
                            variant="outlined"
                            color="warning"
                            size="small"
                            onClick={async () => {
                                if (window.confirm("This will reset ALL active user online statuses to offline in Firestore. Continue?")) {
                                    try {
                                        const usersCol = collection(db, 'users');
                                        const q = query(usersCol, where('status.online', '==', true));
                                        const snapshot = await getDocs(q);

                                        if (snapshot.empty) {
                                            alert("No online users found to reset.");
                                            return;
                                        }

                                        const batch = writeBatch(db);
                                        snapshot.docs.forEach((userDoc) => {
                                            batch.update(userDoc.ref, {
                                                'status.online': false,
                                                'status.lastSeen': Date.now(),
                                                'status.updatedAt': serverTimestamp()
                                            });
                                        });

                                        await batch.commit();
                                        alert(`Successfully reset ${snapshot.size} users to offline.`);
                                        fetchUsers();
                                    } catch (e) {
                                        console.error(e);
                                        alert("Failed to reset: " + e.message);
                                    }
                                }
                            }}
                        >
                            Reset Online Status
                        </Button>
                    </Box>
                </Box>

                <Paper sx={{ mb: 3, p: 2, borderRadius: 3, boxShadow: '0 4px 20px rgba(0,0,0,0.05)' }}>
                    <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
                        <Tabs value={filterTab} onChange={(e, v) => setFilterTab(v)} aria-label="user filters">
                            <Tab label={`All Users (${users.length})`} value="all" />
                            <Tab
                                label={`Blocked (${users.filter(u => u.isBlocked).length})`}
                                value="blocked"
                                sx={{ color: 'error.main' }}
                            />
                            <Tab
                                label={`Reported (${users.filter(u => (u.reportCount || 0) > 0).length})`}
                                value="reported"
                                sx={{ color: 'warning.main' }}
                            />
                            <Tab
                                label={`Online (${Object.values(onlineUsers).filter(v => v).length})`}
                                value="online"
                                sx={{ color: 'success.main' }}
                            />
                        </Tabs>
                    </Box>
                    <TextField
                        fullWidth
                        placeholder="Search by name, email, or UID..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        InputProps={{
                            startAdornment: (
                                <InputAdornment position="start">
                                    <Search color="action" />
                                </InputAdornment>
                            ),
                        }}
                        variant="outlined"
                        size="small"
                        sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                    />
                </Paper>

                <TableContainer component={Paper} sx={{ borderRadius: 3, boxShadow: '0 4px 20px rgba(0,0,0,0.05)', overflow: 'hidden' }}>
                    <Table sx={{ minWidth: 650 }} aria-label="user table">
                        <TableHead sx={{ bgcolor: '#f8f9fa' }}>
                            <TableRow>
                                <TableCell width={60}>Avatar</TableCell>
                                <TableCell>Name</TableCell>
                                <TableCell>Email / Contact</TableCell>
                                <TableCell>Wallet</TableCell>
                                <TableCell width={220}>Safety & Risk</TableCell>
                                <TableCell>Online Status</TableCell>
                                <TableCell>UID (Ref)</TableCell>
                                <TableCell align="right">Actions</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {loading ? (
                                <TableRow>
                                    <TableCell colSpan={7} align="center" sx={{ py: 5 }}>
                                        <CircularProgress />
                                        <Typography sx={{ mt: 2, color: 'text.secondary' }}>Loading users...</Typography>
                                    </TableCell>
                                </TableRow>
                            ) : filteredUsers.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={7} align="center" sx={{ py: 3 }}>
                                        <Typography color="text.secondary">No users found matching "{searchTerm}"</Typography>
                                    </TableCell>
                                </TableRow>
                            ) : (
                                filteredUsers.map((u) => (
                                    <TableRow
                                        key={u.uid}
                                        sx={{ '&:last-child td, &:last-child th': { border: 0 }, '&:hover': { bgcolor: '#f5f5f5' } }}
                                    >
                                        <TableCell>
                                            <Avatar src={u.image} alt={u.name} />
                                        </TableCell>
                                        <TableCell component="th" scope="row">
                                            <Typography fontWeight="600">{u.name || 'No Name'}</Typography>
                                            <Typography variant="caption" color="text.secondary">{u.gender || '-'}</Typography>
                                        </TableCell>
                                        <TableCell>
                                            <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                                                <Typography variant="body2">{u.email || 'No Email'}</Typography>
                                                {u.phoneNumber && <Typography variant="caption" color="text.secondary">{u.phoneNumber}</Typography>}
                                            </Box>
                                        </TableCell>
                                        <TableCell>
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                <Chip 
                                                    label={`🪙 ${u.coins || 0}`} 
                                                    size="small" 
                                                    variant="outlined" 
                                                    sx={{ 
                                                        borderColor: '#FFD700', 
                                                        color: '#b29600',
                                                        fontWeight: 'bold',
                                                        bgcolor: 'rgba(255, 215, 0, 0.05)'
                                                    }} 
                                                />
                                                <Tooltip title="View Transaction History">
                                                    <IconButton size="small" onClick={() => handleOpenHistory(u)} sx={{ color: '#754bffff' }}>
                                                        <History fontSize="small" />
                                                    </IconButton>
                                                </Tooltip>
                                                <Tooltip title="Add Coins Manually">
                                                    <IconButton size="small" onClick={() => handleOpenAddCoins(u)} sx={{ color: '#2e7d32' }}>
                                                        <AddCircle fontSize="small" />
                                                    </IconButton>
                                                </Tooltip>
                                            </Box>
                                        </TableCell>
                                        <TableCell>
                                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, alignItems: 'flex-start' }}>
                                                {/* Account Status Badge */}
                                                {u.isBlocked ? (
                                                    <Chip label="BANNED" color="error" size="small" />
                                                ) : (
                                                    <Chip label="Good Standing" color="success" variant="outlined" size="small" />
                                                )}

                                                {/* Ban Reason */}
                                                {u.isBlocked && u.blockReason && (
                                                    <Typography variant="caption" sx={{ color: 'error.main', fontWeight: 600, lineHeight: 1.2 }}>
                                                        Reason: {u.blockReason}
                                                    </Typography>
                                                )}

                                                {/* Risk Metrics */}
                                                {(u.reportCount > 0 || u.blockCount > 0) && (
                                                    <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mt: 0.5 }}>
                                                        {u.reportCount > 0 && (
                                                            <Tooltip title="Number of times reported by active users">
                                                                <Chip
                                                                    label={`🚩 ${u.reportCount} Reports`}
                                                                    size="small"
                                                                    sx={{
                                                                        height: 20,
                                                                        fontSize: '0.7rem',
                                                                        bgcolor: u.reportCount > 2 ? '#ffebee' : '#fff3e0',
                                                                        color: u.reportCount > 2 ? '#d32f2f' : '#e65100',
                                                                        border: '1px solid',
                                                                        borderColor: u.reportCount > 2 ? '#ffcdd2' : '#ffe0b2'
                                                                    }}
                                                                />
                                                            </Tooltip>
                                                        )}
                                                        {u.blockCount > 0 && (
                                                            <Tooltip title="Number of times blocked by other users">
                                                                <Chip
                                                                    label={`🚫 Blocked by ${u.blockCount}`}
                                                                    size="small"
                                                                    sx={{
                                                                        height: 20,
                                                                        fontSize: '0.7rem',
                                                                        bgcolor: '#eeeeee',
                                                                        color: '#616161',
                                                                        border: '1px solid #e0e0e0'
                                                                    }}
                                                                /> 
                                                            </Tooltip>
                                                        )}
                                                    </Box>
                                                )}
                                            </Box>
                                        </TableCell>
                                        <TableCell>
                                            <div style={{ fontSize: '0.6rem', color: '#999', fontFamily: 'monospace' }}>
                                                RTDB: {JSON.stringify(onlineUsers[u.uid])}
                                            </div>
                                            {u.isOnline ? (
                                                <Chip
                                                    icon={<Circle sx={{ fontSize: '0.6rem !important', color: '#235a25ff' }} />}
                                                    label="Online"
                                                    sx={{
                                                        borderColor: '#4caf50',
                                                        color: '#2e7d32',
                                                        bgcolor: 'rgba(107, 205, 110, 0.33)',
                                                        fontWeight: 'bold'
                                                    }}
                                                    size="small"
                                                    variant="outlined"
                                                />
                                            ) : (
                                                <Chip
                                                    icon={<Circle sx={{ fontSize: '0.6rem !important', color: '#9e9e9e' }} />}
                                                    label="Offline"
                                                    size="small"
                                                    variant="outlined"
                                                    sx={{
                                                        borderColor: '#e0e0e0',
                                                        color: '#757575',
                                                        bgcolor: '#fafafa'
                                                    }}
                                                />
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                <Typography variant="caption" sx={{ fontFamily: 'monospace', bgcolor: '#eee', px: 1, py: 0.5, borderRadius: 1 }}>
                                                    {u.uid.substring(0, 8)}...
                                                </Typography>
                                                <Tooltip title="Copy Full UID">
                                                    <IconButton size="small" onClick={() => copyToClipboard(u.uid)}>
                                                        <ContentCopy fontSize="inherit" />
                                                    </IconButton>
                                                </Tooltip>
                                            </Box>
                                        </TableCell>
                                        <TableCell align="right">
                                            {u.isBlocked ? (
                                                <Button
                                                    variant="outlined"
                                                    color="success"
                                                    size="small"
                                                    onClick={() => handleUnblock(u)}
                                                >
                                                    Unblock
                                                </Button>
                                            ) : (
                                                <Button
                                                    variant="contained"
                                                    color="error"
                                                    size="small"
                                                    startIcon={<Block />}
                                                    onClick={() => handleOpenBlockDialog(u)}
                                                >
                                                    Ban
                                                </Button>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </TableContainer>

                <Typography variant="caption" display="block" sx={{ mt: 2, textAlign: 'center', color: 'text.secondary' }}>
                    Total Users: {users.length} | Showing: {filteredUsers.length} | Online Detected: {Object.values(onlineUsers).filter(v => v).length}
                </Typography>

                {/* Block User Dialog */}
                <Dialog open={openBlockDialog} onClose={handleCloseBlockDialog}>
                    <DialogTitle>Block User Access</DialogTitle>
                    <DialogContent>
                        <DialogContentText>
                            To ban <strong>{selectedUser?.name}</strong>, please provide a reason. This will prevent them from logging in.
                        </DialogContentText>
                        <TextField
                            autoFocus
                            margin="dense"
                            id="reason"
                            label="Ban Reason"
                            type="text"
                            fullWidth
                            variant="outlined"
                            value={blockReason}
                            onChange={(e) => setBlockReason(e.target.value)}
                            placeholder="e.g. Violation of Terms, Harassment..."
                        />
                    </DialogContent>
                    <DialogActions>
                        <Button onClick={handleCloseBlockDialog}>Cancel</Button>
                        <Button onClick={handleConfirmBlock} color="error" variant="contained">
                            Ban User
                        </Button>
                    </DialogActions>
                </Dialog>

                {/* Coin History Dialog */}
                <Dialog 
                    open={openHistoryDialog} 
                    onClose={() => setOpenHistoryDialog(false)}
                    maxWidth="sm"
                    fullWidth
                >
                    <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <History color="primary" />
                        Coin History: {selectedUser?.name}
                    </DialogTitle>
                    <DialogContent dividers>
                        {historyLoading ? (
                            <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
                                <CircularProgress size={30} />
                            </Box>
                        ) : transactionHistory.length === 0 ? (
                            <Typography sx={{ p: 2, textAlign: 'center', color: 'text.secondary' }}>
                                No transaction history found.
                            </Typography>
                        ) : (
                            <List sx={{ pt: 0 }}>
                                {transactionHistory.map((tx, idx) => (
                                    <React.Fragment key={tx.id || idx}>
                                        <ListItem alignItems="flex-start" sx={{ px: 1 }}>
                                            <ListItemIcon sx={{ minWidth: 40 }}>
                                                {tx.type === 'credit' ? (
                                                    <TrendingUp sx={{ color: '#2e7d32' }} />
                                                ) : (
                                                    <TrendingDown sx={{ color: '#d32f2f' }} />
                                                )}
                                            </ListItemIcon>
                                            <ListItemText
                                                primary={
                                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                        <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                                                            {tx.type === 'credit' ? '+' : '-'}{tx.amount} Coins
                                                        </Typography>
                                                        <Typography variant="caption" color="text.secondary">
                                                            {tx.createdAt?.seconds 
                                                                ? new Date(tx.createdAt.seconds * 1000).toLocaleString() 
                                                                : 'Recently added'}
                                                        </Typography>
                                                    </Box>
                                                }
                                                secondary={
                                                    <Typography variant="body2" sx={{ fontSize: '0.8rem', mt: 0.5 }}>
                                                        <strong>Reason:</strong> {tx.reason || 'N/A'} 
                                                        <Box component="span" sx={{ display: 'block', mt: 0.2, color: 'text.secondary', fontSize: '0.7rem' }}>
                                                            Balance: {tx.balanceBefore || 0} → {tx.balanceAfter || 0}
                                                        </Box>
                                                    </Typography>
                                                }
                                            />
                                        </ListItem>
                                        {idx < transactionHistory.length - 1 && <Divider variant="inset" component="li" />}
                                    </React.Fragment>
                                ))}
                            </List>
                        )}
                    </DialogContent>
                    <DialogActions>
                        <Button onClick={() => setOpenHistoryDialog(false)}>Close</Button>
                    </DialogActions>
                </Dialog>

                {/* Add Coins Dialog */}
                <Dialog 
                    open={openAddCoinsDialog} 
                    onClose={() => setOpenAddCoinsDialog(false)}
                >
                    <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <MonetizationOn sx={{ color: '#FFD700' }} />
                        Add Coins to {selectedUser?.name}
                    </DialogTitle>
                    <DialogContent>
                        <DialogContentText sx={{ mb: 2 }}>
                            Add coins directly to this user's wallet. They will see this in their history.
                        </DialogContentText>
                        <TextField
                            autoFocus
                            margin="dense"
                            label="Amount of Coins"
                            type="number"
                            fullWidth
                            variant="outlined"
                            value={addCoinAmount}
                            onChange={(e) => setAddCoinAmount(e.target.value)}
                        />
                        <TextField
                            margin="dense"
                            label="Reason for Credit"
                            type="text"
                            fullWidth
                            variant="outlined"
                            value={addCoinReason}
                            onChange={(e) => setAddCoinReason(e.target.value)}
                            placeholder="e.g. Compensation, Promo, Refund..."
                            sx={{ mt: 2 }}
                        />
                    </DialogContent>
                    <DialogActions sx={{ p: 3 }}>
                        <Button onClick={() => setOpenAddCoinsDialog(false)}>Cancel</Button>
                        <Button 
                            onClick={handleConfirmAddCoins} 
                            color="success" 
                            variant="contained"
                            disabled={isUpdatingCoins}
                            startIcon={isUpdatingCoins ? <CircularProgress size={20} /> : <MonetizationOn />}
                        >
                            {isUpdatingCoins ? 'Processing...' : 'Credit Coins'}
                        </Button>
                    </DialogActions>
                </Dialog>

                {/* Debug Section */}
                <Box sx={{ mt: 4, p: 2, bgcolor: '#f0f0f0', borderRadius: 2, fontSize: '0.75rem', fontFamily: 'monospace' }}>
                    <Typography variant="subtitle2" fontWeight="bold">DEBUG VIEW (Status Diagnosis)</Typography>
                    <Box sx={{ mb: 1 }}>
                        <strong>Online Users Map Size:</strong> {Object.keys(onlineUsers).length} <br />
                        <strong>Filtered Users Count:</strong> {filteredUsers.length}
                    </Box>
                    <details>
                        <summary style={{ cursor: 'pointer' }}>View Raw Online Map</summary>
                        <pre>{JSON.stringify(onlineUsers, null, 2)}</pre>
                    </details>
                    <details>
                        <summary style={{ cursor: 'pointer', marginTop: '8px' }}>View First 2 Users Data</summary>
                        <pre>{JSON.stringify(filteredUsers.slice(0, 2).map(u => ({ uid: u.uid, name: u.name, isOnline: u.isOnline })), null, 2)}</pre>
                    </details>
                </Box>
            </Container>
        </>
    );
};

export default AdminUserList;

