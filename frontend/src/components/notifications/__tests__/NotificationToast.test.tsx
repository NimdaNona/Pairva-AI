import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import NotificationToast from '../NotificationToast';
import { 
  NotificationType, 
  NotificationPriority, 
  NotificationStatus 
} from '../../../lib/notifications/enums';
import { Notification } from '../../../lib/notifications/types';

// Mock the Next router
jest.mock('next/router', () => ({
  useRouter: () => ({
    push: jest.fn(),
  }),
}));

describe('NotificationToast', () => {
  const mockNotification: Notification = {
    _id: '123',
    userId: 'user1',
    type: NotificationType.NEW_MATCH,
    title: 'Test Notification',
    body: 'This is a test notification',
    status: NotificationStatus.UNREAD,
    priority: NotificationPriority.MEDIUM,
    data: { matchId: 'match123' },
    sent: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockOnClose = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renders notification with correct title and body', () => {
    render(
      <NotificationToast
        notification={mockNotification}
        onClose={mockOnClose}
        duration={1000}
      />
    );

    expect(screen.getByText('Test Notification')).toBeInTheDocument();
    expect(screen.getByText('This is a test notification')).toBeInTheDocument();
  });

  test('calls onClose when notification is closed', async () => {
    jest.useFakeTimers();
    
    render(
      <NotificationToast
        notification={mockNotification}
        onClose={mockOnClose}
        duration={1000}
      />
    );

    // Advance timers to trigger auto-close
    jest.advanceTimersByTime(1000);
    
    expect(mockOnClose).toHaveBeenCalledTimes(1);
    
    jest.useRealTimers();
  });

  test('uses appropriate icon and severity based on notification type', () => {
    const { rerender } = render(
      <NotificationToast
        notification={mockNotification}
        onClose={mockOnClose}
      />
    );
    
    // NEW_MATCH notification should have success severity
    const alert = screen.getByRole('alert');
    expect(alert).toHaveClass('MuiAlert-standardSuccess');
    
    // Test NEW_MESSAGE notification
    rerender(
      <NotificationToast
        notification={{
          ...mockNotification,
          type: NotificationType.NEW_MESSAGE,
        }}
        onClose={mockOnClose}
      />
    );
    
    expect(screen.getByRole('alert')).toHaveClass('MuiAlert-standardInfo');
  });
});
