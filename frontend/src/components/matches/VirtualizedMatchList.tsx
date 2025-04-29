import React, { useState, useEffect } from 'react';
import { Box, Card, CardActionArea, CardMedia, CardContent, Typography, Grid } from '@mui/material';
import { FixedSizeGrid as Grid2 } from 'react-window';
import AutoSizer from 'react-virtualized-auto-sizer';
import { Match } from '../../lib/matches/types';
import { useRouter } from 'next/router';

export interface VirtualizedMatchListProps {
  matches: Match[];
  isLoading?: boolean;
  hasNextPage?: boolean;
  loadMoreItems?: () => void;
  onMatchClick?: (matchId: string) => void;
  onLike?: (matchId: string, liked: boolean) => void;
}

const VirtualizedMatchList: React.FC<VirtualizedMatchListProps> = ({ 
  matches, 
  isLoading = false,
  hasNextPage,
  loadMoreItems,
  onMatchClick,
  onLike
}) => {
  const router = useRouter();
  const [itemCount, setItemCount] = useState(0);

  useEffect(() => {
    setItemCount(matches.length);
  }, [matches]);

  const getColumnCount = (width: number) => {
    if (width < 600) return 1;
    if (width < 960) return 2;
    if (width < 1280) return 3;
    return 4;
  };

  const getItemSize = (width: number, columnCount: number) => {
    const gutterSize = 16;
    return Math.floor((width - gutterSize * (columnCount + 1)) / columnCount);
  };

  const Cell = ({ columnIndex, rowIndex, style, data }: any) => {
    const { matches, columnCount, itemSize, onMatchClick } = data;
    const index = rowIndex * columnCount + columnIndex;

    if (index >= matches.length) {
      return null;
    }

    const match = matches[index];

    return (
      <div style={{
        ...style,
        padding: 8,
        boxSizing: 'border-box'
      }}>
        <Card
          sx={{
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            transition: 'transform 0.3s ease-in-out, box-shadow 0.3s ease-in-out',
            '&:hover': {
              transform: 'translateY(-4px)',
              boxShadow: 6
            }
          }}
          onClick={() => onMatchClick(match.id)}
        >
          <CardActionArea sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', alignItems: 'stretch' }}>
            <CardMedia
              component="img"
              height="200"
              image={match.matchedProfile?.photos?.[0]?.url || '/placeholder-profile.jpg'}
              alt={match.matchedProfile?.firstName || 'Match'}
              sx={{ objectFit: 'cover' }}
            />
            <CardContent sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
              <Typography gutterBottom variant="h6" component="div" noWrap>
                {match.matchedProfile?.firstName} {match.matchedProfile?.age}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                {match.matchedProfile?.location}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                Match Score: {Math.round(match.compatibilityScore * 100)}%
              </Typography>
              <Box sx={{ mt: 'auto' }}>
                <Typography variant="caption" color="primary">
                  View Profile
                </Typography>
              </Box>
            </CardContent>
          </CardActionArea>
        </Card>
      </div>
    );
  };

  const handleMatchClick = (matchId: string) => {
    if (onMatchClick) {
      onMatchClick(matchId);
    } else {
      router.push(`/matches/${matchId}`);
    }
  };

  if (isLoading) {
    return (
      <Box sx={{ p: 3, textAlign: 'center' }}>
        <Typography>Loading matches...</Typography>
      </Box>
    );
  }

  if (matches.length === 0) {
    return (
      <Box sx={{ p: 3, textAlign: 'center' }}>
        <Typography>No matches found. Complete your profile to find matches.</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ width: '100%', height: 'calc(100vh - 300px)', minHeight: 400 }}>
      <AutoSizer>
        {({ height, width }: { height: number; width: number }) => {
          const columnCount = getColumnCount(width);
          const rowCount = Math.ceil(itemCount / columnCount);
          const itemSize = getItemSize(width, columnCount);

          return (
            <Grid2
              columnCount={columnCount}
              columnWidth={itemSize}
              height={height}
              rowCount={rowCount}
              rowHeight={itemSize + 100}
              width={width}
              itemData={{
                matches,
                columnCount,
                itemSize,
                onMatchClick: handleMatchClick
              }}
              onItemsRendered={({ visibleRowStopIndex }) => {
                // Load more items when we're near the end
                if (hasNextPage && loadMoreItems && visibleRowStopIndex >= rowCount - 2) {
                  loadMoreItems();
                }
              }}
            >
              {Cell}
            </Grid2>
          );
        }}
      </AutoSizer>
    </Box>
  );
};

export default VirtualizedMatchList;
