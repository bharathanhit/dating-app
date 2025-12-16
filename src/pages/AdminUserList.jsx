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
    Button
} from '@mui/material';
import { Search, Refresh, Block, Delete, ContentCopy, Email } from '@mui/icons-material';
import { getAllUserProfiles } from '../services/userService';
import { useAuth } from '../context/AuthContext';
import SEOHead from '../components/SEOHead';

const AdminUserList = () => {
    const { user } = useAuth();
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [filteredUsers, setFilteredUsers] = useState([]);

    const fetchUsers = async () => {
        setLoading(true);
        try {
            const allUsers = await getAllUserProfiles();
            setUsers(allUsers);
            setFilteredUsers(allUsers);
        } catch (error) {
            console.error("Failed to fetch users:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchUsers();
    }, []);

    useEffect(() => {
        const term = searchTerm.toLowerCase();
        const filtered = users.filter(u =>
            (u.name && u.name.toLowerCase().includes(term)) ||
            (u.email && u.email.toLowerCase().includes(term)) ||
            (u.uid && u.uid.toLowerCase().includes(term))
        );
        setFilteredUsers(filtered);
    }, [searchTerm, users]);

    const copyToClipboard = (text) => {
        navigator.clipboard.writeText(text);
        // You could add a snackbar here
    };

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
                                <TableCell>Stats</TableCell>
                                <TableCell>Status</TableCell>
                                <TableCell>UID (Ref)</TableCell>
                                {/* <TableCell align="right">Actions</TableCell> */}
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
                                            <Chip label={`🪙 ${u.coins || 0}`} size="small" variant="outlined" sx={{ mr: 1, borderColor: '#FFD700', color: '#b29600' }} />
                                        </TableCell>
                                        <TableCell>
                                            {u.isBlocked ? (
                                                <Chip label="Blocked" color="error" size="small" />
                                            ) : (
                                                <Chip label="Active" color="success" size="small" variant="outlined" />
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
                                        {/* Actions can be added here later */}
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </TableContainer>

                <Typography variant="caption" display="block" sx={{ mt: 2, textAlign: 'center', color: 'text.secondary' }}>
                    Total Users: {users.length} | Showing: {filteredUsers.length}
                </Typography>
            </Container>
        </>
    );
};

export default AdminUserList;
