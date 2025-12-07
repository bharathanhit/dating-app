import { Container, Typography, Box, Paper, Divider } from '@mui/material';
import SEOHead from '../components/SEOHead';

const RefundPolicyPage = () => {
    return (
        <>
            <SEOHead
                title="Refund and Cancellation Policy | Bichat"
                description="Read our Refund and Cancellation Policy regarding transactions, cancellations, and returns on Bichat."
                url="https://bichat-make-friendswith-bichat.netlify.app/refund-policy"
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
                            Refund and Cancellation Policy
                        </Typography>
                        <Typography variant="subtitle1" gutterBottom sx={{ color: 'text.secondary', mb: 4 }}>
                            Last updated: {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                        </Typography>

                        <Box sx={{ typography: 'body1', color: '#333', lineHeight: 1.7 }}>
                            <p>
                                Upon completing a Transaction, you are entering into a legally binding and enforceable agreement with us to purchase the product and/or service. After this point the User may cancel the Transaction unless it has been specifically provided for on the Platform. In which case, the cancellation will be subject to the terms mentioned on the Platform.
                            </p>

                            <Typography variant="h6" sx={{ fontWeight: 700, mt: 3, mb: 1 }}>
                                Cancellation Requests
                            </Typography>
                            <p>
                                We shall retain the discretion in approving any cancellation requests and we may ask for additional details before approving any requests.
                            </p>

                            <Typography variant="h6" sx={{ fontWeight: 700, mt: 3, mb: 1 }}>
                                Returns and Replacements
                            </Typography>
                            <p>
                                Once you have received the product and/or service, the only event where you can request for a replacement or a return and a refund is if the product and/or service does not match the description as mentioned on the Platform.
                            </p>

                            <Typography variant="h6" sx={{ fontWeight: 700, mt: 3, mb: 1 }}>
                                Refund Timeline
                            </Typography>
                            <p>
                                Any request for refund must be submitted within three days from the date of the Transaction or such number of days prescribed on the Platform, which shall in no event be less than three days.
                            </p>

                            <Typography variant="h6" sx={{ fontWeight: 700, mt: 3, mb: 1 }}>
                                How to Request a Refund
                            </Typography>
                            <p>
                                A User may submit a claim for a refund for a purchase made, by raising a ticket here or contacting us on <strong>seller+3d44a184915446dab5537b61ebaa1622@instamojo.com</strong> and providing a clear and specific reason for the refund request, including the exact terms that have been violated, along with any proof, if required.
                            </p>
                            <p>
                                Whether a refund will be provided will be determined by us, and we may ask for additional details before approving any requests.
                            </p>
                        </Box>

                        <Divider sx={{ my: 6 }} />

                        <Typography variant="body2" color="text.secondary" align="center">
                            © {new Date().getFullYear()} Bichat. All rights reserved.
                        </Typography>
                    </Paper>
                </Container>
            </Box>
        </>
    );
};

export default RefundPolicyPage;
