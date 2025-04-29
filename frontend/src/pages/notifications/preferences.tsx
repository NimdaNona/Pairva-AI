import React, { useEffect, useState } from 'react';
import {
  Container,
  Typography,
  Box,
  Paper,
  Divider,
  FormControlLabel,
  Switch,
  FormGroup,
  Checkbox,
  FormControl,
  FormLabel,
  TextField,
  Button,
  Alert,
  CircularProgress,
  Grid,
  MenuItem,
  Select,
  SelectChangeEvent,
  InputLabel,
} from '@mui/material';
import { useNotifications } from '../../hooks/notifications/useNotifications';
import withProtection from '../../components/auth/withProtection';
import { NotificationType } from '../../lib/notifications/enums';
import { NextPage } from 'next';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { TimePicker } from '@mui/x-date-pickers/TimePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { parse, format } from 'date-fns';

// Timezones list for dropdown
const TIMEZONES = [
  'UTC',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Asia/Tokyo',
  'Asia/Shanghai',
  'Asia/Dubai',
  'Australia/Sydney',
  'Pacific/Auckland',
];

const NotificationPreferencesPage: NextPage = () => {
  const router = useRouter();
  const {
    preferences,
    loadingPreferences,
    fetchPreferences,
    updatePreferences,
  } = useNotifications();

  const [formValues, setFormValues] = useState({
    inAppEnabled: true,
    inAppTypes: [] as NotificationType[],
    emailEnabled: true,
    emailTypes: [] as NotificationType[],
    pushEnabled: true,
    pushTypes: [] as NotificationType[],
    doNotDisturb: false,
    quietHoursStart: '22:00',
    quietHoursEnd: '07:00',
    timezone: 'UTC',
  });

  const [quietHoursStartTime, setQuietHoursStartTime] = useState<Date | null>(null);
  const [quietHoursEndTime, setQuietHoursEndTime] = useState<Date | null>(null);
  const [saveStatus, setSaveStatus] = useState<{
    success: boolean;
    message: string;
  } | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Fetch preferences on component mount
  useEffect(() => {
    const loadPreferences = async () => {
      await fetchPreferences();
    };
    loadPreferences();
  }, [fetchPreferences]);

  // Update form values when preferences are loaded
  useEffect(() => {
    if (preferences) {
      setFormValues({
        inAppEnabled: preferences.inApp.enabled,
        inAppTypes: preferences.inApp.types,
        emailEnabled: preferences.email.enabled,
        emailTypes: preferences.email.types,
        pushEnabled: preferences.push.enabled,
        pushTypes: preferences.push.types,
        doNotDisturb: preferences.doNotDisturb,
        quietHoursStart: preferences.quietHoursStart,
        quietHoursEnd: preferences.quietHoursEnd,
        timezone: preferences.timezone,
      });

      // Parse time strings to Date objects for time picker
      const today = new Date();
      setQuietHoursStartTime(parseTimeString(preferences.quietHoursStart, today));
      setQuietHoursEndTime(parseTimeString(preferences.quietHoursEnd, today));
    }
  }, [preferences]);

  // Helper to parse time string into Date object
  const parseTimeString = (timeString: string, baseDate: Date): Date => {
    const [hours, minutes] = timeString.split(':').map(Number);
    const date = new Date(baseDate);
    date.setHours(hours, minutes, 0, 0);
    return date;
  };

  // Handle checkbox change for notification types
  const handleTypeChange = (
    channel: 'inAppTypes' | 'emailTypes' | 'pushTypes',
    type: NotificationType
  ) => {
    setFormValues((prev) => {
      const currentTypes = [...prev[channel]];
      const index = currentTypes.indexOf(type);

      if (index === -1) {
        currentTypes.push(type);
      } else {
        currentTypes.splice(index, 1);
      }

      return { ...prev, [channel]: currentTypes };
    });
  };

  // Handle switch toggle for enabled/disabled channels
  const handleSwitchChange = (
    event: React.ChangeEvent<HTMLInputElement>,
    field: string
  ) => {
    setFormValues({ ...formValues, [field]: event.target.checked });
  };

  // Handle time change for quiet hours
  const handleQuietHoursStartChange = (newValue: Date | null) => {
    if (newValue) {
      setQuietHoursStartTime(newValue);
      const timeStr = format(newValue, 'HH:mm');
      setFormValues({ ...formValues, quietHoursStart: timeStr });
    }
  };

  const handleQuietHoursEndChange = (newValue: Date | null) => {
    if (newValue) {
      setQuietHoursEndTime(newValue);
      const timeStr = format(newValue, 'HH:mm');
      setFormValues({ ...formValues, quietHoursEnd: timeStr });
    }
  };

  // Handle timezone selection
  const handleTimezoneChange = (event: SelectChangeEvent) => {
    setFormValues({ ...formValues, timezone: event.target.value as string });
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSaveStatus(null);

    try {
      const updateDto = {
        inApp: {
          enabled: formValues.inAppEnabled,
          types: formValues.inAppTypes,
        },
        email: {
          enabled: formValues.emailEnabled,
          types: formValues.emailTypes,
        },
        push: {
          enabled: formValues.pushEnabled,
          types: formValues.pushTypes,
        },
        doNotDisturb: formValues.doNotDisturb,
        quietHoursStart: formValues.quietHoursStart,
        quietHoursEnd: formValues.quietHoursEnd,
        timezone: formValues.timezone,
      };

      await updatePreferences(updateDto);
      setSaveStatus({
        success: true,
        message: 'Preferences saved successfully',
      });
    } catch (error) {
      setSaveStatus({
        success: false,
        message: 'Failed to save preferences',
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Get list of all notification types for checkboxes
  const notificationTypes = Object.values(NotificationType);

  // Helper to get human-readable label for notification type
  const getTypeLabel = (type: NotificationType): string => {
    switch (type) {
      case NotificationType.NEW_MATCH:
        return 'New matches';
      case NotificationType.NEW_MESSAGE:
        return 'New messages';
      case NotificationType.MATCH_LIKED_YOU:
        return 'Match likes';
      case NotificationType.QUESTIONNAIRE:
        return 'Questionnaire updates';
      case NotificationType.SYSTEM:
        return 'System notifications';
      case NotificationType.ACCOUNT:
        return 'Account notifications';
      case NotificationType.PROFILE_REVIEW:
        return 'Profile review updates';
      default:
        return type;
    }
  };

  if (loadingPreferences) {
    return (
      <Container maxWidth="md" sx={{ mt: 4, mb: 4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'center', my: 8 }}>
          <CircularProgress />
        </Box>
      </Container>
    );
  }

  return (
    <>
      <Head>
        <title>Notification Preferences | Perfect Match</title>
      </Head>
      <Container maxWidth="md" sx={{ mt: 4, mb: 4 }}>
        <Box sx={{ mb: 4 }}>
          <Typography variant="h4" component="h1" gutterBottom>
            Notification Preferences
          </Typography>
          <Typography variant="subtitle1" color="text.secondary">
            Control how and when you receive notifications from Perfect Match
          </Typography>
        </Box>

        <Paper elevation={2} sx={{ p: 3 }}>
          <form onSubmit={handleSubmit}>
            {saveStatus && (
              <Alert 
                severity={saveStatus.success ? 'success' : 'error'} 
                sx={{ mb: 3 }}
              >
                {saveStatus.message}
              </Alert>
            )}

            {/* In-App Notifications */}
            <Box sx={{ mb: 4 }}>
              <Typography variant="h6" gutterBottom>
                In-App Notifications
              </Typography>
              <FormControlLabel
                control={
                  <Switch
                    checked={formValues.inAppEnabled}
                    onChange={(e) => handleSwitchChange(e, 'inAppEnabled')}
                  />
                }
                label="Enable in-app notifications"
              />
              
              {formValues.inAppEnabled && (
                <FormGroup sx={{ ml: 3, mt: 1 }}>
                  <FormLabel component="legend">Notification types:</FormLabel>
                  <Grid container spacing={2}>
                    {notificationTypes.map((type) => (
                      <Grid item xs={12} sm={6} key={`inapp-${type}`}>
                        <FormControlLabel
                          control={
                            <Checkbox
                              checked={formValues.inAppTypes.includes(type)}
                              onChange={() => handleTypeChange('inAppTypes', type)}
                            />
                          }
                          label={getTypeLabel(type)}
                        />
                      </Grid>
                    ))}
                  </Grid>
                </FormGroup>
              )}
            </Box>

            <Divider sx={{ my: 3 }} />

            {/* Email Notifications */}
            <Box sx={{ mb: 4 }}>
              <Typography variant="h6" gutterBottom>
                Email Notifications
              </Typography>
              <FormControlLabel
                control={
                  <Switch
                    checked={formValues.emailEnabled}
                    onChange={(e) => handleSwitchChange(e, 'emailEnabled')}
                  />
                }
                label="Enable email notifications"
              />
              
              {formValues.emailEnabled && (
                <FormGroup sx={{ ml: 3, mt: 1 }}>
                  <FormLabel component="legend">Notification types:</FormLabel>
                  <Grid container spacing={2}>
                    {notificationTypes.map((type) => (
                      <Grid item xs={12} sm={6} key={`email-${type}`}>
                        <FormControlLabel
                          control={
                            <Checkbox
                              checked={formValues.emailTypes.includes(type)}
                              onChange={() => handleTypeChange('emailTypes', type)}
                            />
                          }
                          label={getTypeLabel(type)}
                        />
                      </Grid>
                    ))}
                  </Grid>
                </FormGroup>
              )}
            </Box>

            <Divider sx={{ my: 3 }} />

            {/* Push Notifications */}
            <Box sx={{ mb: 4 }}>
              <Typography variant="h6" gutterBottom>
                Push Notifications
              </Typography>
              <FormControlLabel
                control={
                  <Switch
                    checked={formValues.pushEnabled}
                    onChange={(e) => handleSwitchChange(e, 'pushEnabled')}
                  />
                }
                label="Enable push notifications"
              />
              
              {formValues.pushEnabled && (
                <FormGroup sx={{ ml: 3, mt: 1 }}>
                  <FormLabel component="legend">Notification types:</FormLabel>
                  <Grid container spacing={2}>
                    {notificationTypes.map((type) => (
                      <Grid item xs={12} sm={6} key={`push-${type}`}>
                        <FormControlLabel
                          control={
                            <Checkbox
                              checked={formValues.pushTypes.includes(type)}
                              onChange={() => handleTypeChange('pushTypes', type)}
                            />
                          }
                          label={getTypeLabel(type)}
                        />
                      </Grid>
                    ))}
                  </Grid>
                </FormGroup>
              )}
            </Box>

            <Divider sx={{ my: 3 }} />

            {/* Quiet Hours */}
            <Box sx={{ mb: 4 }}>
              <Typography variant="h6" gutterBottom>
                Quiet Hours
              </Typography>
              <Typography variant="body2" color="text.secondary" paragraph>
                During quiet hours, we'll only send in-app notifications, and hold email and push notifications 
                until quiet hours end (except for high-priority notifications).
              </Typography>

              <FormControlLabel
                control={
                  <Switch
                    checked={formValues.doNotDisturb}
                    onChange={(e) => handleSwitchChange(e, 'doNotDisturb')}
                  />
                }
                label="Enable quiet hours"
              />
              
              {formValues.doNotDisturb && (
                <Box sx={{ ml: 3, mt: 2 }}>
                  <LocalizationProvider dateAdapter={AdapterDateFns}>
                    <Grid container spacing={3} alignItems="center">
                      <Grid item xs={12} sm={6}>
                        <TimePicker
                          label="Start time"
                          value={quietHoursStartTime}
                          onChange={handleQuietHoursStartChange}
                          slotProps={{ textField: { fullWidth: true } }}
                        />
                      </Grid>
                      <Grid item xs={12} sm={6}>
                        <TimePicker
                          label="End time"
                          value={quietHoursEndTime}
                          onChange={handleQuietHoursEndChange}
                          slotProps={{ textField: { fullWidth: true } }}
                        />
                      </Grid>
                    </Grid>
                  </LocalizationProvider>

                  <FormControl fullWidth sx={{ mt: 3 }}>
                    <InputLabel id="timezone-select-label">Timezone</InputLabel>
                    <Select
                      labelId="timezone-select-label"
                      id="timezone-select"
                      value={formValues.timezone}
                      onChange={handleTimezoneChange}
                      label="Timezone"
                    >
                      {TIMEZONES.map((zone) => (
                        <MenuItem key={zone} value={zone}>
                          {zone}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Box>
              )}
            </Box>

            <Box sx={{ mt: 4, display: 'flex', justifyContent: 'space-between' }}>
              <Button
                variant="outlined"
                onClick={() => router.push('/notifications')}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="contained"
                color="primary"
                disabled={isSaving}
              >
                {isSaving ? <CircularProgress size={24} /> : 'Save Preferences'}
              </Button>
            </Box>
          </form>
        </Paper>
      </Container>
    </>
  );
};

export default withProtection(NotificationPreferencesPage);
