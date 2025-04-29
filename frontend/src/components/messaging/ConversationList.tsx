import React, { useEffect } from 'react';
import { useRouter } from 'next/router';
import { 
  List, 
  ListItem, 
  ListItemAvatar, 
  Avatar, 
  ListItemText, 
  Typography,
  Box,
  Badge,
  Divider,
  CircularProgress,
  Paper
} from '@mui/material';
import { formatDistanceToNow } from 'date-fns';
import { useMessaging } from '../../hooks/messaging/useMessaging';
import { Conversation } from '../../lib/messaging/types';

interface ConversationListProps {
  selectedId?: string;
}

const ConversationList: React.FC<ConversationListProps> = ({ selectedId }) => {
  const router = useRouter();
  const [
    { conversations, loading, error },
    { getConversations }
  ] = useMessaging();

  // Load conversations on mount
  useEffect(() => {
    getConversations();
  }, [getConversations]);

  // Handle conversation selection
  const handleSelectConversation = (conversationId: string) => {
    router.push(`/messages/${conversationId}`);
  };

  if (loading && conversations.length === 0) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" height="100%">
        <CircularProgress />
      </Box>
    );
  }

  if (error && conversations.length === 0) {
    return (
      <Box p={2} textAlign="center">
        <Typography color="error">{error}</Typography>
        <Typography variant="body2" color="textSecondary">
          There was a problem loading your conversations.
        </Typography>
      </Box>
    );
  }

  if (conversations.length === 0) {
    return (
      <Box p={2} textAlign="center">
        <Typography variant="body1">No conversations yet</Typography>
        <Typography variant="body2" color="textSecondary">
          Match with someone to start messaging!
        </Typography>
      </Box>
    );
  }

  return (
    <Paper elevation={0} sx={{ height: '100%', overflow: 'auto', borderRight: '1px solid rgba(0, 0, 0, 0.12)' }}>
      <List disablePadding>
        {conversations.map((conversation) => (
          <React.Fragment key={conversation.conversationId}>
            <ListItem
              button
              selected={conversation.conversationId === selectedId}
              onClick={() => handleSelectConversation(conversation.conversationId)}
              sx={{
                px: 2,
                py: 1.5,
                '&.Mui-selected': {
                  backgroundColor: 'rgba(25, 118, 210, 0.08)',
                },
              }}
            >
              <ConversationItem conversation={conversation} />
            </ListItem>
            <Divider component="li" />
          </React.Fragment>
        ))}
      </List>
    </Paper>
  );
};

interface ConversationItemProps {
  conversation: Conversation;
}

const ConversationItem: React.FC<ConversationItemProps> = ({ conversation }) => {
  // TODO: Get participant display name and photo from profile data
  const participantName = `Match ${conversation.participantIds[0].substring(0, 6)}`;
  
  // Format timestamp
  const timestamp = conversation.lastMessageSentAt 
    ? formatDistanceToNow(new Date(conversation.lastMessageSentAt), { addSuffix: true })
    : '';

  // Check if there are unread messages (to be implemented)
  const hasUnreadMessages = false;

  return (
    <>
      <ListItemAvatar>
        <Badge
          color="primary"
          variant="dot"
          invisible={!hasUnreadMessages}
          overlap="circular"
          anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        >
          <Avatar alt={participantName} src="/placeholder-avatar.jpg" />
        </Badge>
      </ListItemAvatar>
      <ListItemText
        primary={
          <Typography variant="subtitle2" noWrap>
            {participantName}
          </Typography>
        }
        secondary={
          <Typography variant="body2" color="textSecondary" noWrap>
            {conversation.lastMessagePreview || 'New conversation'}
          </Typography>
        }
      />
      <Box display="flex" flexDirection="column" alignItems="flex-end" minWidth={65}>
        {timestamp && (
          <Typography variant="caption" color="textSecondary">
            {timestamp}
          </Typography>
        )}
      </Box>
    </>
  );
};

export default ConversationList;
