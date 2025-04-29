import React, { useEffect, useRef, useState } from 'react';
import { 
  Box, 
  Paper, 
  TextField, 
  IconButton, 
  Typography, 
  Avatar, 
  CircularProgress,
  Tooltip,
  Divider
} from '@mui/material';
import { 
  Send as SendIcon, 
  Image as ImageIcon, 
  MoreVert as MoreVertIcon,
  ArrowBack as ArrowBackIcon
} from '@mui/icons-material';
import { useRouter } from 'next/router';
import { useAuth } from '../../hooks/auth/useAuth';
import { useMessaging } from '../../hooks/messaging/useMessaging';
import MessageBubble from './MessageBubble';
import { Message, MessageType, TypingIndicator } from '../../lib/messaging/types';

interface ConversationPanelProps {
  conversationId: string;
  onMobileBack?: () => void;
  isMobile?: boolean;
}

const ConversationPanel: React.FC<ConversationPanelProps> = ({
  conversationId,
  onMobileBack,
  isMobile = false,
}) => {
  const router = useRouter();
  const { user } = useAuth();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [newMessage, setNewMessage] = useState('');
  
  const [
    { messages, loading, error, typing, conversations },
    { selectConversation, sendMessage, deleteMessage, sendTypingIndicator }
  ] = useMessaging();
  
  // Get the current conversation messages
  const conversationMessages = messages[conversationId] || [];
  
  // Get conversation info
  const conversation = conversations.find(c => c.conversationId === conversationId);
  const participantId = conversation?.participantIds.find(id => id !== user?.id);
  
  // Get typing indicators for this conversation
  const isTyping = typing.some(t => 
    t.conversationId === conversationId && t.userId !== user?.id
  );
  
  // Load the conversation when the ID changes
  useEffect(() => {
    if (!conversationId) return;
    selectConversation(conversationId);
  }, [conversationId, selectConversation]);
  
  // Scroll to bottom when messages change
  useEffect(() => {
    scrollToBottom();
  }, [conversationMessages]);
  
  // Scroll to bottom of messages
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };
  
  // Handle sending a new message
  const handleSendMessage = () => {
    if (!newMessage.trim()) return;
    
    sendMessage(newMessage.trim());
    setNewMessage('');
  };
  
  // Handle input changes and typing indicator
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNewMessage(e.target.value);
    
    // Send typing indicator
    if (e.target.value.length > 0) {
      sendTypingIndicator(true);
    } else {
      sendTypingIndicator(false);
    }
  };
  
  // Handle key press (send on Enter)
  const handleKeyPress = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };
  
  // Handle message deletion
  const handleDeleteMessage = (messageId: string) => {
    deleteMessage(messageId);
  };
  
  // Render message bubbles
  const renderMessages = () => {
    if (conversationMessages.length === 0 && !loading) {
      return (
        <Box sx={{ 
          display: 'flex', 
          flexDirection: 'column', 
          alignItems: 'center', 
          justifyContent: 'center',
          p: 4,
          height: '100%'
        }}>
          <Typography variant="body1" color="textSecondary" align="center">
            No messages yet
          </Typography>
          <Typography variant="body2" color="textSecondary" align="center">
            Start the conversation with a message!
          </Typography>
        </Box>
      );
    }
    
    return (
      <>
        {conversationMessages.map((message, index) => {
          const isMine = message.senderId === user?.id;
          const showAvatar = index === 0 || 
            (index > 0 && conversationMessages[index - 1].senderId !== message.senderId);
          
          // TODO: Get real sender name and photo from profiles
          // For now, use a placeholder
          const senderName = isMine ? 'You' : `Match ${message.senderId.substring(0, 6)}`;
          
          return (
            <MessageBubble
              key={message.messageId}
              message={message}
              isMine={isMine}
              senderName={senderName}
              showAvatar={showAvatar}
              onDelete={handleDeleteMessage}
            />
          );
        })}
        
        {/* Typing indicator */}
        {isTyping && (
          <Box sx={{ display: 'flex', alignItems: 'center', ml: 2, mb: 2 }}>
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                p: 1,
                borderRadius: 2,
                backgroundColor: 'grey.100',
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <Box
                  sx={{
                    width: 8,
                    height: 8,
                    backgroundColor: 'grey.500',
                    borderRadius: '50%',
                    mr: 0.5,
                    animation: 'pulse 1s infinite',
                    '@keyframes pulse': {
                      '0%': { opacity: 0.4 },
                      '50%': { opacity: 1 },
                      '100%': { opacity: 0.4 },
                    },
                  }}
                />
                <Box
                  sx={{
                    width: 8,
                    height: 8,
                    backgroundColor: 'grey.500',
                    borderRadius: '50%',
                    mr: 0.5,
                    animation: 'pulse 1s infinite 0.2s',
                  }}
                />
                <Box
                  sx={{
                    width: 8,
                    height: 8,
                    backgroundColor: 'grey.500',
                    borderRadius: '50%',
                    animation: 'pulse 1s infinite 0.4s',
                  }}
                />
              </Box>
            </Box>
          </Box>
        )}
        
        <div ref={messagesEndRef} />
      </>
    );
  };
  
  // Get participant name from conversation
  const getParticipantName = () => {
    // TODO: Get real participant name from profile
    return participantId ? `Match ${participantId.substring(0, 6)}` : 'Loading...';
  };
  
  return (
    <Paper 
      elevation={0} 
      sx={{ 
        display: 'flex', 
        flexDirection: 'column', 
        height: '100%', 
        overflow: 'hidden' 
      }}
    >
      {/* Conversation header */}
      <Box 
        sx={{ 
          p: 2, 
          display: 'flex', 
          alignItems: 'center', 
          borderBottom: '1px solid rgba(0, 0, 0, 0.12)' 
        }}
      >
        {isMobile && (
          <IconButton edge="start" onClick={onMobileBack} sx={{ mr: 1 }}>
            <ArrowBackIcon />
          </IconButton>
        )}
        
        <Avatar sx={{ mr: 2 }}>
          {getParticipantName().charAt(0)}
        </Avatar>
        
        <Box sx={{ flexGrow: 1 }}>
          <Typography variant="subtitle1">{getParticipantName()}</Typography>
          {isTyping && (
            <Typography variant="caption" color="primary">
              Typing...
            </Typography>
          )}
        </Box>
        
        <IconButton edge="end">
          <MoreVertIcon />
        </IconButton>
      </Box>
      
      {/* Messages area */}
      <Box 
        sx={{ 
          flexGrow: 1, 
          overflow: 'auto', 
          p: 2,
          backgroundColor: '#f5f8fa',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {loading && conversationMessages.length === 0 ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
            <CircularProgress />
          </Box>
        ) : error ? (
          <Box sx={{ p: 2, textAlign: 'center' }}>
            <Typography color="error">{error}</Typography>
            <Typography variant="body2" color="textSecondary">
              There was a problem loading messages.
            </Typography>
          </Box>
        ) : (
          renderMessages()
        )}
      </Box>
      
      {/* Message input */}
      <Box sx={{ p: 2, borderTop: '1px solid rgba(0, 0, 0, 0.12)' }}>
        <Box sx={{ display: 'flex', alignItems: 'flex-end' }}>
          <Tooltip title="Send image">
            <IconButton sx={{ mr: 1 }}>
              <ImageIcon />
            </IconButton>
          </Tooltip>
          
          <TextField
            fullWidth
            variant="outlined"
            placeholder="Type a message..."
            value={newMessage}
            onChange={handleInputChange}
            onKeyPress={handleKeyPress}
            multiline
            maxRows={4}
            sx={{ mr: 1 }}
            InputProps={{
              sx: { borderRadius: 4 }
            }}
          />
          
          <IconButton 
            color="primary" 
            onClick={handleSendMessage}
            disabled={!newMessage.trim()}
          >
            <SendIcon />
          </IconButton>
        </Box>
      </Box>
    </Paper>
  );
};

export default ConversationPanel;
