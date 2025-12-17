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
    Tab
} from '@mui/material';
import { Search, Refresh, Block, Delete, ContentCopy, Email, Circle } from '@mui/icons-material';
import { getAllUserProfiles } from '../services/userService';
import { adminBlockUser, adminUnblockUser } from '../services/userService_admin';
import { useAuth } from '../context/AuthContext';
import { signInWithEmailAndPassword } from 'firebase/auth'; // Import Email Sign-in
import { auth } from '../config/firebase'; // Import auth instance
import SEOHead from '../components/SEOHead';
import { ref, onValue } from 'firebase/database';
import { realtimeDb } from '../config/firebase.js';
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

    useEffect(() => {
        setIsAdminAuthenticated(false); // Force false on mount
    }, []);

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

    const handleAdminLogin = async (e) => {
        e.preventDefault();

        try {
            // Secure Authentication: Verify credentials against Firebase
            const userCredential = await signInWithEmailAndPassword(auth, adminEmail, adminPassword);
            const user = userCredential.user;

            // SECURITY: Whitelist Check
            // Verify that the logged-in user is actually the allowed Admin
            const allowedAdminEmail = import.meta.env.VITE_ADMIN_EMAIL;

            if (!allowedAdminEmail) {
                console.error("VITE_ADMIN_EMAIL is not set in .env!");
                alert("Configuration Error: The Admin Email is not configured in the server environment (.env). Please contact the developer.");
                return;
            }

            console.log("Checking Email:", user.email, "vs Allowed:", allowedAdminEmail); // DEBUG LOG

            if (user.email && user.email.toLowerCase() !== allowedAdminEmail.toLowerCase()) {
                console.warn("Unauthorized login attempt by:", user.email);
                alert(`ACCESS DENIED: The email '${user.email}' is not authorized to access this page.\nExpected: ${allowedAdminEmail}`);
                return;
            }

            console.log("Admin authentication successful via Firebase.");
            setIsAdminAuthenticated(true);
            setPasswordError(false);
        } catch (error) {
            console.error("Admin Login Failed:", error);
            setPasswordError(true);
            alert("Login Failed: " + error.code + "\nEnsure the user exists in Firebase Authentication.");
        }
    };

    // Filter users when search or users/online status changes
    useEffect(() => {
        if (isAdminAuthenticated) {
            fetchUsers();
        }
    }, [isAdminAuthenticated]);

    // Subscribe to online status
    useEffect(() => {
        if (!isAdminAuthenticated) return;

        const statusRef = ref(realtimeDb, 'status');
        const unsubscribe = onValue(statusRef, (snapshot) => {
            const data = snapshot.val();
            if (data) {
                // Convert { uid: {online: true, ...} } to { uid: true/false }
                const onlineMap = {};
                Object.keys(data).forEach(uid => {
                    onlineMap[uid] = data[uid].online === true;
                });
                setOnlineUsers(onlineMap);
            } else {
                setOnlineUsers({});
            }
        });

        return () => unsubscribe();
    }, [isAdminAuthenticated]);


    // Filter users when search or users/online status changes
    useEffect(() => {
        const term = searchTerm.toLowerCase();
        let filtered = users.map(u => ({
            ...u,
            isOnline: onlineUsers[u.uid] || false
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
                <SEOHead title="Admin Login | Bichat" noindex={true} />
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
                                sx={{ mt: 3, mb: 2, py: 1.5, fontWeight: 'bold' }}
                            >
                                Enter Dashboard
                            </Button>
                        </Box>
                    </Paper>
                </Container>
            </>
        );
    }

    return (
        <>
            <SEOHead title="Admin Dashboard | Bichat" noindex={true} />
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
                                            <Chip label={`🪙 ${u.coins || 0}`} size="small" variant="outlined" sx={{ borderColor: '#FFD700', color: '#b29600' }} />
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
                                            {u.isOnline ? (
                                                <Chip
                                                    icon={<Circle sx={{ fontSize: '0.6rem !important', color: '#235a25ff' }} />}
                                                    label="Online"
                                                    sx={{
                                                        borderColor: '#4caf50',
                                                        color: '#2e7d32',
                                                        bgcolor: 'rgba(107, 205, 110, 0.33)'
                                                    }}
                                                    size="small"
                                                    variant="outlined"
                                                />
                                            ) : (
                                                <Chip label="Offline" size="small" variant="outlined" color="default" />
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
                    Total Users: {users.length} | Showing: {filteredUsers.length}
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
            </Container>
        </>
    );
};

export default AdminUserList;
