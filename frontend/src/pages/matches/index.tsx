import React, { useEffect, useState, useCallback, useRef } from 'react';
import { NextPage } from 'next';
import {
  Typography,
  Container,
  Box,
  Grid,
  CircularProgress,
  Button,
  Chip,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Slider,
  Stack,
  TextField,
  Paper,
  Divider,
  Alert
} from '@mui/material';
import MatchCard from '../../components/matches/MatchCard';
import withProtection from '../../components/auth/withProtection';
import useMatches from '../../hooks/matches/useMatches';
import { MatchFilterParams } from '../../lib/matches/types';
import { useRouter } from 'next/router';
import VirtualizedMatchList from '../../components/matches/VirtualizedMatchList';

const MatchesPage: NextPage = () => {
  const router = useRouter();
  const [{ matches, loading, error, total }, { getMatches, searchMatches, updateLikeStatus }] = useMatches();
  const [searchParams, setSearchParams] = useState<MatchFilterParams>({
    minScore: 70,
    ageMin: 18,
    ageMax: 65,
    limit: 20,
    page: 0
  });
  const [filtersVisible, setFiltersVisible] = useState(false);

  useEffect(() => {
    getMatches({ limit: 20 });
  }, [getMatches]);

  const handleFilterChange = (key: keyof MatchFilterParams, value: any) => {
    setSearchParams(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const handleApplyFilters = () => {
    searchMatches(searchParams);
  };

  const handleResetFilters = () => {
    setSearchParams({
      minScore: 70,
      ageMin: 18,
      ageMax: 65,
      limit: 20,
      page: 0
    });
    getMatches({ limit: 20 });
  };

  const toggleFilters = () => {
    setFiltersVisible(!filtersVisible);
  };

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Box mb={4}>
        <Typography variant="h4" component="h1" gutterBottom>
          Your Matches
        </Typography>
        <Typography variant="body1" color="text.secondary" paragraph>
          Discover people who are compatible with you based on your profile and preferences.
        </Typography>

        <Stack direction="row" spacing={2} mb={2}>
          <Button
            variant="outlined"
            onClick={toggleFilters}
          >
            {filtersVisible ? 'Hide Filters' : 'Show Filters'}
          </Button>
          <Chip
            label={`${total} Matches`}
            color="primary"
            variant="outlined"
          />
        </Stack>

        {/* Filters Panel */}
        {filtersVisible && (
          <Paper sx={{ p: 3, mb: 3 }}>
            <Typography variant="h6" gutterBottom>
              Filter Matches
            </Typography>
            <Divider sx={{ mb: 2 }} />

            <Grid container spacing={3}>
              <Grid item xs={12} sm={6} md={4}>
                <Typography gutterBottom>
                  Compatibility Score
                </Typography>
                <Slider
                  value={searchParams.minScore || 70}
                  onChange={(_, value) => handleFilterChange('minScore', value)}
                  valueLabelDisplay="auto"
                  step={5}
                  marks
                  min={50}
                  max={100}
                  sx={{ mt: 2 }}
                />
              </Grid>

              <Grid item xs={12} sm={6} md={4}>
                <Typography gutterBottom>
                  Age Range
                </Typography>
                <Stack direction="row" spacing={2} alignItems="center">
                  <TextField
                    label="Min"
                    type="number"
                    size="small"
                    value={searchParams.ageMin || 18}
                    onChange={(e) => handleFilterChange('ageMin', Number(e.target.value))}
                    inputProps={{ min: 18, max: 99 }}
                  />
                  <Typography>to</Typography>
                  <TextField
                    label="Max"
                    type="number"
                    size="small"
                    value={searchParams.ageMax || 65}
                    onChange={(e) => handleFilterChange('ageMax', Number(e.target.value))}
                    inputProps={{ min: 18, max: 99 }}
                  />
                </Stack>
              </Grid>

              <Grid item xs={12} sm={6} md={4}>
                <FormControl fullWidth>
                  <InputLabel id="relationship-goals-label">Relationship Goals</InputLabel>
                  <Select
                    labelId="relationship-goals-label"
                    multiple
                    value={searchParams.relationshipGoals || []}
                    onChange={(e) => handleFilterChange('relationshipGoals', e.target.value)}
                    renderValue={(selected) => (
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                        {(selected as string[]).map((value) => (
                          <Chip key={value} label={value} />
                        ))}
                      </Box>
                    )}
                  >
                    <MenuItem value="casual">Casual</MenuItem>
                    <MenuItem value="long-term">Long-term</MenuItem>
                    <MenuItem value="marriage">Marriage</MenuItem>
                    <MenuItem value="friendship">Friendship</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
            </Grid>

            <Box mt={3} display="flex" justifyContent="flex-end" gap={2}>
              <Button onClick={handleResetFilters}>Reset</Button>
              <Button variant="contained" onClick={handleApplyFilters}>Apply Filters</Button>
            </Box>
          </Paper>
        )}

        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
          </Alert>
        )}
      </Box>

      {loading ? (
        <Box display="flex" justifyContent="center" p={4}>
          <CircularProgress />
        </Box>
      ) : matches.length === 0 ? (
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <Typography variant="h6" gutterBottom>
            No matches found
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Try adjusting your filters or check back soon for new matches
          </Typography>
        </Paper>
      ) : (
        <VirtualizedMatchList
          matches={matches}
          isLoading={loading}
          hasNextPage={matches.length < total}
          loadMoreItems={() => {
            // Load more matches when scrolling reaches the end
            const nextPage = Math.ceil(matches.length / 20);
            getMatches({
              ...searchParams,
              limit: 20,
              page: nextPage
            });
          }}
          onMatchClick={(matchId) => router.push(`/matches/${matchId}`)}
          onLike={(matchId, liked) => {
            // Function to like/unlike a match
            // This will update the match in the list via state in useMatches hook
            updateLikeStatus(matchId, liked);
          }}
        />
      )}
    </Container>
  );
};

export default withProtection(MatchesPage);
