import { useState, useEffect } from 'react';
import { AppBar, Toolbar, Typography, Button, IconButton, Drawer, List, ListItem, ListItemIcon, ListItemText, Box, Divider, Badge, Chip, Tooltip } from '@mui/material';
import { Person, Message, Favorite, Menu as MenuIcon, Home as HomeIcon, Close as CloseIcon, Logout as LogoutIcon, Notifications, MonetizationOn, ContactSupport, PrivacyTip, Chat } from '@mui/icons-material';
import { Link, useNavigate } from 'react-router-dom';

import { useAuth } from '../context/AuthContext.jsx';

const Navbar = () => {
  const [open, setOpen] = useState(false);
  const { user, logout, coins, likeCount } = useAuth();
  const navigate = useNavigate();

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
          <Box
            component={Link}
            to="/"
            sx={{
              flexGrow: 1,
              display: 'flex',
              alignItems: 'center',
              textDecoration: 'none',
            }}
          >
            <Typography
              variant="h4"
              component="span"
              sx={{
                fontWeight: 500, // Condensed font needs weight to stand out, but it's narrow
                // Gradient text: Navy -> Blurple -> Pink
                background: 'linear-gradient(45deg, #0d0d9cff, #a153eaff, #5d2b5fff)',
                backgroundSize: '200% auto',
                animation: 'gradient 8s linear infinite', // Slower interactive feel
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                // Fallback color
                color: '#56136aff',
                WebkitTextStroke: '0px', // No stroke for clean condensed look
                letterSpacing: '0px',
                display: 'flex',
                alignItems: 'center',
                fontFamily: '"Roboto Condensed", sans-serif',
                position: 'relative',
                // Responsive font size
                fontSize: { xs: '1.5rem', sm: '1.75rem', md: '2rem' },
                '@keyframes gradient': {
                  '0%': { backgroundPosition: '0% 50%' },
                  '50%': { backgroundPosition: '100% 50%' },
                  '100%': { backgroundPosition: '0% 50%' },
                },
              }}
            >
              Bich
              <Box component="span" sx={{ position: 'relative', display: 'inline-flex', alignItems: 'center', ml: '1px', mr: '1px', mt: { xs: '4px', md: '9px' } }}>
                <Chat sx={{
                  fontSize: '0.8em',
                  // Make icon match gradient or white? User had it white. 
                  // Let's keep it white to stand out, or apply gradient?
                  // Providing white with drop shadow as before but maybe refined.
                  color: 'white',
                  filter: 'drop-shadow(0px 2px 2px rgba(255, 243, 243, 0.1))'
                }} />

              </Box>
              t
            </Typography>
          </Box>

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
                <IconButton component={Link} to="/contact" color="inherit" aria-label="contact" title="Contact Us">
                  <ContactSupport />
                </IconButton>
                <IconButton component={Link} to="/privacy" color="inherit" aria-label="privacy" title="Privacy Policy">
                  <PrivacyTip />
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
            <ListItem
              button
              component={Link}
              to="/contact"
              onClick={() => setOpen(false)}
              sx={{ '&:hover': { backgroundColor: 'rgba(0, 0, 0, 0.04)' } }}
            >
              <ListItemIcon><ContactSupport /></ListItemIcon>
              <ListItemText primary="Contact Us" />
            </ListItem>
            <ListItem
              button
              component={Link}
              to="/privacy"
              onClick={() => setOpen(false)}
              sx={{ '&:hover': { backgroundColor: 'rgba(0, 0, 0, 0.04)' } }}
            >
              <ListItemIcon><PrivacyTip /></ListItemIcon>
              <ListItemText primary="Privacy Policy" />
            </ListItem>
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



