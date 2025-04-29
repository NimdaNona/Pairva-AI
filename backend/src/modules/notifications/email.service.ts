import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import * as aws from '@aws-sdk/client-ses';
import { NotificationType, NotificationPriority } from './schemas/notification.schema';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter: nodemailer.Transporter;
  private readonly sender: string;

  constructor(private configService: ConfigService) {
    const sesRegion = this.configService.get<string>('AWS_REGION', 'us-east-1');
    this.sender = this.configService.get<string>('EMAIL_SENDER', 'noreply@pairva.ai');
    
    // Determine which email transport to use based on environment
    if (this.configService.get<string>('NODE_ENV') === 'production') {
      // In production, use AWS SES
      const ses = new aws.SES({
        region: sesRegion,
        credentials: {
          accessKeyId: this.configService.get<string>('AWS_ACCESS_KEY_ID', ''),
          secretAccessKey: this.configService.get<string>('AWS_SECRET_ACCESS_KEY', '')
        }
      });

      this.transporter = nodemailer.createTransport({
        SES: { ses, aws }
      });
      
      this.logger.log('Email service initialized with AWS SES transport');
    } else {
      // In development, use SMTP or ethereal for testing
      this.transporter = nodemailer.createTransport({
        host: this.configService.get<string>('SMTP_HOST', 'smtp.ethereal.email'),
        port: this.configService.get<number>('SMTP_PORT', 587),
        secure: this.configService.get<boolean>('SMTP_SECURE', false),
        auth: {
          user: this.configService.get<string>('SMTP_USER', ''),
          pass: this.configService.get<string>('SMTP_PASS', '')
        },
      });
      
      this.logger.log('Email service initialized with SMTP transport for development');
    }
  }

  /**
   * Send an email notification
   */
  async sendEmail(
    to: string,
    subject: string,
    html: string,
    text?: string,
    priority: NotificationPriority = NotificationPriority.MEDIUM,
  ): Promise<boolean> {
    try {
      const mailOptions: nodemailer.SendMailOptions = {
        from: this.sender,
        to,
        subject,
        text: text || this.stripHtml(html),
        html,
        priority: priority === NotificationPriority.HIGH ? 'high' : 
                 priority === NotificationPriority.LOW ? 'low' : 'normal',
      };

      const info = await this.transporter.sendMail(mailOptions);
      this.logger.log(`Email sent: ${info?.messageId || 'No message ID'}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to send email: ${error.message}`, error.stack);
      return false;
    }
  }

  /**
   * Generate email content from a notification
   */
  generateEmailContent(
    notificationType: NotificationType,
    title: string,
    body: string,
    data?: Record<string, any>,
  ): { subject: string; html: string; text: string } {
    let subject = title;
    let actionUrl = 'https://pairva.ai';
    let actionText = 'View Details';

    // Customize action link based on notification type
    switch (notificationType) {
      case NotificationType.NEW_MATCH:
        actionUrl = `https://pairva.ai/matches/${data?.matchId || ''}`;
        actionText = 'View Match';
        break;
      case NotificationType.NEW_MESSAGE:
        actionUrl = `https://pairva.ai/messages/${data?.conversationId || ''}`;
        actionText = 'Reply to Message';
        break;
      case NotificationType.MATCH_LIKED_YOU:
        actionUrl = `https://pairva.ai/matches?likedBy=${data?.likerId || ''}`;
        actionText = 'View Profile';
        break;
      case NotificationType.QUESTIONNAIRE_COMPLETED:
        actionUrl = `https://pairva.ai/questionnaire/${data?.questionnaireId || ''}`;
        actionText = 'Complete Questionnaire';
        break;
      case NotificationType.PROFILE_VIEW:
        actionUrl = 'https://pairva.ai/profile';
        actionText = 'Update Profile';
        break;
      default:
        actionUrl = 'https://pairva.ai/notifications';
        actionText = 'View Notifications';
    }

    // HTML email template
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body {
            font-family: Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
          }
          .header {
            background-color: #FF6B6B;
            padding: 20px;
            text-align: center;
            color: white;
            border-radius: 8px 8px 0 0;
          }
          .content {
            padding: 20px;
            background-color: #f8f9fa;
            border: 1px solid #ddd;
            border-top: none;
            border-radius: 0 0 8px 8px;
          }
          .button {
            display: inline-block;
            background-color: #FF6B6B;
            color: white;
            text-decoration: none;
            padding: 10px 20px;
            border-radius: 5px;
            margin-top: 15px;
          }
          .footer {
            margin-top: 20px;
            text-align: center;
            font-size: 0.8em;
            color: #888;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h2>Pairva</h2>
        </div>
        <div class="content">
          <h3>${title}</h3>
          <p>${body}</p>
          <a href="${actionUrl}" class="button">${actionText}</a>
        </div>
        <div class="footer">
          <p>© ${new Date().getFullYear()} Pairva. All rights reserved.</p>
          <p>
            <a href="https://pairva.ai/preferences/notifications">Manage Email Preferences</a> | 
            <a href="https://pairva.ai/privacy">Privacy Policy</a>
          </p>
        </div>
      </body>
      </html>
    `;

    // Plain text version
    const text = `
      ${title}
      
      ${body}
      
      ${actionText}: ${actionUrl}
      
      © ${new Date().getFullYear()} Pairva. All rights reserved.
      Manage Email Preferences: https://pairva.ai/preferences/notifications
    `;

    return { subject, html, text };
  }

  /**
   * Strip HTML tags for plain text emails
   */
  private stripHtml(html: string): string {
    return html.replace(/<[^>]*>/g, '');
  }
}
