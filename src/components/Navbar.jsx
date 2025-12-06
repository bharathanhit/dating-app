import { useState, useEffect } from 'react';
import { AppBar, Toolbar, Typography, Button, IconButton, Drawer, List, ListItem, ListItemIcon, ListItemText, Box, Divider, Badge, Chip, Tooltip } from '@mui/material';
import { Person, Message, Favorite, Menu as MenuIcon, Home as HomeIcon, Close as CloseIcon, Logout as LogoutIcon, Notifications, MonetizationOn } from '@mui/icons-material';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { subscribeToLikedBy } from '../services/userService';

const Navbar = () => {
  const [open, setOpen] = useState(false);
  const { user, logout, coins } = useAuth();
  const navigate = useNavigate();
  const [likeCount, setLikeCount] = useState(0);

  useEffect(() => {
    let unsubscribe = () => { };

    if (user?.uid) {
      unsubscribe = subscribeToLikedBy(user.uid, (profiles) => {
        setLikeCount(profiles.length);
      });
    }

    return () => {
      unsubscribe();
    };
  }, [user?.uid]);

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
      setOpen(false);
    } catch (err) {
      console.error('Failed to logout:', err);
    }
  };

  const navItems = [
    {
      text: 'Who Liked Me',
      to: { pathname: '/likes', state: { tab: 1 } },
      icon: (
        <Badge badgeContent={likeCount} color="error">
          <Notifications />
        </Badge>
      )
    },
    { text: 'Profile', to: '/profile', icon: <Person /> },
  ];

  return (
    <>
      <AppBar position="static" sx={{ mb: { xs: 1, sm: 2 } }}>
        <Toolbar sx={{ px: { xs: 1, sm: 2 }, minHeight: { xs: 56, sm: 64 } }}>
          <Typography
            variant="h6"
            component={Link}
            to="/"
            sx={{
              flexGrow: 1,
              textDecoration: 'none',
              color: 'white',
              fontSize: { xs: '1.2rem', sm: '1.5rem' },
            }}
          >
            BIXSOL
          </Typography>

          {/* Coin Balance - Show for logged in users */}
          {user && (
            <Tooltip title="Buy Coins" placement="bottom">
              <Chip
                icon={<MonetizationOn sx={{ color: '#FFD700 !important' }} />}
                label={coins || 0}
                onClick={() => navigate('/coins')}
                sx={{
                  mr: 2,
                  background: 'linear-gradient(135deg, #FFD700 0%, #FFA500 100%)',
                  color: '#000',
                  fontWeight: 700,
                  fontSize: { xs: '0.9rem', sm: '1rem' },
                  cursor: 'pointer',
                  border: '2px solid #FFD700',
                  boxShadow: '0 2px 8px rgba(255, 215, 0, 0.3)',
                  '&:hover': {
                    background: 'linear-gradient(135deg, #FFA500 0%, #FFD700 100%)',
                    boxShadow: '0 4px 12px rgba(255, 215, 0, 0.5)',
                  },
                }}
              />
            </Tooltip>
          )}

          {/* Desktop buttons: hide on small screens */}
          <Box sx={{ display: { xs: 'none', md: 'flex' }, alignItems: 'center', gap: 1 }}>
            {user ? (
              <>
                <IconButton
                  component={Link}
                  to="/notifications"
                  color="inherit"
                  aria-label="notifications"
                  title="Notifications"
                >
                  <Badge badgeContent={likeCount} color="error">
                    <Notifications />
                  </Badge>
                </IconButton>
                <IconButton component={Link} to="/profile" color="inherit" aria-label="profile" title="Profile">
                  <Person />
                </IconButton>
                <Button color="inherit" onClick={handleLogout} variant="outlined" sx={{ borderColor: 'rgba(255,255,255,0.2)' }}>
                  Logout
                </Button>
              </>
            ) : (
              <>
                <Button color="inherit" component={Link} to="/login" variant="outlined" sx={{ borderColor: 'rgba(255,255,255,0.2)' }}>
                  Login
                </Button>
                <Button color="inherit" component={Link} to="/signup" variant="contained">
                  Sign Up
                </Button>
              </>
            )}
          </Box>

          {/* Mobile menu button: shown on tablet and small screens */}
          <IconButton
            color="inherit"
            edge="end"
            sx={{ display: { xs: 'inline-flex', md: 'none' } }}
            onClick={() => setOpen(true)}
            aria-label="open menu"
          >
            <MenuIcon />
          </IconButton>
        </Toolbar>
      </AppBar>

      <Drawer anchor="right" open={open} onClose={() => setOpen(false)}>
        <Box sx={{ width: 280 }} role="presentation">
          <Box sx={{ display: 'flex', justifyContent: 'flex-start', p: 1 }}>
            <IconButton onClick={() => setOpen(false)} aria-label="close menu">
              <CloseIcon />
            </IconButton>
          </Box>

          {/* Coin Balance in Mobile Menu */}
          {user && (
            <Box sx={{ px: 2, pb: 2 }}>
              <Chip
                icon={<MonetizationOn sx={{ color: '#FFD700 !important' }} />}
                label={`${coins || 0} Coins`}
                onClick={() => {
                  navigate('/coins');
                  setOpen(false);
                }}
                sx={{
                  width: '100%',
                  background: 'linear-gradient(135deg, #FFD700 0%, #FFA500 100%)',
                  color: '#000',
                  fontWeight: 700,
                  fontSize: '1rem',
                  py: 2,
                  cursor: 'pointer',
                  border: '2px solid #FFD700',
                  boxShadow: '0 2px 8px rgba(255, 215, 0, 0.3)',
                  '&:hover': {
                    background: 'linear-gradient(135deg, #FFA500 0%, #FFD700 100%)',
                    boxShadow: '0 4px 12px rgba(255, 215, 0, 0.5)',
                  },
                }}
              />
            </Box>
          )}

          <List>
            {user && navItems.map((item) => (
              <ListItem
                button
                key={item.text}
                component={Link}
                to={item.to}
                onClick={() => setOpen(false)}
                sx={{ '&:hover': { backgroundColor: 'rgba(0, 0, 0, 0.04)' } }}
              >
                <ListItemIcon>{item.icon}</ListItemIcon>
                <ListItemText primary={item.text} />
              </ListItem>
            ))}
            {user && <Divider />}
            {user ? (
              <ListItem
                button
                onClick={handleLogout}
                sx={{ '&:hover': { backgroundColor: 'rgba(0, 0, 0, 0.04)' } }}
              >
                <ListItemIcon><LogoutIcon /></ListItemIcon>
                <ListItemText primary="Logout" />
              </ListItem>
            ) : (
              <>
                <ListItem
                  button
                  component={Link}
                  to="/login"
                  onClick={() => setOpen(false)}
                  sx={{ '&:hover': { backgroundColor: 'rgba(0, 0, 0, 0.04)' } }}
                >
                  <ListItemIcon><Person /></ListItemIcon>
                  <ListItemText primary="Login" />
                </ListItem>
                <ListItem
                  button
                  component={Link}
                  to="/signup"
                  onClick={() => setOpen(false)}
                  sx={{ '&:hover': { backgroundColor: 'rgba(0, 0, 0, 0.04)' } }}
                >
                  <ListItemIcon><Person /></ListItemIcon>
                  <ListItemText primary="Sign Up" />
                </ListItem>
              </>
            )}
          </List>
        </Box>
      </Drawer>
    </>
  );
};

export default Navbar;



