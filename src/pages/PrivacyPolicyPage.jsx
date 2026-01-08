import { Container, Typography, Box, Paper, Divider } from '@mui/material';
import SEOHead from '../components/SEOHead';

const PrivacyPolicyPage = () => {
    return (
        <>
            <SEOHead
                title="Privacy Policy | BiChat"
                description="Learn how BiChat collects, uses, and protects your personal data."
                url="https://bi-chat.online/privacy"
            />
            <Box
                sx={{
                    minHeight: '100vh',
                    background: 'white',
                    pt: { xs: 10, md: 12 },
                    pb: 12
                }}
            >
                <Container maxWidth="md">
                    <Paper elevation={0} sx={{ p: 0 }}>
                        <Typography variant="h3" component="h1" gutterBottom sx={{ fontWeight: 800, color: '#1a1a1a' }}>
                            Privacy Policy
                        </Typography>
                        <Typography variant="subtitle1" gutterBottom sx={{ color: 'text.secondary', mb: 4 }}>
                            Last updated: December 06, 2025
                        </Typography>

                        <Box sx={{ typography: 'body1', color: '#333', lineHeight: 1.7 }}>
                            <p>
                                At BiChat, we value your privacy and are committed to protecting your personal information. This Privacy Policy explains how we collect, use, and safeguard your data when you use our website and services.
                            </p>

                            <Typography variant="h5" sx={{ fontWeight: 700, mt: 4, mb: 2 }}>
                                1. Information We Collect
                            </Typography>
                            <p>
                                We collect information you provide directly to us, such as when you create an account, update your profile, or communicate with other users. This may include:
                            </p>
                            <ul>
                                <li>Your name, email address, and profile details.</li>
                                <li>Content of messages you send to other users (encrypted).</li>
                                <li>Photos and other media you upload.</li>
                            </ul>

                            <Typography variant="h5" sx={{ fontWeight: 700, mt: 4, mb: 2 }}>
                                2. How We Use Your Information
                            </Typography>
                            <p>
                                We use the information we collect to:
                            </p>
                            <ul>
                                <li>Provide, maintain, and improve our services.</li>
                                <li>Facilitate communication between users.</li>
                                <li>Ensure the safety and security of our platform.</li>
                                <li>Send you technical notices and support messages.</li>
                            </ul>

                            <Typography variant="h5" sx={{ fontWeight: 700, mt: 4, mb: 2 }}>
                                3. Data Security
                            </Typography>
                            <p>
                                We implement appropriate security measures to protect your personal information from unauthorized access, alteration, disclosure, or destruction. However, no method of transmission over the internet is 100% secure.
                            </p>

                            <Typography variant="h5" sx={{ fontWeight: 700, mt: 4, mb: 2 }}>
                                4. Contact Us
                            </Typography>
                            <p>
                                If you have any questions about this Privacy Policy, please contact us at <strong>support@bichat.com</strong>.
                            </p>
                        </Box>

                        <Divider sx={{ my: 6 }} />

                        <Box sx={{ display: 'flex', justifyContent: 'center', gap: 3, mb: 4, flexWrap: 'wrap' }}>
                            <Typography
                                variant="body2"
                                component="a"
                                href="/refund-policy"
                                sx={{
                                    color: 'text.secondary',
                                    textDecoration: 'none',
                                    '&:hover': { color: 'primary.main', textDecoration: 'underline' }
                                }}
                            >
                                Refund Policy
                            </Typography>
                            <Typography
                                variant="body2"
                                component="a"
                                href="/terms"
                                sx={{
                                    color: 'text.secondary',
                                    textDecoration: 'none',
                                    '&:hover': { color: 'primary.main', textDecoration: 'underline' }
                                }}
                            >
                                Terms and Conditions
                            </Typography>
                        </Box>

                        <Typography variant="body2" color="text.secondary" align="center">
                            © {new Date().getFullYear()} BiChat. All rights reserved.
                        </Typography>
                    </Paper>
                </Container>
            </Box>
        </>
    );
};

export default PrivacyPolicyPage;
