import React, { useState, useEffect } from 'react';
import { NextPage } from 'next';
import {
  Container,
  Typography,
  Grid,
  Box,
  ToggleButtonGroup,
  ToggleButton,
  CircularProgress,
  Alert,
  Paper,
  Divider,
} from '@mui/material';
import Head from 'next/head';
import { useRouter } from 'next/router';
import withProtection from '@/components/auth/withProtection';
import { useSubscription } from '@/hooks/subscriptions/useSubscription';
import PlanCard from '@/components/subscriptions/PlanCard';
import { PlanInterval } from '@/lib/subscriptions/enums';

const SubscriptionPlansPage: NextPage = () => {
  const router = useRouter();
  const {
    loading,
    plans,
    activeSubscription,
    createCheckout,
  } = useSubscription();

  const [billingInterval, setBillingInterval] = useState<PlanInterval>(PlanInterval.MONTHLY);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filter plans by billing interval and active status
  const filteredPlans = plans.filter(
    (plan) => plan.interval === billingInterval && plan.isActive
  );

  // Sort plans by price (ascending)
  const sortedPlans = [...filteredPlans].sort((a, b) => a.price - b.price);

  // Handle billing interval toggle
  const handleIntervalChange = (
    _: React.MouseEvent<HTMLElement>,
    newInterval: PlanInterval | null
  ) => {
    if (newInterval !== null) {
      setBillingInterval(newInterval);
    }
  };

  // Handle plan selection
  const handleSelectPlan = async (planId: string) => {
    try {
      setError(null);
      setCheckoutLoading(true);
      
      // Get checkout URL from the backend
      const checkoutUrl = await createCheckout(planId);
      
      // Redirect to Stripe checkout
      window.location.href = checkoutUrl;
    } catch (err) {
      console.error('Error creating checkout session:', err);
      setError('There was an error processing your request. Please try again.');
    } finally {
      setCheckoutLoading(false);
    }
  };

  return (
    <>
      <Head>
        <title>Subscription Plans | PerfectMatch</title>
      </Head>

      <Container maxWidth="lg" sx={{ py: 6 }}>
        <Box sx={{ mb: 6, textAlign: 'center' }}>
          <Typography variant="h2" component="h1" gutterBottom>
            Choose Your Perfect Plan
          </Typography>
          <Typography variant="h6" color="text.secondary" sx={{ mb: 4, maxWidth: 600, mx: 'auto' }}>
            Upgrade your matching experience with premium features to find your perfect match faster
          </Typography>

          {/* Billing interval toggle */}
          <Paper sx={{ display: 'inline-block', p: 1, mb: 4 }}>
            <ToggleButtonGroup
              value={billingInterval}
              exclusive
              onChange={handleIntervalChange}
              aria-label="billing interval"
            >
              <ToggleButton value={PlanInterval.MONTHLY}>
                Monthly
              </ToggleButton>
              <ToggleButton value={PlanInterval.ANNUALLY}>
                Yearly <Box component="span" sx={{ ml: 1, color: 'success.main', fontWeight: 'bold' }}>Save 20%</Box>
              </ToggleButton>
            </ToggleButtonGroup>
          </Paper>

          {/* Error message */}
          {error && (
            <Alert severity="error" sx={{ mb: 4 }}>
              {error}
            </Alert>
          )}

          {/* Loading indicator */}
          {loading && (
            <Box sx={{ display: 'flex', justifyContent: 'center', my: 8 }}>
              <CircularProgress />
            </Box>
          )}

          {/* Plans grid */}
          {!loading && (
            <Grid container spacing={3} justifyContent="center">
              {sortedPlans.map((plan) => (
                <Grid item xs={12} sm={6} md={4} key={plan._id}>
                  <PlanCard
                    plan={plan}
                    isCurrentPlan={
                      activeSubscription?.planId === plan._id &&
                      activeSubscription?.status === 'active'
                    }
                    onSelectPlan={handleSelectPlan}
                    loading={checkoutLoading}
                  />
                </Grid>
              ))}
            </Grid>
          )}

          {/* No plans available message */}
          {!loading && sortedPlans.length === 0 && (
            <Alert severity="info" sx={{ mt: 4 }}>
              No subscription plans are currently available. Please check back later.
            </Alert>
          )}
        </Box>

        <Divider sx={{ my: 6 }} />

        {/* FAQ Section */}
        <Box sx={{ mb: 6 }}>
          <Typography variant="h4" component="h2" gutterBottom textAlign="center">
            Frequently Asked Questions
          </Typography>
          
          <Grid container spacing={4} sx={{ mt: 3 }}>
            <Grid item xs={12} md={6}>
              <Typography variant="h6" gutterBottom>
                How do I cancel my subscription?
              </Typography>
              <Typography color="text.secondary">
                You can cancel your subscription at any time from your account settings. Your benefits will continue until the end of your current billing period.
              </Typography>
            </Grid>
            <Grid item xs={12} md={6}>
              <Typography variant="h6" gutterBottom>
                Will I be billed automatically?
              </Typography>
              <Typography color="text.secondary">
                Yes, your subscription will automatically renew at the end of each billing period. You'll receive an email reminder before being charged.
              </Typography>
            </Grid>
            <Grid item xs={12} md={6}>
              <Typography variant="h6" gutterBottom>
                Can I switch plans?
              </Typography>
              <Typography color="text.secondary">
                Yes, you can upgrade or downgrade your plan at any time. If you upgrade, you'll be charged the prorated difference. If you downgrade, the new rate will apply at your next billing cycle.
              </Typography>
            </Grid>
            <Grid item xs={12} md={6}>
              <Typography variant="h6" gutterBottom>
                Is my payment information secure?
              </Typography>
              <Typography color="text.secondary">
                Absolutely. We use Stripe, a PCI-compliant payment processor, to handle all transactions. Your payment details are never stored on our servers.
              </Typography>
            </Grid>
          </Grid>
        </Box>
      </Container>
    </>
  );
};

export default withProtection(SubscriptionPlansPage);
