import React, { useState } from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    RadioGroup,
    FormControlLabel,
    Radio,
    TextField,
    Typography,
    Box,
} from '@mui/material';

const REPORT_CATEGORIES = [
    'Inappropriate Content',
    'Harassment',
    'Spam',
    'Fake Profile',
    'Other',
];

const ReportDialog = ({ open, onClose, onSubmit, reportedUserName }) => {
    const [category, setCategory] = useState('');
    const [reason, setReason] = useState('');
    const [submitting, setSubmitting] = useState(false);

    const handleSubmit = async () => {
        if (!category) {
            alert('Please select a report category');
            return;
        }

        setSubmitting(true);
        try {
            await onSubmit(category, reason);
            // Reset form
            setCategory('');
            setReason('');
            onClose();
        } catch (error) {
            console.error('Error submitting report:', error);
            const errorMessage = error.message || 'Unknown error occurred';
            alert(`Failed to submit report: ${errorMessage}\n\nPlease try again or contact support if the issue persists.`);
        } finally {
            setSubmitting(false);
        }
    };

    const handleClose = () => {
        setCategory('');
        setReason('');
        onClose();
    };

    return (
        <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
            <DialogTitle>Report {reportedUserName || 'User'}</DialogTitle>
            <DialogContent>
                <Box sx={{ pt: 1 }}>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                        Please select a reason for reporting this user. All reports are reviewed by our team.
                    </Typography>

                    <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
                        Report Category *
                    </Typography>
                    <RadioGroup value={category} onChange={(e) => setCategory(e.target.value)}>
                        {REPORT_CATEGORIES.map((cat) => (
                            <FormControlLabel
                                key={cat}
                                value={cat}
                                control={<Radio />}
                                label={cat}
                            />
                        ))}
                    </RadioGroup>

                    <TextField
                        fullWidth
                        multiline
                        rows={3}
                        label="Additional Details (Optional)"
                        placeholder="Provide more information about why you're reporting this user..."
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        sx={{ mt: 2 }}
                    />
                </Box>
            </DialogContent>
            <DialogActions sx={{ px: 3, pb: 2 }}>
                <Button onClick={handleClose} disabled={submitting}>
                    Cancel
                </Button>
                <Button
                    onClick={handleSubmit}
                    variant="contained"
                    color="error"
                    disabled={submitting || !category}
                >
                    {submitting ? 'Submitting...' : 'Submit Report'}
                </Button>
            </DialogActions>
        </Dialog>
    );
};

export default ReportDialog;
