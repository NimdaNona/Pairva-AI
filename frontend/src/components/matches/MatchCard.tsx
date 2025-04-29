import React from 'react';
import {
  Card,
  CardContent,
  CardMedia,
  Typography,
  Box,
  Chip,
  CardActions,
  Stack,
  CircularProgress
} from '@mui/material';
import { Match, MatchStatus } from '../../lib/matches/types';
import { Person, Favorite, LocationOn, FavoriteBorder } from '@mui/icons-material';
import Button from '@/components/common/Button'; // Use our accessible button
import { announceToScreenReader } from '@/utils/accessibility';

interface MatchCardProps {
  match: Match;
  onClick?: () => void;
  onLike?: (matchId: string, liked: boolean) => void;
}

// Component implementation
const MatchCardComponent: React.FC<MatchCardProps> = ({ 
  match, 
  onClick, 
  onLike 
}: MatchCardProps) => {
  // For demo purposes we'd retrieve user data (the match's profile) from a context or API
  // For now we'll use a placeholder
  const matchProfile = match.matchedProfile || {
    displayName: 'Match Name', // This would come from actual data
    birthDate: new Date(), // This would come from actual data
    location: 'New York, NY', // This would come from actual data
    photos: [{ url: 'https://placehold.co/400x400/e91e63/ffffff?text=Photo', isMain: true, order: 0 }] // This would come from actual data
  };

  const age = matchProfile.birthDate ? 
    Math.floor((new Date().getTime() - new Date(matchProfile.birthDate).getTime()) / 3.15576e+10) : 
    30;

  const isMatch = match.userAction === 'LIKED' && match.matchedUserAction === 'LIKED';

  const getStatusColor = () => {
    switch (match.status) {
      case MatchStatus.ACCEPTED:
        return 'success';
      case MatchStatus.PENDING:
        return 'warning';
      case MatchStatus.REJECTED:
        return 'error';
      case MatchStatus.EXPIRED:
        return 'default';
      default:
        return 'default';
    }
  };

  const getStatusLabel = () => {
    switch (match.status) {
      case MatchStatus.ACCEPTED:
        return 'Active';
      case MatchStatus.PENDING:
        return 'Pending';
      case MatchStatus.REJECTED:
        return 'Passed';
      case MatchStatus.EXPIRED:
        return 'Expired';
      default:
        return 'Unknown';
    }
  };

  const handleLike = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onLike) {
      const newLikedState = match.userAction !== 'LIKED';
      onLike(match.id, newLikedState);

      // Announce the action to screen readers
      announceLikeAction(newLikedState);
    }
  };

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (onClick) {
        onClick();
      }
    }
  };

  // Announce like/unlike to screen readers
  const announceLikeAction = (liked: boolean) => {
    const message = liked
      ? `You've liked ${matchProfile.displayName}`
      : `You've removed your like for ${matchProfile.displayName}`;
    announceToScreenReader(message);
  };

  const mainPhoto = matchProfile.photos?.find((p: { url: string, isMain: boolean, order: number }) => p.isMain)?.url || 
    (matchProfile.photos?.length ? matchProfile.photos[0].url : 'https://placehold.co/400x400/e91e63/ffffff?text=Photo');

  return (
    <Card
      onClick={onClick}
      onKeyDown={handleKeyDown}
      role="article"
      aria-label={`Match profile for ${matchProfile.displayName} ${age} ${matchProfile.location}`}
      tabIndex={0}
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        cursor: onClick ? 'pointer' : 'default',
        transition: 'transform 0.2s',
        '&:hover': {
          transform: onClick ? 'scale(1.02)' : 'none',
          boxShadow: onClick ? 6 : 1
        },
        '&:focus-visible': {
          outline: '3px solid',
          outlineColor: 'primary.main',
          outlineOffset: '2px'
        }
      }}
    >
      <Box sx={{ position: 'relative' }}>
        <CardMedia
          component="img"
          height="200"
          image={mainPhoto}
          alt={`Profile photo of ${matchProfile.displayName}`}
        />
        <Box
          sx={{
            position: 'absolute',
            top: 8,
            right: 8,
            backgroundColor: 'rgba(0, 0, 0, 0.6)',
            borderRadius: '50%',
            width: 40,
            height: 40,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
          role="meter"
          aria-label="Compatibility score"
          aria-valuenow={match.compatibilityScore}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <Typography sx={{ color: 'white', fontWeight: 'bold' }}>
            {match.compatibilityScore}%
          </Typography>
        </Box>
      </Box>

      <CardContent sx={{ flexGrow: 1 }}>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
          <Typography variant="h6" component="h2">
            {matchProfile.displayName} {age}
          </Typography>
          <Chip
            label={getStatusLabel()}
            color={getStatusColor() as any}
            size="small"
            variant="outlined"
            aria-label={`Match status: ${getStatusLabel()}`}
          />
        </Box>

        <Stack spacing={1}>
          <Box display="flex" alignItems="center">
            <LocationOn fontSize="small" color="action" sx={{ mr: 1 }} />
            <Typography variant="body2" color="text.secondary">
              {matchProfile.location}
            </Typography>
          </Box>

          {isMatch && (
            <Chip
              icon={<Favorite fontSize="small" />}
              label="It's a match!"
              color="primary"
              size="small"
              sx={{ alignSelf: 'flex-start' }}
            />
          )}
        </Stack>
      </CardContent>

      <CardActions>
        <Button
          size="small"
          color="primary"
          startIcon={match.userAction === 'LIKED' ? <Favorite /> : <FavoriteBorder />}
          onClick={handleLike}
          sx={{ ml: 'auto' }}
        >
          {match.userAction === 'LIKED' ? 'Liked' : 'Like'}
        </Button>
        <Button size="small" color="primary" onClick={onClick}>
          View Details
        </Button>
      </CardActions>
    </Card>
  );
};

// Use React.memo to prevent unnecessary re-renders
// Only re-render if props change
const MatchCard = React.memo(MatchCardComponent, (prevProps: MatchCardProps, nextProps: MatchCardProps) => {
  // Custom comparison function to determine if component should update
  // Return true if props are equal (prevent re-render)
  // Return false if props are different (trigger re-render)
  return (
    prevProps.match.id === nextProps.match.id &&
    prevProps.match.userAction === nextProps.match.userAction &&
    prevProps.match.matchedUserAction === nextProps.match.matchedUserAction &&
    prevProps.match.compatibilityScore === nextProps.match.compatibilityScore &&
    prevProps.match.status === nextProps.match.status
    // We don't compare onClick and onLike because they're callback functions
    // and would cause unnecessary re-renders when components higher up re-render
  );
});

// Add display name for debugging
MatchCard.displayName = 'MatchCard';

export default MatchCard;
