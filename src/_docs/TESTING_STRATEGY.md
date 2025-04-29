# Testing Strategy for Perfect Match

This document outlines the comprehensive testing strategy implemented in the Perfect Match application to ensure code quality, reliability, and prevent regressions.

## Overview

Our testing approach follows the testing pyramid principle:
- **Unit Tests**: Forming the base of our pyramid with the highest number of tests
- **Integration Tests**: Middle layer connecting multiple units
- **End-to-End Tests**: Top of the pyramid, covering critical user flows

All tests are integrated into the CI/CD pipeline to ensure continuous quality assurance.

## Frontend Testing (React + Next.js)

### Unit Testing with Jest and React Testing Library

```typescript
// Component Unit Test Example
// src/components/profile/steps/__tests__/BasicInfoStep.test.tsx

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BasicInfoStep } from '../BasicInfoStep';
import { ProfileContext } from '../../../../hooks/profile/useProfileSetup';

describe('BasicInfoStep', () => {
  const mockSetProfile = jest.fn();
  const mockNextStep = jest.fn();
  
  const defaultProps = {
    onNext: mockNextStep,
  };
  
  const mockProfileContext = {
    profile: {
      basicInfo: {
        firstName: '',
        lastName: '',
        birthdate: '',
        gender: '',
      }
    },
    setProfile: mockSetProfile,
    isLoading: false,
    error: null,
  };
  
  const renderComponent = (props = {}) => {
    return render(
      <ProfileContext.Provider value={mockProfileContext}>
        <BasicInfoStep {...defaultProps} {...props} />
      </ProfileContext.Provider>
    );
  };
  
  beforeEach(() => {
    jest.clearAllMocks();
  });
  
  it('renders form fields correctly', () => {
    renderComponent();
    
    expect(screen.getByLabelText(/first name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/last name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/birthdate/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/gender/i)).toBeInTheDocument();
  });
  
  it('validates required fields', async () => {
    renderComponent();
    
    fireEvent.click(screen.getByRole('button', { name: /next/i }));
    
    await waitFor(() => {
      expect(screen.getByText(/first name is required/i)).toBeInTheDocument();
      expect(screen.getByText(/last name is required/i)).toBeInTheDocument();
      expect(screen.getByText(/birthdate is required/i)).toBeInTheDocument();
      expect(screen.getByText(/gender is required/i)).toBeInTheDocument();
    });
    
    expect(mockNextStep).not.toHaveBeenCalled();
  });
  
  it('updates profile and proceeds to next step on valid submission', async () => {
    renderComponent();
    
    fireEvent.change(screen.getByLabelText(/first name/i), { target: { value: 'John' } });
    fireEvent.change(screen.getByLabelText(/last name/i), { target: { value: 'Doe' } });
    fireEvent.change(screen.getByLabelText(/birthdate/i), { target: { value: '1990-01-01' } });
    fireEvent.click(screen.getByLabelText(/male/i));
    
    fireEvent.click(screen.getByRole('button', { name: /next/i }));
    
    await waitFor(() => {
      expect(mockSetProfile).toHaveBeenCalledWith(expect.objectContaining({
        basicInfo: {
          firstName: 'John',
          lastName: 'Doe',
          birthdate: '1990-01-01',
          gender: 'male',
        }
      }));
      expect(mockNextStep).toHaveBeenCalled();
    });
  });
});
```

### Hook Testing

```typescript
// Hook Unit Test Example
// src/hooks/profile/__tests__/useProfileSetup.test.tsx

import { renderHook, act } from '@testing-library/react-hooks';
import { useProfileSetup } from '../useProfileSetup';
import { profileApi } from '../../../lib/profile/profileApi';

// Mock the API module
jest.mock('../../../lib/profile/profileApi', () => ({
  profileApi: {
    createProfile: jest.fn(),
    updateProfile: jest.fn(),
    getProfile: jest.fn(),
  }
}));

describe('useProfileSetup', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });
  
  it('initializes with empty profile', () => {
    const { result } = renderHook(() => useProfileSetup());
    
    expect(result.current.profile).toEqual({
      basicInfo: {},
      attributes: {},
      photos: [],
      bioInterests: {
        bio: '',
        interests: [],
      },
      preferences: {},
      relationshipPreferences: {},
    });
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
  });
  
  it('updates profile correctly', () => {
    const { result } = renderHook(() => useProfileSetup());
    
    act(() => {
      result.current.setProfile({
        ...result.current.profile,
        basicInfo: {
          firstName: 'John',
          lastName: 'Doe',
        }
      });
    });
    
    expect(result.current.profile.basicInfo).toEqual({
      firstName: 'John',
      lastName: 'Doe',
    });
  });
  
  it('saves profile successfully', async () => {
    (profileApi.createProfile as jest.Mock).mockResolvedValue({ id: '123', success: true });
    
    const { result, waitForNextUpdate } = renderHook(() => useProfileSetup());
    
    act(() => {
      result.current.setProfile({
        basicInfo: { firstName: 'John' },
        attributes: { height: 180 },
        photos: [{ url: 'photo1.jpg' }],
        bioInterests: { bio: 'My bio', interests: ['music'] },
        preferences: { minAge: 25 },
        relationshipPreferences: { type: 'serious' },
      });
    });
    
    act(() => {
      result.current.saveProfile();
    });
    
    expect(result.current.isLoading).toBe(true);
    
    await waitForNextUpdate();
    
    expect(profileApi.createProfile).toHaveBeenCalledWith({
      basicInfo: { firstName: 'John' },
      attributes: { height: 180 },
      photos: [{ url: 'photo1.jpg' }],
      bioInterests: { bio: 'My bio', interests: ['music'] },
      preferences: { minAge: 25 },
      relationshipPreferences: { type: 'serious' },
    });
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.profileId).toBe('123');
  });
  
  it('handles API errors', async () => {
    const errorMessage = 'Network error';
    (profileApi.createProfile as jest.Mock).mockRejectedValue(new Error(errorMessage));
    
    const { result, waitForNextUpdate } = renderHook(() => useProfileSetup());
    
    act(() => {
      result.current.saveProfile();
    });
    
    await waitForNextUpdate();
    
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBe(errorMessage);
  });
});
```

### API Service Testing

```typescript
// API Service Test Example
// src/lib/matches/__tests__/matchesApi.test.ts

import { matchesApi } from '../matchesApi';
import axios from 'axios';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('matchesApi', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });
  
  describe('getMatches', () => {
    it('fetches matches successfully', async () => {
      const matches = [
        { id: '1', userId: 'user1', matchedUserId: 'user2', score: 0.95 },
        { id: '2', userId: 'user1', matchedUserId: 'user3', score: 0.87 },
      ];
      
      mockedAxios.get.mockResolvedValueOnce({ data: matches });
      
      const result = await matchesApi.getMatches();
      
      expect(mockedAxios.get).toHaveBeenCalledWith('/api/matches');
      expect(result).toEqual(matches);
    });
    
    it('handles errors correctly', async () => {
      const errorMessage = 'Network Error';
      mockedAxios.get.mockRejectedValueOnce(new Error(errorMessage));
      
      await expect(matchesApi.getMatches()).rejects.toThrow(errorMessage);
    });
  });
  
  describe('updateMatchStatus', () => {
    it('updates match status successfully', async () => {
      const matchId = '1';
      const status = 'accepted';
      const updatedMatch = { id: matchId, status };
      
      mockedAxios.patch.mockResolvedValueOnce({ data: updatedMatch });
      
      const result = await matchesApi.updateMatchStatus(matchId, status);
      
      expect(mockedAxios.patch).toHaveBeenCalledWith(`/api/matches/${matchId}/status`, { status });
      expect(result).toEqual(updatedMatch);
    });
  });
});
```

### Redux/Context State Testing

```typescript
// Redux State Test Example
// src/store/__tests__/auth.slice.test.ts

import authReducer, {
  setUser,
  logout,
  loginStart,
  loginSuccess,
  loginFailure,
  initialState
} from '../auth.slice';

describe('auth slice', () => {
  it('should return the initial state on first run', () => {
    expect(authReducer(undefined, { type: 'unknown' })).toEqual(initialState);
  });
  
  it('should handle setUser', () => {
    const user = { id: '123', email: 'test@example.com', name: 'Test User' };
    const nextState = authReducer(initialState, setUser(user));
    
    expect(nextState.user).toEqual(user);
  });
  
  it('should handle logout', () => {
    const startState = {
      user: { id: '123', email: 'test@example.com' },
      isLoading: false,
      error: null,
      isAuthenticated: true
    };
    
    const nextState = authReducer(startState, logout());
    
    expect(nextState).toEqual(initialState);
  });
  
  it('should handle login flow', () => {
    // Login start
    let nextState = authReducer(initialState, loginStart());
    expect(nextState.isLoading).toBe(true);
    expect(nextState.error).toBeNull();
    
    // Login success
    const user = { id: '123', email: 'test@example.com' };
    nextState = authReducer(nextState, loginSuccess(user));
    expect(nextState.isLoading).toBe(false);
    expect(nextState.user).toEqual(user);
    expect(nextState.isAuthenticated).toBe(true);
    
    // Login failure
    const error = 'Invalid credentials';
    nextState = authReducer(initialState, loginFailure(error));
    expect(nextState.isLoading).toBe(false);
    expect(nextState.error).toBe(error);
    expect(nextState.isAuthenticated).toBe(false);
  });
});
```

### Integration Testing with Mock Server Worker (MSW)

```typescript
// Integration Test Example with MSW
// src/components/matches/__tests__/MatchesList.integration.test.tsx

import { rest } from 'msw';
import { setupServer } from 'msw/node';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClientProvider, QueryClient } from 'react-query';
import MatchesList from '../MatchesList';

// Mock data
const mockMatches = [
  { id: '1', matchedUserId: 'user2', score: 0.95, status: 'pending' },
  { id: '2', matchedUserId: 'user3', score: 0.87, status: 'pending' },
];

const mockUsers = {
  user2: { id: 'user2', name: 'Jane Doe', photos: [{ url: 'jane.jpg' }] },
  user3: { id: 'user3', name: 'Alice Smith', photos: [{ url: 'alice.jpg' }] },
};

// Set up request handlers
const server = setupServer(
  rest.get('/api/matches', (req, res, ctx) => {
    return res(ctx.status(200), ctx.json(mockMatches));
  }),
  
  rest.get('/api/users/:userId', (req, res, ctx) => {
    const { userId } = req.params;
    return res(ctx.status(200), ctx.json(mockUsers[userId]));
  }),
  
  rest.patch('/api/matches/:matchId/status', (req, res, ctx) => {
    const { matchId } = req.params;
    const { status } = req.body;
    
    const updatedMatch = { ...mockMatches.find(m => m.id === matchId), status };
    return res(ctx.status(200), ctx.json(updatedMatch));
  })
);

// Establish API mocking before tests
beforeAll(() => server.listen());
// Reset any request handlers that we may add during the tests
afterEach(() => server.resetHandlers());
// Clean up after the tests are done
afterAll(() => server.close());

describe('MatchesList Integration', () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        // Turn off retries to make testing easier
        retry: false,
      },
    },
  });

  it('loads and displays matches', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <MatchesList />
      </QueryClientProvider>
    );
    
    // Should show loading state initially
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
    
    // Wait for matches to load
    await waitFor(() => {
      expect(screen.getByText('Jane Doe')).toBeInTheDocument();
      expect(screen.getByText('Alice Smith')).toBeInTheDocument();
    });
    
    // Should display match scores
    expect(screen.getByText('95% Match')).toBeInTheDocument();
    expect(screen.getByText('87% Match')).toBeInTheDocument();
  });
  
  it('handles accepting/rejecting matches', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <MatchesList />
      </QueryClientProvider>
    );
    
    // Wait for matches to load
    await waitFor(() => {
      expect(screen.getByText('Jane Doe')).toBeInTheDocument();
    });
    
    // Accept the first match
    userEvent.click(screen.getAllByLabelText(/accept/i)[0]);
    
    // Verify API was called and UI updated
    await waitFor(() => {
      expect(screen.getByText(/accepted/i)).toBeInTheDocument();
    });
    
    // Reject the second match
    userEvent.click(screen.getAllByLabelText(/reject/i)[0]);
    
    // Verify API was called and UI updated
    await waitFor(() => {
      expect(screen.getByText(/rejected/i)).toBeInTheDocument();
    });
  });
  
  it('handles API errors gracefully', async () => {
    // Override the matches endpoint to return an error
    server.use(
      rest.get('/api/matches', (req, res, ctx) => {
        return res(ctx.status(500), ctx.json({ message: 'Server error' }));
      })
    );
    
    render(
      <QueryClientProvider client={queryClient}>
        <MatchesList />
      </QueryClientProvider>
    );
    
    // Should show error message
    await waitFor(() => {
      expect(screen.getByText(/error loading matches/i)).toBeInTheDocument();
    });
  });
});
```

### End-to-End Testing with Cypress

```typescript
// Cypress E2E Test Example
// cypress/e2e/profile-setup.cy.ts

describe('Profile Setup Flow', () => {
  beforeEach(() => {
    // Mock the auth token
    cy.intercept('POST', '/api/auth/refresh-token', {
      statusCode: 200,
      body: { token: 'valid-token', expiresIn: 3600 }
    });
    
    // Set auth cookie to bypass login
    cy.setCookie('auth_token', 'valid-token');
    
    // Visit the profile setup page
    cy.visit('/profile/setup');
  });
  
  it('completes all steps of the profile setup wizard', () => {
    // Step 1: Basic Info
    cy.get('[data-testid="first-name-input"]').type('John');
    cy.get('[data-testid="last-name-input"]').type('Doe');
    cy.get('[data-testid="birthdate-input"]').type('1990-01-01');
    cy.get('[data-testid="gender-select"]').click();
    cy.get('[data-testid="gender-option-male"]').click();
    cy.get('[data-testid="next-button"]').click();
    
    // Step 2: Attributes
    cy.get('[data-testid="height-slider"]').click('center');
    cy.get('[data-testid="education-select"]').click();
    cy.get('[data-testid="education-option-bachelors"]').click();
    cy.get('[data-testid="next-button"]').click();
    
    // Step 3: Bio & Interests
    cy.get('[data-testid="bio-textarea"]').type('I enjoy hiking and reading books.');
    cy.get('[data-testid="interest-chips"] input').type('Hiking{enter}');
    cy.get('[data-testid="interest-chips"] input').type('Reading{enter}');
    cy.get('[data-testid="interest-chips"] input').type('Travel{enter}');
    cy.get('[data-testid="next-button"]').click();
    
    // Step 4: Photos
    // Mock file upload
    cy.intercept('POST', '/api/photos/upload', {
      statusCode: 200,
      body: { url: 'https://example.com/photo.jpg' }
    });
    
    cy.get('[data-testid="photo-upload-input"]').attachFile('test-photo.jpg');
    cy.get('[data-testid="uploaded-photo"]').should('be.visible');
    cy.get('[data-testid="next-button"]').click();
    
    // Step 5: Preferences
    cy.get('[data-testid="age-range-slider"]').click('center');
    cy.get('[data-testid="distance-slider"]').click('right');
    cy.get('[data-testid="gender-preference-select"]').click();
    cy.get('[data-testid="gender-preference-option-female"]').click();
    cy.get('[data-testid="next-button"]').click();
    
    // Step 6: Relationship Preferences
    cy.get('[data-testid="relationship-type-select"]').click();
    cy.get('[data-testid="relationship-type-option-serious"]').click();
    cy.get('[data-testid="next-button"]').click();
    
    // Step 7: Review
    cy.get('[data-testid="profile-review-section"]').should('contain', 'John Doe');
    cy.get('[data-testid="profile-review-section"]').should('contain', 'Hiking');
    cy.get('[data-testid="profile-review-section"]').should('contain', 'Reading');
    
    // Mock profile submission
    cy.intercept('POST', '/api/profiles', {
      statusCode: 201,
      body: { id: 'profile-123', success: true }
    });
    
    cy.get('[data-testid="submit-button"]').click();
    
    // Verify redirect to dashboard after completion
    cy.url().should('include', '/dashboard');
    cy.get('[data-testid="setup-complete-message"]').should('be.visible');
  });
  
  it('validates required fields', () => {
    // Try to proceed with empty fields
    cy.get('[data-testid="next-button"]').click();
    
    // Check validation messages
    cy.get('[data-testid="first-name-error"]').should('be.visible');
    cy.get('[data-testid="last-name-error"]').should('be.visible');
    cy.get('[data-testid="birthdate-error"]').should('be.visible');
    cy.get('[data-testid="gender-error"]').should('be.visible');
  });
});
```

## Backend Testing (NestJS)

### Unit Testing with Jest

```typescript
// Service Unit Test Example
// src/modules/profiles/profiles.service.spec.ts

import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ProfilesService } from './profiles.service';
import { Profile } from './entities/profile.entity';
import { CreateProfileDto } from './dto/create-profile.dto';
import { CacheModule } from '@nestjs/common';

describe('ProfilesService', () => {
  let service: ProfilesService;
  let model: Model<Profile>;
  
  const mockProfile = {
    id: 'profile-id',
    userId: 'user-id',
    basicInfo: {
      firstName: 'John',
      lastName: 'Doe',
    },
    attributes: {},
    photos: [],
    bioInterests: {
      bio: 'Test bio',
      interests: ['music'],
    },
    preferences: {},
    relationshipPreferences: {},
  };
  
  const mockProfileModel = {
    create: jest.fn(),
    findOne: jest.fn(),
    findOneAndUpdate: jest.fn(),
    exists: jest.fn(),
  };
  
  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [CacheModule.register()],
      providers: [
        ProfilesService,
        {
          provide: getModelToken(Profile.name),
          useValue: mockProfileModel,
        },
      ],
    }).compile();
    
    service = module.get<ProfilesService>(ProfilesService);
    model = module.get<Model<Profile>>(getModelToken(Profile.name));
  });
  
  it('should be defined', () => {
    expect(service).toBeDefined();
  });
  
  describe('create', () => {
    it('should create a new profile', async () => {
      const createProfileDto: CreateProfileDto = {
        userId: 'user-id',
        basicInfo: { firstName: 'John', lastName: 'Doe' },
        bioInterests: { bio: 'Test bio', interests: ['music'] },
        attributes: {},
        photos: [],
        preferences: {},
        relationshipPreferences: {},
      };
      
      mockProfileModel.exists.mockResolvedValueOnce(false);
      mockProfileModel.create.mockResolvedValueOnce(mockProfile);
      
      const result = await service.create(createProfileDto);
      
      expect(mockProfileModel.exists).toHaveBeenCalledWith({ userId: 'user-id' });
      expect(mockProfileModel.create).toHaveBeenCalledWith(createProfileDto);
      expect(result).toEqual(mockProfile);
    });
    
    it('should throw error if profile already exists', async () => {
      mockProfileModel.exists.mockResolvedValueOnce(true);
      
      const createProfileDto: CreateProfileDto = {
        userId: 'user-id',
        basicInfo: {},
        attributes: {},
        photos: [],
        bioInterests: { bio: '', interests: [] },
        preferences: {},
        relationshipPreferences: {},
      };
      
      await expect(service.create(createProfileDto)).rejects.toThrow(
        'Profile already exists for this user'
      );
    });
  });
  
  describe('findOne', () => {
    it('should return a profile by userId', async () => {
      mockProfileModel.findOne.mockResolvedValueOnce(mockProfile);
      
      const result = await service.findByUserId('user-id');
      
      expect(mockProfileModel.findOne).toHaveBeenCalledWith({ userId: 'user-id' });
      expect(result).toEqual(mockProfile);
    });
    
    it('should return null if profile not found', async () => {
      mockProfileModel.findOne.mockResolvedValueOnce(null);
      
      const result = await service.findByUserId('non-existent-id');
      
      expect(result).toBeNull();
    });
  });
  
  describe('update', () => {
    it('should update a profile', async () => {
      const updateProfileDto = {
        basicInfo: { firstName: 'Jane' },
      };
      
      mockProfileModel.findOneAndUpdate.mockResolvedValueOnce({
        ...mockProfile,
        basicInfo: { ...mockProfile.basicInfo, firstName: 'Jane' },
      });
      
      const result = await service.update('user-id', updateProfileDto);
      
      expect(mockProfileModel.findOneAndUpdate).toHaveBeenCalledWith(
        { userId: 'user-id' },
        { $set: updateProfileDto },
        { new: true }
      );
      
      expect(result.basicInfo.firstName).toBe('Jane');
    });
    
    it('should throw error if profile not found', async () => {
      mockProfileModel.findOneAndUpdate.mockResolvedValueOnce(null);
      
      await expect(service.update('non-existent-id', {})).rejects.toThrow(
        'Profile not found'
      );
    });
  });
});
```

### Controller Unit Testing

```typescript
// Controller Unit Test Example
// src/modules/questionnaire/questionnaire.controller.spec.ts

import { Test, TestingModule } from '@nestjs/testing';
import { QuestionnaireController } from './questionnaire.controller';
import { QuestionnaireService } from './questionnaire.service';
import { CreateQuestionnaireDto } from './dto/create-questionnaire.dto';
import { SubmitResponseDto } from './dto/submit-response.dto';

describe('QuestionnaireController', () => {
  let controller: QuestionnaireController;
  
  const mockQuestionnaireService = {
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
    submitResponse: jest.fn(),
    getUserResponses: jest.fn(),
  };
  
  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [QuestionnaireController],
      providers: [
        {
          provide: QuestionnaireService,
          useValue: mockQuestionnaireService,
        },
      ],
    }).compile();
    
    controller = module.get<QuestionnaireController>(QuestionnaireController);
  });
  
  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
  
  describe('create', () => {
    it('should create a questionnaire', async () => {
      const createQuestionnaireDto: CreateQuestionnaireDto = {
        title: 'Personality Test',
        description: 'Discover your personality type',
        questions: [
          {
            text: 'How do you recharge?',
            type: 'multiple_choice',
            options: ['Alone time', 'Social gatherings'],
            category: 'personality',
          },
        ],
        active: true,
      };
      
      const expectedResult = {
        id: 'questionnaire-id',
        ...createQuestionnaireDto,
      };
      
      mockQuestionnaireService.create.mockResolvedValueOnce(expectedResult);
      
      const req = { user: { userId: 'admin-id' } };
      const result = await controller.create(createQuestionnaireDto, req);
      
      expect(mockQuestionnaireService.create).toHaveBeenCalledWith({
        ...createQuestionnaireDto,
        createdBy: 'admin-id',
      });
      expect(result).toEqual(expectedResult);
    });
  });
  
  describe('submitResponse', () => {
    it('should submit a questionnaire response', async () => {
      const submitResponseDto: SubmitResponseDto = {
        questionnaireId: 'questionnaire-id',
        answers: [
          {
            questionId: 'question-id',
            value: 'Alone time',
          },
        ],
      };
      
      const expectedResult = {
        id: 'response-id',
        userId: 'user-id',
        ...submitResponseDto,
      };
      
      mockQuestionnaireService.submitResponse.mockResolvedValueOnce(expectedResult);
      
      const req = { user: { userId: 'user-id' } };
      const result = await controller.submitResponse(submitResponseDto, req);
      
      expect(mockQuestionnaireService.submitResponse).toHaveBeenCalledWith({
        ...submitResponseDto,
        userId: 'user-id',
      });
      expect(result).toEqual(expectedResult);
    });
  });
  
  describe('findAll', () => {
    it('should return all active questionnaires', async () => {
      const expectedResult = [
        {
          id: 'questionnaire-id',
          title: 'Personality Test',
          description: 'Discover your personality type',
          active: true,
        },
      ];
      
      mockQuestionnaireService.findAll.mockResolvedValueOn
