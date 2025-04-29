import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import {
  Container,
  Box,
  Typography,
  Paper,
  Grid,
  Avatar,
  Button,
  Divider,
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
  Chip,
  CircularProgress,
  Rating,
  Tabs,
  Tab,
  Card,
  CardContent,
  CardMedia,
  IconButton,
  Alert,
} from '@mui/material';
import {
  Favorite as FavoriteIcon,
  FavoriteBorder as FavoriteBorderIcon,
  CheckCircle as CheckCircleIcon,
  Cancel as CancelIcon,
  Message as MessageIcon,
  ArrowBack as ArrowBackIcon,
  StarRate as StarRateIcon,
} from '@mui/icons-material';
import withProtection from '../../components/auth/withProtection';
import useMatches from '../../hooks/matches/useMatches';
import { Match, CompatibilityInsight, CompatibilityFactor } from '../../lib/matches/types';
import Image from 'next/image';
import { differenceInYears } from 'date-fns';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`simple-tabpanel-${index}`}
      aria-labelledby={`simple-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
}

const MatchDetailPage: React.FC = () => {
  const router = useRouter();
  const { matchId } = router.query;
  const [{ matches, loading, error }, { getMatch, getCompatibilityInsight, updateLikeStatus }] = useMatches();
  const [match, setMatch] = useState<Match | null>(null);
  const [insight, setInsight] = useState<CompatibilityInsight | null>(null);
  const [tabValue, setTabValue] = useState(0);
  const [liked, setLiked] = useState<boolean>(false);

  useEffect(() => {
    const fetchData = async () => {
      if (matchId && typeof matchId === 'string') {
        const matchData = await getMatch(matchId);
        if (matchData) {
          setMatch(matchData);
          // Use a default value of false if user1Liked is undefined
          setLiked(matchData.user1Liked || false);
          
          const insightData = await getCompatibilityInsight(matchId);
          if (insightData) {
            setInsight(insightData);
          }
        }
      }
    };
    
    fetchData();
  }, [matchId, getMatch, getCompatibilityInsight]);

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  const handleLikeToggle = async () => {
    if (!match) return;
    
    try {
      // Use the id property instead of matchId
      const updatedMatch = await updateLikeStatus(match.id, !liked);
      
      if (updatedMatch) {
        // Use a default value of false if user1Liked is undefined
        setLiked(updatedMatch.user1Liked || false);
      }
    } catch (error) {
      console.error('Error updating like status:', error);
    }
  };

  const renderCompatibilityFactors = () => {
    if (!insight || !insight.insights?.keyFactors) return null;
    
    return (
      <List>
        {insight.insights.keyFactors.map((factor: CompatibilityFactor, index: number) => (
          <ListItem key={index} divider={index < insight.insights.keyFactors.length - 1}>
            <ListItemAvatar>
              {factor.score >= 75 ? (
                <CheckCircleIcon color="success" fontSize="large" />
              ) : factor.score < 50 ? (
                <CancelIcon color="error" fontSize="large" />
              ) : (
                <StarRateIcon color="warning" fontSize="large" />
              )}
            </ListItemAvatar>
            <ListItemText
              primary={factor.name}
              secondary={factor.description}
            />
            <Rating
              value={factor.score / 20}
              readOnly
              precision={0.5}
            />
          </ListItem>
        ))}
      </List>
    );
  };

  // Calculate age from birthDate if available
  const getAge = (birthDate?: Date | string): number => {
    if (!birthDate) return 0;
    return differenceInYears(new Date(), new Date(birthDate));
  };

  if (loading) {
    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Box display="flex" justifyContent="center" p={4}>
          <CircularProgress />
        </Box>
      </Container>
    );
  }

  if (error) {
    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Alert severity="error">{error}</Alert>
      </Container>
    );
  }

  if (!match) {
    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Alert severity="info">Match not found</Alert>
      </Container>
    );
  }

  // Check if this is a mutual match
  const isMatch = match?.user1Liked && match?.user2Liked;

  // Get display name from profile
  const displayName = match.matchedProfile?.displayName || 'User';
  const age = getAge(match.matchedProfile?.birthDate);

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Box mb={3} display="flex" alignItems="center">
        <IconButton onClick={() => router.back()} sx={{ mr: 2 }}>
          <ArrowBackIcon />
        </IconButton>
        <Typography variant="h4" component="h1">Match Details</Typography>
      </Box>

      <Grid container spacing={4}>
        {/* Profile Overview */}
        <Grid item xs={12} md={4}>
          <Paper elevation={3} sx={{ overflow: 'hidden' }}>
            <Box sx={{ position: 'relative', height: 300 }}>
              <CardMedia
                component="img"
                height="300"
                image={match.matchedProfile?.photos?.[0]?.url || '/placeholder-profile.jpg'}
                alt={displayName}
                sx={{ objectFit: 'cover' }}
              />
            </Box>
            <CardContent>
              <Typography variant="h5" gutterBottom>
                {displayName}, {age}
              </Typography>
              <Typography variant="body1" color="text.secondary" gutterBottom>
                {match.matchedProfile?.location || 'Unknown location'}
              </Typography>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                {match.matchedProfile?.occupation || 'No occupation specified'}
              </Typography>
              
              <Divider sx={{ my: 2 }} />
              
              <Box display="flex" alignItems="center" mb={2}>
                <Typography variant="body1" sx={{ mr: 1 }}>Compatibility Score:</Typography>
                <Chip 
                  label={`${Math.round(match.compatibilityScore * 100)}%`} 
                  color="primary" 
                  variant="outlined" 
                />
              </Box>
              
              <Box mt={2} display="flex" justifyContent="center" gap={2}>
                <Button
                  variant={liked ? "contained" : "outlined"}
                  color="primary"
                  startIcon={liked ? <FavoriteIcon /> : <FavoriteBorderIcon />}
                  onClick={handleLikeToggle}
                >
                  {liked ? "Liked" : "Like"}
                </Button>
                
                {isMatch && (
                  <Button
                    variant="contained"
                    color="secondary"
                    startIcon={<MessageIcon />}
                    onClick={() => router.push(`/messages/${match.conversationId || ''}`)}
                  >
                    Message
                  </Button>
                )}
              </Box>
            </CardContent>
          </Paper>
        </Grid>
        
        {/* Detailed Info */}
        <Grid item xs={12} md={8}>
          <Paper elevation={3} sx={{ height: '100%' }}>
            <Tabs value={tabValue} onChange={handleTabChange} centered>
              <Tab label="Compatibility" />
              <Tab label="About" />
              {isMatch && <Tab label="Premium Insights" />}
            </Tabs>
            
            <TabPanel value={tabValue} index={0}>
              <Typography variant="h6" gutterBottom>
                Compatibility Analysis
              </Typography>
              <Typography variant="body1" paragraph>
                {insight?.insights?.summary}
              </Typography>
              
              <Divider sx={{ my: 2 }} />
              
              <Typography variant="h6" gutterBottom>
                Key Compatibility Factors
              </Typography>
              {renderCompatibilityFactors()}
            </TabPanel>
            
            <TabPanel value={tabValue} index={1}>
              <Typography variant="h6" gutterBottom>
                About {displayName}
              </Typography>
              <Typography variant="body1" paragraph>
                {match.matchedProfile?.bio || 'No bio available.'}
              </Typography>
              
              <Divider sx={{ my: 2 }} />
              
              <Typography variant="h6" gutterBottom>
                Full Compatibility Analysis
              </Typography>
              <Typography variant="body1" paragraph>
                {insight?.insights?.detailedAnalysis}
              </Typography>
            </TabPanel>
            
            {isMatch && (
              <TabPanel value={tabValue} index={2}>
                <Typography variant="h6" gutterBottom>
                  Premium Match Insights
                </Typography>
                
                <Box mb={3}>
                  <Typography variant="subtitle1" fontWeight={600} gutterBottom>
                    Conversation Starters
                  </Typography>
                  <List>
                    {insight?.insights?.premiumInsights?.conversationStarters.map((starter: string, idx: number) => (
                      <ListItem key={idx} divider={idx < (insight?.insights?.premiumInsights?.conversationStarters.length || 0) - 1}>
                        <ListItemText primary={starter} />
                      </ListItem>
                    ))}
                  </List>
                </Box>
                
                <Box mb={3}>
                  <Typography variant="subtitle1" fontWeight={600} gutterBottom>
                    Potential Challenges
                  </Typography>
                  <List>
                    {insight?.insights?.premiumInsights?.potentialChallenges.map((challenge: string, idx: number) => (
                      <ListItem key={idx} divider={idx < (insight?.insights?.premiumInsights?.potentialChallenges.length || 0) - 1}>
                        <ListItemText primary={challenge} />
                      </ListItem>
                    ))}
                  </List>
                </Box>
                
                <Box mb={3}>
                  <Typography variant="subtitle1" fontWeight={600} gutterBottom>
                    Value Alignment
                  </Typography>
                  <Typography variant="body1">
                    {insight?.insights?.premiumInsights?.valueAlignmentDetails}
                  </Typography>
                </Box>
              </TabPanel>
            )}
          </Paper>
        </Grid>
      </Grid>
    </Container>
  );
};

export default withProtection(MatchDetailPage);
