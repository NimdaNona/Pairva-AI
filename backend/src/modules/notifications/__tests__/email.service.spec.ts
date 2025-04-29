import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { EmailService } from '../email.service';
import { NotificationType, NotificationPriority } from '../schemas/notification.schema';
import * as nodemailer from 'nodemailer';

// Mock nodemailer
jest.mock('nodemailer', () => ({
  createTransport: jest.fn().mockReturnValue({
    sendMail: jest.fn().mockImplementation(() => Promise.resolve({
      messageId: 'test-message-id',
    })),
    verify: jest.fn().mockResolvedValue(true),
  }),
}));

describe('EmailService', () => {
  let service: EmailService;
  let configService: ConfigService;

  const mockConfigService = {
    get: jest.fn((key: string, defaultValue?: any) => {
      const config: Record<string, any> = {
        'NODE_ENV': 'test',
        'EMAIL_SENDER': 'test@pairva.ai',
        'SMTP_HOST': 'smtp.test.com',
        'SMTP_PORT': 587,
        'SMTP_USER': 'testuser',
        'SMTP_PASS': 'testpass',
      };
      return config[key] || defaultValue;
    }),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmailService,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<EmailService>(EmailService);
    configService = module.get<ConfigService>(ConfigService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('sendEmail', () => {
    it('should send an email successfully', async () => {
      const to = 'user@example.com';
      const subject = 'Test Subject';
      const html = '<p>Test Email</p>';
      const text = 'Test Email';
      const priority = NotificationPriority.MEDIUM;

      const result = await service.sendEmail(to, subject, html, text, priority);

      expect(result).toBe(true);
      expect(nodemailer.createTransport).toHaveBeenCalled();
      expect(nodemailer.createTransport().sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          from: 'test@pairva.ai',
          to,
          subject,
          text,
          html,
          priority: 'normal',
        }),
      );
    });

    it('should handle errors when sending email', async () => {
      // Mock the transporter to throw an error
      (nodemailer.createTransport as jest.Mock).mockReturnValueOnce({
        sendMail: jest.fn().mockRejectedValueOnce(new Error('Failed to send email')),
      });

      const result = await service.sendEmail(
        'user@example.com',
        'Test Subject',
        '<p>Test Email</p>',
      );

      expect(result).toBe(false);
    });

    it('should set priority to high for high priority notifications', async () => {
      const result = await service.sendEmail(
        'user@example.com',
        'Test Subject',
        '<p>Test Email</p>',
        'Test Email',
        NotificationPriority.HIGH,
      );

      expect(result).toBe(true);
      expect(nodemailer.createTransport().sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          priority: 'high',
        }),
      );
    });

    it('should set priority to low for low priority notifications', async () => {
      const result = await service.sendEmail(
        'user@example.com',
        'Test Subject',
        '<p>Test Email</p>',
        'Test Email',
        NotificationPriority.LOW,
      );

      expect(result).toBe(true);
      expect(nodemailer.createTransport().sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          priority: 'low',
        }),
      );
    });
  });

  describe('generateEmailContent', () => {
    it('should generate email content for NEW_MATCH notification', () => {
      const result = service.generateEmailContent(
        NotificationType.NEW_MATCH,
        'New Match!',
        'You have a new match',
        { matchId: 'match123' },
      );

      expect(result).toHaveProperty('subject', 'New Match!');
      expect(result).toHaveProperty('html');
      expect(result).toHaveProperty('text');
      expect(result.html).toContain('New Match!');
      expect(result.html).toContain('You have a new match');
      expect(result.html).toContain('https://pairva.ai/matches/match123');
      expect(result.html).toContain('View Match');
    });

    it('should generate email content for NEW_MESSAGE notification', () => {
      const result = service.generateEmailContent(
        NotificationType.NEW_MESSAGE,
        'New Message',
        'You have a new message',
        { conversationId: 'conv123' },
      );

      expect(result).toHaveProperty('subject', 'New Message');
      expect(result.html).toContain('New Message');
      expect(result.html).toContain('You have a new message');
      expect(result.html).toContain('https://pairva.ai/messages/conv123');
      expect(result.html).toContain('Reply to Message');
    });

    it('should generate default content for unknown notification types', () => {
      const result = service.generateEmailContent(
        'UNKNOWN_TYPE' as NotificationType,
        'Unknown Notification',
        'This is an unknown notification',
      );

      expect(result).toHaveProperty('subject', 'Unknown Notification');
      expect(result.html).toContain('Unknown Notification');
      expect(result.html).toContain('https://pairva.ai/notifications');
      expect(result.html).toContain('View Notifications');
    });
  });

  describe('stripHtml', () => {
    it('should strip HTML tags from content', () => {
      const html = '<p>This is a <strong>test</strong> with <a href="#">HTML tags</a></p>';
      const stripped = service['stripHtml'](html);

      expect(stripped).not.toContain('<p>');
      expect(stripped).not.toContain('<strong>');
      expect(stripped).not.toContain('<a href="#">');
      expect(stripped).toContain('This is a test with HTML tags');
    });
  });
});
