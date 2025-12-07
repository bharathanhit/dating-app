import { useState } from 'react';
import { Container, Typography, Box, TextField, Button, Paper, Grid, Snackbar, Alert } from '@mui/material';
import { Send, Email, LocationOn } from '@mui/icons-material';
import SEOHead from '../components/SEOHead';

const ContactPage = () => {
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        message: ''
    });
    const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        // Start stub submission
        console.log('Form submitted:', formData);
        setSnackbar({ open: true, message: 'Message sent successfully! We will get back to you soon.', severity: 'success' });
        setFormData({ name: '', email: '', message: '' });
    };

    return (
        <>
            <SEOHead
                title="Contact Us | Bichat"
                description="Get in touch with the Bichat team. We are here to help you with any questions or feedback."
                url="https://bichat-make-friendswith-bichat.netlify.app/contact"
            />
            <Box
                sx={{
                    minHeight: '100vh',
                    background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)',
                    pt: 12, // Navbar spacing
                    pb: 12  // Footer spacing
                }}
            >
                <Container maxWidth="md">
                    <Paper
                        elevation={3}
                        sx={{
                            p: { xs: 3, md: 6 },
                            borderRadius: 4,
                            background: 'rgba(255, 255, 255, 0.9)',
                            backdropFilter: 'blur(10px)'
                        }}
                    >
                        <Grid container spacing={4}>
                            {/* Info Section */}
                            <Grid item xs={12} md={5}>
                                <Typography variant="h4" sx={{ fontWeight: 800, mb: 3, background: 'linear-gradient(45deg, #2196F3 30%, #21CBF3 90%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                                    Get in Touch
                                </Typography>
                                <Typography variant="body1" sx={{ color: 'text.secondary', mb: 4 }}>
                                    Have questions about Bichat or need support? Fill out the form and our team will respond within 24 hours.
                                </Typography>

                                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                                    <Email sx={{ color: 'primary.main', mr: 2 }} />
                                    <Typography variant="body2" fontWeight={500}>
                                        support@bichat.com
                                    </Typography>
                                </Box>
                                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                                    <LocationOn sx={{ color: 'primary.main', mr: 2 }} />
                                    <Typography variant="body2" fontWeight={500}>
                                        123 App Street, Tech City
                                    </Typography>
                                </Box>
                            </Grid>

                            {/* Form Section */}
                            <Grid item xs={12} md={7}>
                                <Box component="form" onSubmit={handleSubmit}>
                                    <Grid container spacing={2}>
                                        <Grid item xs={12}>
                                            <TextField
                                                fullWidth
                                                label="Your Name"
                                                name="name"
                                                value={formData.name}
                                                onChange={handleChange}
                                                required
                                                variant="outlined"
                                                sx={{ bgcolor: 'white' }}
                                            />
                                        </Grid>
                                        <Grid item xs={12}>
                                            <TextField
                                                fullWidth
                                                type="email"
                                                label="Email Address"
                                                name="email"
                                                value={formData.email}
                                                onChange={handleChange}
                                                required
                                                variant="outlined"
                                                sx={{ bgcolor: 'white' }}
                                            />
                                        </Grid>
                                        <Grid item xs={12}>
                                            <TextField
                                                fullWidth
                                                multiline
                                                rows={4}
                                                label="Message"
                                                name="message"
                                                value={formData.message}
                                                onChange={handleChange}
                                                required
                                                variant="outlined"
                                                sx={{ bgcolor: 'white' }}
                                            />
                                        </Grid>
                                        <Grid item xs={12}>
                                            <Button
                                                type="submit"
                                                variant="contained"
                                                size="large"
                                                endIcon={<Send />}
                                                fullWidth
                                                sx={{
                                                    mt: 1,
                                                    py: 1.5,
                                                    background: 'linear-gradient(45deg, #2196F3 30%, #21CBF3 90%)',
                                                    fontWeight: 700
                                                }}
                                            >
                                                Send Message
                                            </Button>
                                        </Grid>
                                    </Grid>
                                </Box>
                            </Grid>
                        </Grid>
                    </Paper>
                </Container>
            </Box>

            {/* Notification Snackbar */}
            <Snackbar
                open={snackbar.open}
                autoHideDuration={6000}
                onClose={() => setSnackbar({ ...snackbar, open: false })}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
            >
                <Alert onClose={() => setSnackbar({ ...snackbar, open: false })} severity={snackbar.severity} sx={{ width: '100%' }}>
                    {snackbar.message}
                </Alert>
            </Snackbar>
        </>
    );
};

export default ContactPage;
