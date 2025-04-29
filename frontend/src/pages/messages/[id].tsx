import React, { useEffect } from 'react';
import { useRouter } from 'next/router';
import { Box, Container, Typography, useMediaQuery, Theme } from '@mui/material';
import { useMessaging } from '../../hooks/messaging/useMessaging';
import ConversationPanel from '../../components/messaging/ConversationPanel';
import ConversationList from '../../components/messaging/ConversationList';
import withProtection from '../../components/auth/withProtection';

const MessageDetailPage: React.FC = () => {
  const router = useRouter();
  const { id } = router.query;
  const isMobile = useMediaQuery((theme: Theme) => theme.breakpoints.down('md'));
  const [
    { conversations, loading, error },
    { getConversations, selectConversation }
  ] = useMessaging();

  // Ensure conversations are loaded
  useEffect(() => {
    getConversations();
  }, [getConversations]);

  // Validate the conversation ID
  useEffect(() => {
    if (!loading && id && conversations.length > 0) {
      const conversationExists = conversations.some(c => c.conversationId === id);
      if (!conversationExists) {
        router.replace('/messages');
      }
    }
  }, [id, conversations, loading, router]);

  // If ID is not available yet, show loading
  if (!id) {
    return null;
  }

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
        {/* Mobile view - only show conversation panel */}
        {isMobile ? (
          <Box sx={{ width: '100%' }}>
            <ConversationPanel 
              conversationId={id as string} 
              onMobileBack={() => router.push('/messages')}
              isMobile
            />
          </Box>
        ) : (
          // Desktop view - show both list and panel
          <>
            <Box 
              sx={{ 
                width: 320, 
                flexShrink: 0, 
                borderRight: '1px solid rgba(0, 0, 0, 0.12)' 
              }}
            >
              <ConversationList selectedId={id as string} />
            </Box>
            <Box sx={{ flexGrow: 1 }}>
              <ConversationPanel conversationId={id as string} />
            </Box>
          </>
        )}
      </Box>
    </Container>
  );
};

export default withProtection(MessageDetailPage);
