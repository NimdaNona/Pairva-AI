import React, { useState } from 'react';
import { NextPage } from 'next';
import {
  Container,
  Typography,
  Box,
  Card,
  CardContent,
  Grid,
  Button,
  Divider,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  CircularProgress,
  Alert,
} from '@mui/material';
import Head from 'next/head';
import { useRouter } from 'next/router';
import withProtection from '@/components/auth/withProtection';
import { useSubscription } from '@/hooks/subscriptions/useSubscription';
import { SubscriptionStatus } from '@/lib/subscriptions/types';
import { format } from 'date-fns';

const SubscriptionManagePage: NextPage = () => {
  const router = useRouter();
  const { 
    loading, 
    activeSubscription, 
    subscriptionHistory,
    plans,
    cancelSubscription,
    getPlanById
  } = useSubscription();

  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [cancelingSubscription, setCancelingSubscription] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cancelImmediate, setCancelImmediate] = useState(false);

  // Format date for display
  const formatDate = (dateString: string) => {
    return format(new Date(dateString), 'MMM d, yyyy');
  };

  // Get status chip color based on subscription status
  const getStatusChipColor = (status: SubscriptionStatus) => {
    switch (status) {
      case SubscriptionStatus.ACTIVE:
        return 'success';
      case SubscriptionStatus.CANCELLED:
        return 'warning';
      case SubscriptionStatus.EXPIRED:
        return 'error';
      case SubscriptionStatus.PAST_DUE:
        return 'error';
      case SubscriptionStatus.UNPAID:
        return 'error';
      default:
        return 'default';
    }
  };

  // Get readable status for display
  const getReadableStatus = (status: SubscriptionStatus) => {
    switch (status) {
      case SubscriptionStatus.ACTIVE:
        return 'Active';
      case SubscriptionStatus.CANCELLED:
        return 'Cancelled';
      case SubscriptionStatus.EXPIRED:
        return 'Expired';
      case SubscriptionStatus.PAST_DUE:
        return 'Past Due';
      case SubscriptionStatus.UNPAID:
        return 'Unpaid';
      default:
        return status;
    }
  };

  // Handle opening the cancel dialog
  const handleOpenCancelDialog = () => {
    setCancelDialogOpen(true);
    setCancelImmediate(false);
    setError(null);
  };

  // Handle closing the cancel dialog
  const handleCloseCancelDialog = () => {
    setCancelDialogOpen(false);
  };

  // Handle cancelling subscription
  const handleCancelSubscription = async () => {
    if (!activeSubscription) return;

    try {
      setCancelingSubscription(true);
      setError(null);
      
      await cancelSubscription(activeSubscription._id, cancelImmediate);
      
      // Close dialog after successful cancellation
      setCancelDialogOpen(false);
    } catch (err) {
      console.error('Error cancelling subscription:', err);
      setError('Failed to cancel subscription. Please try again.');
    } finally {
      setCancelingSubscription(false);
    }
  };

  // Get plan name by ID
  const getPlanName = (planId: string) => {
    const plan = getPlanById(planId);
    return plan ? plan.name : 'Unknown Plan';
  };

  return (
    <>
      <Head>
        <title>Manage Subscription | PerfectMatch</title>
      </Head>

      <Container maxWidth="md" sx={{ py: 6 }}>
        <Typography variant="h2" component="h1" gutterBottom>
          Manage Subscription
        </Typography>

        {/* Loading state */}
        {loading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', my: 8 }}>
            <CircularProgress />
          </Box>
        )}

        {/* Error state */}
        {!loading && error && (
          <Alert severity="error" sx={{ mb: 4 }}>
            {error}
          </Alert>
        )}

        {/* No active subscription */}
        {!loading && !activeSubscription && (
          <Box>
            <Alert severity="info" sx={{ mb: 4 }}>
              You don't have an active subscription.
            </Alert>
            <Button 
              variant="contained" 
              color="primary" 
              size="large"
              onClick={() => router.push('/subscription/plans')}
            >
              View Subscription Plans
            </Button>
          </Box>
        )}

        {/* Active subscription details */}
        {!loading && activeSubscription && (
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h5" component="h2">
                  Current Subscription
                </Typography>
                <Chip
                  label={getReadableStatus(activeSubscription.status as SubscriptionStatus)}
                  color={getStatusChipColor(activeSubscription.status as SubscriptionStatus) as any}
                />
              </Box>

              <Grid container spacing={3}>
                <Grid item xs={12} sm={6}>
                  <Typography variant="subtitle2" color="text.secondary">
                    Plan
                  </Typography>
                  <Typography variant="body1">
                    {getPlanName(activeSubscription.planId)}
                  </Typography>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant="subtitle2" color="text.secondary">
                    Price
                  </Typography>
                  <Typography variant="body1">
                    ${activeSubscription.price}/{activeSubscription.interval === 'monthly' ? 'mo' : 'yr'}
                  </Typography>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant="subtitle2" color="text.secondary">
                    Start Date
                  </Typography>
                  <Typography variant="body1">
                    {formatDate(activeSubscription.startDate)}
                  </Typography>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant="subtitle2" color="text.secondary">
                    Current Period Ends
                  </Typography>
                  <Typography variant="body1">
                    {formatDate(activeSubscription.currentPeriodEnd)}
                  </Typography>
                </Grid>

                {activeSubscription.cancelledAt && (
                  <Grid item xs={12} sm={6}>
                    <Typography variant="subtitle2" color="text.secondary">
                      Cancellation Date
                    </Typography>
                    <Typography variant="body1">
                      {formatDate(activeSubscription.cancelledAt)}
                    </Typography>
                  </Grid>
                )}

                {activeSubscription.cancelAtPeriodEnd && !activeSubscription.cancelledAt && (
                  <Grid item xs={12}>
                    <Alert severity="warning">
                      Your subscription will be cancelled at the end of the current billing period.
                    </Alert>
                  </Grid>
                )}
              </Grid>

              <Box sx={{ mt: 3 }}>
                <Typography variant="h6" gutterBottom>
                  Features
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={6}>
                    <Typography variant="body2">
                      • {activeSubscription.matchesPerDay} matches per day
                    </Typography>
                  </Grid>
                  {activeSubscription.showLikes && (
                    <Grid item xs={12} sm={6}>
                      <Typography variant="body2">
                        • See who likes you
                      </Typography>
                    </Grid>
                  )}
                  {activeSubscription.priorityMatching && (
                    <Grid item xs={12} sm={6}>
                      <Typography variant="body2">
                        • Priority matching
                      </Typography>
                    </Grid>
                  )}
                  {activeSubscription.readReceipts && (
                    <Grid item xs={12} sm={6}>
                      <Typography variant="body2">
                        • Read receipts
                      </Typography>
                    </Grid>
                  )}
                  {activeSubscription.profileBoost && (
                    <Grid item xs={12} sm={6}>
                      <Typography variant="body2">
                        • Profile boost
                      </Typography>
                    </Grid>
                  )}
                  {activeSubscription.advancedFilters && (
                    <Grid item xs={12} sm={6}>
                      <Typography variant="body2">
                        • Advanced filters
                      </Typography>
                    </Grid>
                  )}
                </Grid>
              </Box>

              <Box sx={{ mt: 4, display: 'flex', gap: 2 }}>
                <Button
                  variant="outlined"
                  color="primary"
                  onClick={() => router.push('/subscription/plans')}
                >
                  Change Plan
                </Button>
                {activeSubscription.status === SubscriptionStatus.ACTIVE && 
                 !activeSubscription.cancelAtPeriodEnd && (
                  <Button
                    variant="outlined"
                    color="error"
                    onClick={handleOpenCancelDialog}
                  >
                    Cancel Subscription
                  </Button>
                )}
              </Box>
            </CardContent>
          </Card>
        )}

        {/* Subscription history */}
        {!loading && subscriptionHistory.length > 0 && (
          <Box sx={{ mt: 6 }}>
            <Typography variant="h5" component="h2" gutterBottom>
              Subscription History
            </Typography>
            <Divider sx={{ mb: 3 }} />
            
            <Grid container spacing={3}>
              {subscriptionHistory
                .filter(sub => sub._id !== activeSubscription?._id) // Don't show active sub in history
                .map((subscription) => (
                  <Grid item xs={12} key={subscription._id}>
                    <Card variant="outlined">
                      <CardContent>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                          <Typography variant="h6">
                            {getPlanName(subscription.planId)}
                          </Typography>
                          <Chip
                            label={getReadableStatus(subscription.status as SubscriptionStatus)}
                            color={getStatusChipColor(subscription.status as SubscriptionStatus) as any}
                            size="small"
                          />
                        </Box>
                        <Grid container spacing={2}>
                          <Grid item xs={12} sm={4}>
                            <Typography variant="body2" color="text.secondary">
                              Price
                            </Typography>
                            <Typography variant="body2">
                              ${subscription.price}/{subscription.interval === 'monthly' ? 'mo' : 'yr'}
                            </Typography>
                          </Grid>
                          <Grid item xs={12} sm={4}>
                            <Typography variant="body2" color="text.secondary">
                              Start Date
                            </Typography>
                            <Typography variant="body2">
                              {formatDate(subscription.startDate)}
                            </Typography>
                          </Grid>
                          <Grid item xs={12} sm={4}>
                            <Typography variant="body2" color="text.secondary">
                              End Date
                            </Typography>
                            <Typography variant="body2">
                              {formatDate(subscription.currentPeriodEnd)}
                            </Typography>
                          </Grid>
                        </Grid>
                      </CardContent>
                    </Card>
                  </Grid>
                ))}
            </Grid>
          </Box>
        )}

        {/* Cancel subscription dialog */}
        <Dialog
          open={cancelDialogOpen}
          onClose={handleCloseCancelDialog}
        >
          <DialogTitle>
            Cancel Your Subscription
          </DialogTitle>
          <DialogContent>
            <DialogContentText>
              Are you sure you want to cancel your subscription? You can choose to cancel it immediately or at the end of your current billing period.
            </DialogContentText>
            <Box sx={{ mt: 2 }}>
              <Button
                variant={cancelImmediate ? "contained" : "outlined"}
                onClick={() => setCancelImmediate(true)}
                sx={{ mr: 2, mb: 1 }}
              >
                Cancel Immediately
              </Button>
              <Button
                variant={!cancelImmediate ? "contained" : "outlined"}
                onClick={() => setCancelImmediate(false)}
              >
                Cancel at End of Billing Period
              </Button>
            </Box>
            {error && (
              <Alert severity="error" sx={{ mt: 2 }}>
                {error}
              </Alert>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={handleCloseCancelDialog}>
              Keep Subscription
            </Button>
            <Button
              onClick={handleCancelSubscription}
              variant="contained"
              color="error"
              disabled={cancelingSubscription}
            >
              {cancelingSubscription ? (
                <CircularProgress size={24} />
              ) : (
                'Confirm Cancellation'
              )}
            </Button>
          </DialogActions>
        </Dialog>
      </Container>
    </>
  );
};

export default withProtection(SubscriptionManagePage);
