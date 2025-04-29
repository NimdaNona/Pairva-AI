import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { PaymentService } from '../payment.service';
import Stripe from 'stripe';

// Mock Stripe constructor
jest.mock('stripe', () => {
  return jest.fn().mockImplementation(() => ({
    webhooks: {
      constructEvent: jest.fn(),
    },
    customers: {
      create: jest.fn(),
    },
    subscriptions: {
      create: jest.fn(),
      retrieve: jest.fn(),
      update: jest.fn(),
      cancel: jest.fn(),
    },
    prices: {
      create: jest.fn(),
    },
    products: {
      create: jest.fn(),
    },
    checkout: {
      sessions: {
        create: jest.fn(),
      },
    },
  }));
});

describe('PaymentService', () => {
  let service: PaymentService;
  let mockStripe: jest.Mocked<any>;
  let mockConfigService: Partial<ConfigService>;

  const mockWebhookSecret = 'whsec_test_secret';
  const mockStripeSecretKey = 'sk_test_key';

  beforeEach(async () => {
    mockConfigService = {
      get: jest.fn().mockImplementation((key: string) => {
        if (key === 'STRIPE_SECRET_KEY') return mockStripeSecretKey;
        if (key === 'STRIPE_WEBHOOK_SECRET') return mockWebhookSecret;
        return null;
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentService,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<PaymentService>(PaymentService);
    mockStripe = (Stripe as unknown as jest.Mock).mock.results[0].value;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('handleWebhookEvent', () => {
    const mockSignature = 'test_signature';
    const mockPayload = Buffer.from('{"type":"invoice.payment_succeeded","data":{"object":{"id":"inv_123"}}}');
    
    it('should throw BadRequestException if webhook secret is not configured', async () => {
      // Override the mockConfigService.get for this test
      mockConfigService.get = jest.fn((key) => {
        if (key === 'STRIPE_SECRET_KEY') return mockStripeSecretKey;
        return null; // Return null for webhook secret
      });

      await expect(service.handleWebhookEvent(mockSignature, mockPayload))
        .rejects.toThrow(BadRequestException);
    });

    it('should throw UnauthorizedException if signature verification fails', async () => {
      // Make constructEvent throw an error
      mockStripe.webhooks.constructEvent.mockImplementationOnce(() => {
        throw new Error('Invalid signature');
      });

      await expect(service.handleWebhookEvent(mockSignature, mockPayload))
        .rejects.toThrow(UnauthorizedException);
      
      expect(mockStripe.webhooks.constructEvent).toHaveBeenCalledWith(
        mockPayload,
        mockSignature,
        mockWebhookSecret
      );
    });

    it('should process invoice.payment_succeeded events', async () => {
      // Mock successful event construction
      const mockEvent = {
        id: 'evt_123',
        type: 'invoice.payment_succeeded',
        data: {
          object: { id: 'inv_123' },
        },
      };
      mockStripe.webhooks.constructEvent.mockReturnValueOnce(mockEvent);

      // Create a spy on the private method
      const handlePaymentSucceededSpy = jest.spyOn(service as any, 'handlePaymentSucceeded');
      handlePaymentSucceededSpy.mockResolvedValueOnce(undefined);

      await service.handleWebhookEvent(mockSignature, mockPayload);
      
      expect(mockStripe.webhooks.constructEvent).toHaveBeenCalledWith(
        mockPayload,
        mockSignature,
        mockWebhookSecret
      );
      expect(handlePaymentSucceededSpy).toHaveBeenCalledWith(mockEvent.data.object);
    });

    it('should process invoice.payment_failed events', async () => {
      // Mock successful event construction
      const mockEvent = {
        id: 'evt_123',
        type: 'invoice.payment_failed',
        data: {
          object: { id: 'inv_123' },
        },
      };
      mockStripe.webhooks.constructEvent.mockReturnValueOnce(mockEvent);

      // Create a spy on the private method
      const handlePaymentFailedSpy = jest.spyOn(service as any, 'handlePaymentFailed');
      handlePaymentFailedSpy.mockResolvedValueOnce(undefined);

      await service.handleWebhookEvent(mockSignature, mockPayload);
      
      expect(handlePaymentFailedSpy).toHaveBeenCalledWith(mockEvent.data.object);
    });

    it('should process customer.subscription.deleted events', async () => {
      // Mock successful event construction
      const mockEvent = {
        id: 'evt_123',
        type: 'customer.subscription.deleted',
        data: {
          object: { id: 'sub_123' },
        },
      };
      mockStripe.webhooks.constructEvent.mockReturnValueOnce(mockEvent);

      // Create a spy on the private method
      const handleSubscriptionCancelledSpy = jest.spyOn(service as any, 'handleSubscriptionCancelled');
      handleSubscriptionCancelledSpy.mockResolvedValueOnce(undefined);

      await service.handleWebhookEvent(mockSignature, mockPayload);
      
      expect(handleSubscriptionCancelledSpy).toHaveBeenCalledWith(mockEvent.data.object);
    });

    it('should process customer.subscription.updated events', async () => {
      // Mock successful event construction
      const mockEvent = {
        id: 'evt_123',
        type: 'customer.subscription.updated',
        data: {
          object: { id: 'sub_123' },
        },
      };
      mockStripe.webhooks.constructEvent.mockReturnValueOnce(mockEvent);

      // Create a spy on the private method
      const handleSubscriptionUpdatedSpy = jest.spyOn(service as any, 'handleSubscriptionUpdated');
      handleSubscriptionUpdatedSpy.mockResolvedValueOnce(undefined);

      await service.handleWebhookEvent(mockSignature, mockPayload);
      
      expect(handleSubscriptionUpdatedSpy).toHaveBeenCalledWith(mockEvent.data.object);
    });

    it('should handle unrecognized event types', async () => {
      // Mock successful event construction
      const mockEvent = {
        id: 'evt_123',
        type: 'unknown.event',
        data: {
          object: {},
        },
      };
      mockStripe.webhooks.constructEvent.mockReturnValueOnce(mockEvent);

      await service.handleWebhookEvent(mockSignature, mockPayload);
      
      // No handler methods should be called, but it should complete successfully
      expect(mockStripe.webhooks.constructEvent).toHaveBeenCalled();
    });

    it('should throw BadRequestException if event processing fails', async () => {
      // Mock successful event construction
      const mockEvent = {
        id: 'evt_123',
        type: 'invoice.payment_succeeded',
        data: {
          object: { id: 'inv_123' },
        },
      };
      mockStripe.webhooks.constructEvent.mockReturnValueOnce(mockEvent);

      // Create a spy on the private method that throws an error
      const handlePaymentSucceededSpy = jest.spyOn(service as any, 'handlePaymentSucceeded');
      handlePaymentSucceededSpy.mockRejectedValueOnce(new Error('Processing error'));

      await expect(service.handleWebhookEvent(mockSignature, mockPayload))
        .rejects.toThrow(BadRequestException);
      
      expect(handlePaymentSucceededSpy).toHaveBeenCalled();
    });
  });
});
