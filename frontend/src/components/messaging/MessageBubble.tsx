import React from 'react';
import { 
  Box, 
  Typography, 
  Avatar,
  Paper,
  IconButton,
  Menu,
  MenuItem,
  Tooltip
} from '@mui/material';
import { 
  Check as CheckIcon, 
  DoneAll as DoneAllIcon, 
  MoreVert as MoreVertIcon,
  Image as ImageIcon,
  LocationOn as LocationIcon
} from '@mui/icons-material';
import { formatDistanceToNow } from 'date-fns';
import { Message, MessageStatus, MessageType } from '../../lib/messaging/types';

interface MessageBubbleProps {
  message: Message;
  isMine: boolean;
  senderName: string;
  senderPhoto?: string;
  onDelete?: (messageId: string) => void;
  showAvatar?: boolean;
}

const MessageBubble: React.FC<MessageBubbleProps> = ({
  message,
  isMine,
  senderName,
  senderPhoto,
  onDelete,
  showAvatar = true,
}) => {
  const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);
  
  // Format timestamp
  const timestamp = formatDistanceToNow(new Date(message.createdAt), { addSuffix: true });
  
  // Get message status
  const getStatusIcon = () => {
    // Only show status on my messages
    if (!isMine) return null;
    
    // Check if message is deleted
    if (message.isDeleted) return null;
    
    // Get the current status (using the first recipient for now)
    const statusValues = Object.values(message.deliveryStatus || {});
    if (statusValues.length === 0) return <CheckIcon fontSize="small" sx={{ opacity: 0.5 }} />;
    
    const allRead = statusValues.every(s => s.status === MessageStatus.READ);
    const allDelivered = statusValues.every(s => 
      s.status === MessageStatus.DELIVERED || s.status === MessageStatus.READ
    );
    
    if (allRead) return <DoneAllIcon fontSize="small" color="primary" />;
    if (allDelivered) return <DoneAllIcon fontSize="small" sx={{ opacity: 0.7 }} />;
    
    return <CheckIcon fontSize="small" sx={{ opacity: 0.5 }} />;
  };
  
  // Open menu
  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };
  
  // Close menu
  const handleMenuClose = () => {
    setAnchorEl(null);
  };
  
  // Delete message
  const handleDelete = () => {
    if (onDelete) {
      onDelete(message.messageId);
    }
    handleMenuClose();
  };
  
  // Render message content based on type
  const renderMessageContent = () => {
    // Check if message is deleted
    if (message.isDeleted) {
      return (
        <Typography variant="body2" sx={{ fontStyle: 'italic', opacity: 0.7 }}>
          This message has been deleted
        </Typography>
      );
    }
    
    // Render based on message type
    switch (message.type) {
      case MessageType.IMAGE:
        return (
          <Box>
            <Box 
              component="img" 
              src={message.content}
              alt="Image"
              sx={{ 
                maxWidth: '100%',
                maxHeight: 200,
                borderRadius: 1,
                display: 'block',
                mb: 1
              }}
            />
            {message.metadata?.caption && (
              <Typography variant="body2">{message.metadata.caption}</Typography>
            )}
          </Box>
        );
        
      case MessageType.LOCATION:
        return (
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <LocationIcon sx={{ mr: 1 }} />
            <Typography variant="body2">
              Shared a location
            </Typography>
          </Box>
        );
        
      case MessageType.SYSTEM:
        return (
          <Typography variant="body2" sx={{ fontStyle: 'italic' }}>
            {message.content}
          </Typography>
        );
        
      case MessageType.TEXT:
      default:
        return (
          <Typography variant="body2">{message.content}</Typography>
        );
    }
  };
  
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: isMine ? 'row-reverse' : 'row',
        alignItems: 'flex-end',
        mb: 2,
      }}
    >
      {!isMine && showAvatar ? (
        <Avatar
          src={senderPhoto}
          alt={senderName}
          sx={{ width: 36, height: 36, mr: 1 }}
        />
      ) : (
        <Box sx={{ width: 36, mr: isMine ? 0 : 1, ml: isMine ? 1 : 0 }} />
      )}
      
      <Box sx={{ maxWidth: '70%' }}>
        {!isMine && (
          <Typography variant="caption" sx={{ ml: 1, mb: 0.5, display: 'block' }}>
            {senderName}
          </Typography>
        )}
        
        <Box sx={{ display: 'flex', alignItems: 'flex-end', flexDirection: isMine ? 'row-reverse' : 'row' }}>
          <Paper
            elevation={0}
            sx={{
              p: 1.5,
              backgroundColor: isMine ? 'primary.main' : 'grey.100',
              color: isMine ? 'primary.contrastText' : 'text.primary',
              borderRadius: 2,
              borderTopRightRadius: isMine ? 0 : 2,
              borderTopLeftRadius: !isMine ? 0 : 2,
              position: 'relative',
            }}
          >
            {renderMessageContent()}
            
            <Box sx={{ 
              display: 'flex', 
              justifyContent: 'flex-end', 
              alignItems: 'center',
              mt: 0.5, 
              opacity: 0.7 
            }}>
              <Typography variant="caption" sx={{ mr: 0.5 }}>
                {timestamp}
              </Typography>
              {getStatusIcon()}
            </Box>
          </Paper>
          
          {isMine && !message.isDeleted && (
            <IconButton 
              size="small" 
              edge="end" 
              onClick={handleMenuOpen}
              sx={{ opacity: anchorEl ? 1 : 0, '&:hover': { opacity: 1 } }}
            >
              <MoreVertIcon fontSize="small" />
            </IconButton>
          )}
        </Box>
      </Box>
      
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
        transformOrigin={{ horizontal: 'right', vertical: 'top' }}
        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
      >
        <MenuItem onClick={handleDelete}>Delete</MenuItem>
      </Menu>
    </Box>
  );
};

export default MessageBubble;
