import React from 'react';
import {
  Card,
  CardContent,
  CardActions,
  Typography,
  Button,
  Chip,
  Box,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  styled,
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { SubscriptionPlan } from '@/lib/subscriptions/types';
import { PlanInterval } from '@/lib/subscriptions/enums';

interface PlanCardProps {
  plan: SubscriptionPlan;
  isCurrentPlan?: boolean;
  onSelectPlan: (planId: string) => void;
  loading?: boolean;
}

// Styled components
const PlanChip = styled(Chip)(({ theme }) => ({
  position: 'absolute',
  top: 16,
  right: 16,
  fontWeight: 600,
}));

const FeaturesList = styled(List)({
  padding: 0,
});

const FeatureItem = styled(ListItem)({
  padding: '4px 0',
});

const FeatureIcon = styled(ListItemIcon)({
  minWidth: 36,
});

const PlanCard: React.FC<PlanCardProps> = ({
  plan,
  isCurrentPlan = false,
  onSelectPlan,
  loading = false,
}) => {
  // Format price with currency and billing period
  const formatPrice = (price: number, interval: PlanInterval) => {
    return (
      <>
        <Typography variant="h3" component="span">
          ${price}
        </Typography>
        <Typography variant="subtitle1" component="span" color="text.secondary">
          /{interval === PlanInterval.MONTHLY ? 'mo' : 'yr'}
        </Typography>
      </>
    );
  };

  // Calculate annual saving if there's a discount
  const annualSaving = plan.discountPercentage && plan.interval === PlanInterval.ANNUALLY
    ? `Save ${plan.discountPercentage}%`
    : null;

  return (
    <Card
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        border: isCurrentPlan ? '2px solid' : '1px solid',
        borderColor: isCurrentPlan ? 'primary.main' : 'divider',
        transition: 'transform 0.2s, box-shadow 0.2s',
        '&:hover': {
          transform: 'translateY(-4px)',
          boxShadow: '0 12px 20px rgba(0,0,0,0.1)',
        },
      }}
    >
      {isCurrentPlan && (
        <PlanChip label="Current Plan" color="primary" size="small" />
      )}

      <CardContent sx={{ flexGrow: 1 }}>
        <Typography variant="h5" component="h2" gutterBottom>
          {plan.name}
        </Typography>
        
        <Box sx={{ mb: 2 }}>
          {formatPrice(plan.price, plan.interval)}
          {annualSaving && (
            <Chip
              label={annualSaving}
              color="secondary"
              size="small"
              sx={{ ml: 1 }}
            />
          )}
        </Box>
        
        <Typography color="text.secondary" sx={{ mb: 3 }}>
          {plan.description}
        </Typography>
        
        <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
          Features:
        </Typography>
        
        <FeaturesList>
          {plan.features.map((feature, index) => (
            <FeatureItem key={index} disableGutters>
              <FeatureIcon>
                <CheckCircleIcon color="primary" fontSize="small" />
              </FeatureIcon>
              <ListItemText
                primary={feature}
                primaryTypographyProps={{ variant: 'body2' }}
              />
            </FeatureItem>
          ))}
          {plan.matchesPerDay > 0 && (
            <FeatureItem disableGutters>
              <FeatureIcon>
                <CheckCircleIcon color="primary" fontSize="small" />
              </FeatureIcon>
              <ListItemText
                primary={`${plan.matchesPerDay} matches per day`}
                primaryTypographyProps={{ variant: 'body2' }}
              />
            </FeatureItem>
          )}
        </FeaturesList>
      </CardContent>
      
      <CardActions sx={{ p: 2, pt: 0 }}>
        <Button
          variant={isCurrentPlan ? "outlined" : "contained"}
          fullWidth
          onClick={() => onSelectPlan(plan._id)}
          disabled={isCurrentPlan || loading}
        >
          {isCurrentPlan ? 'Current Plan' : 'Select Plan'}
        </Button>
      </CardActions>
    </Card>
  );
};

export default PlanCard;
