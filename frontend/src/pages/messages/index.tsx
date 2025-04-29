import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { 
  Box, 
  Container, 
  Typography, 
  Hidden, 
  useMediaQuery, 
  Theme, 
  Button, 
  Fab,
  Divider,
  CircularProgress
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { Chat as ChatIcon } from '@mui/icons-material';
import withProtection from '../../components/auth/withProtection';
import ConversationList from '../../components/messaging/ConversationList';
import ConversationPanel from '../../components/messaging/ConversationPanel';
import { useMessaging } from '../../hooks/messaging/useMessaging';

const MessagesPage: React.FC = () => {
  const theme = useTheme();
  const router = useRouter();
  const isMobile = useMediaQuery((theme: Theme) => theme.breakpoints.down('md'));
  const [showMobileConversation, setShowMobileConversation] = useState(false);
  const [
    { loading, conversations, error },
    { getConversations }
  ] = useMessaging();

  // On mobile, check if a conversation ID is in the URL
  useEffect(() => {
    if (isMobile && router.query.id) {
      setShowMobileConversation(true);
    }
  }, [router.query.id, isMobile]);

  // Handle mobile back button
  const handleMobileBack = () => {
    setShowMobileConversation(false);
    router.push('/messages', undefined, { shallow: true });
  };

  return (
    <Container maxWidth="lg" sx={{ height: 'calc(100vh - 64px)', py: 3 }}>
      <Typography variant="h4" component="h1" sx={{ mb: 3 }}>
        Messages
      </Typography>

      <Box
        sx={{
          height: 'calc(100% - 52px)',
          display: 'flex',
          borderRadius: 1,
          overflow: 'hidden',
          boxShadow: '0 0 10px rgba(0, 0, 0, 0.05)',
          border: '1px solid rgba(0, 0, 0, 0.1)',
        }}
      >
        {/* Mobile view */}
        {isMobile && (
          <>
            {showMobileConversation && router.query.id ? (
              <Box sx={{ width: '100%' }}>
                <ConversationPanel 
                  conversationId={router.query.id as string} 
                  onMobileBack={handleMobileBack}
                  isMobile
                />
              </Box>
            ) : (
              <Box sx={{ width: '100%' }}>
                <ConversationList selectedId={router.query.id as string} />
              </Box>
            )}
          </>
        )}

        {/* Desktop view */}
        {!isMobile && (
          <>
            <Box 
              sx={{ 
                width: 320, 
                flexShrink: 0, 
                borderRight: '1px solid rgba(0, 0, 0, 0.1)' 
              }}
            >
              <ConversationList selectedId={router.query.id as string} />
            </Box>

            <Box sx={{ flexGrow: 1 }}>
              {router.query.id ? (
                <ConversationPanel conversationId={router.query.id as string} />
              ) : (
                <Box 
                  sx={{ 
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    alignItems: 'center',
                    height: '100%',
                    p: 3,
                    backgroundColor: '#f5f8fa'
                  }}
                >
                  <ChatIcon 
                    color="disabled" 
                    sx={{ 
                      fontSize: 80, 
                      mb: 2 
                    }} 
                  />
                  <Typography variant="h6" color="textSecondary" align="center" gutterBottom>
                    Select a conversation
                  </Typography>
                  <Typography variant="body2" color="textSecondary" align="center">
                    Choose a conversation from the list to start messaging.
                  </Typography>
                </Box>
              )}
            </Box>
          </>
        )}
      </Box>
    </Container>
  );
};

export default withProtection(MessagesPage);
