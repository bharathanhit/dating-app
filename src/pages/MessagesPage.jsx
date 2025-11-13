import { Container, Grid, Paper, Typography, Avatar, Box } from '@mui/material';

const MessagesPage = () => {
  // Mock messages data - in a real app, this would come from an API
  const mockMessages = [
    {
      id: 1,
      name: 'Jane Doe',
      lastMessage: 'Hey, how are you?',
      avatar: 'https://via.placeholder.com/80'
    },
    {
      id: 2,
      name: 'John Smith',
      lastMessage: 'Would you like to grab coffee sometime?',
      avatar: 'https://via.placeholder.com/80'
    }
  ];

  return (
    <Container maxWidth="lg" sx={{ pb: { xs: 12, sm: 10 } }}>
      <Typography variant="h4" sx={{ mb: 4, mt: 2, fontSize: { xs: '1.75rem', sm: '2.125rem' } }}>
        Messages
      </Typography>
      <Grid container spacing={{ xs: 1, sm: 2 }}>
        {mockMessages.map((message) => (
          <Grid item xs={12} key={message.id}>
            <Paper
              sx={{
                p: { xs: 1.5, sm: 2 },
                display: 'flex',
                alignItems: 'center',
                cursor: 'pointer',
                '&:hover': { bgcolor: 'action.hover' },
                transition: 'all 0.3s ease',
              }}
            >
              <Avatar
                src={message.avatar}
                sx={{
                  mr: { xs: 1, sm: 2 },
                  width: { xs: 44, sm: 56 },
                  height: { xs: 44, sm: 56 },
                }}
              />
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography variant="subtitle1" sx={{ fontSize: { xs: '0.95rem', sm: '1.1rem' } }}>
                  {message.name}
                </Typography>
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{
                    fontSize: { xs: '0.8rem', sm: '0.875rem' },
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {message.lastMessage}
                </Typography>
              </Box>
            </Paper>
          </Grid>
        ))}
      </Grid>
    </Container>
  );
};

export default MessagesPage;