import { Injectable, NotFoundException, BadRequestException, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProfileEntity } from './entities/profile.entity';
import { CreateProfileDto } from './dto/create-profile.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UserEntity } from '../auth/entities/user.entity';

@Injectable()
export class ProfilesService {
  constructor(
    @InjectRepository(ProfileEntity)
    private readonly profileRepository: Repository<ProfileEntity>,
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,
  ) {}

  /**
   * Create a new profile for a user
   */
  async create(userId: string, createProfileDto: CreateProfileDto): Promise<ProfileEntity> {
    // Check if user exists
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    // Check if profile already exists for user
    const existingProfile = await this.profileRepository.findOne({ where: { userId } });
    if (existingProfile) {
      throw new BadRequestException(`Profile already exists for user with ID ${userId}`);
    }

    // Create new profile
    const profile = this.profileRepository.create({
      ...createProfileDto,
      userId,
    });

    // Check profile completion status
    profile.updateCompletionStatus();

    // Save profile
    const savedProfile = await this.profileRepository.save(profile);

    // Update user's profileCompleted status
    if (profile.isProfileComplete) {
      await this.userRepository.update(userId, { profileCompleted: true });
    }

    return savedProfile;
  }

  /**
   * Get all profiles (admin only)
   */
  async findAll(): Promise<ProfileEntity[]> {
    return this.profileRepository.find();
  }

  /**
   * Get profiles with pagination and filters
   */
  async findAllPaginated(options: {
    page?: number;
    limit?: number;
    filters?: Record<string, any>;
  }): Promise<{ profiles: ProfileEntity[]; total: number; page: number; limit: number }> {
    const { page = 1, limit = 10, filters = {} } = options;
    const skip = (page - 1) * limit;

    const [profiles, total] = await this.profileRepository.findAndCount({
      where: filters,
      skip,
      take: limit,
      order: { updatedAt: 'DESC' },
    });

    return {
      profiles,
      total,
      page,
      limit,
    };
  }

  /**
   * Get a single profile by ID
   */
  async findOne(id: string): Promise<ProfileEntity> {
    const profile = await this.profileRepository.findOne({ where: { id } });
    if (!profile) {
      throw new NotFoundException(`Profile with ID ${id} not found`);
    }
    return profile;
  }

  /**
   * Get a user's profile by their user ID
   */
  async findByUserId(userId: string): Promise<ProfileEntity> {
    const profile = await this.profileRepository.findOne({ where: { userId } });
    if (!profile) {
      throw new NotFoundException(`Profile for user with ID ${userId} not found`);
    }
    return profile;
  }

  /**
   * Update a user's profile
   */
  async update(userId: string, profileId: string, updateProfileDto: UpdateProfileDto): Promise<ProfileEntity> {
    // Find the profile
    const profile = await this.profileRepository.findOne({ where: { id: profileId } });
    if (!profile) {
      throw new NotFoundException(`Profile with ID ${profileId} not found`);
    }

    // Ensure user is updating their own profile
    if (profile.userId !== userId) {
      throw new UnauthorizedException('You can only update your own profile');
    }

    // Update profile
    Object.assign(profile, updateProfileDto);

    // Check profile completion status
    const wasComplete = profile.isProfileComplete;
    profile.updateCompletionStatus();
    
    // Save updated profile
    const updatedProfile = await this.profileRepository.save(profile);

    // If profile completion status changed, update user record
    if (wasComplete !== profile.isProfileComplete) {
      await this.userRepository.update(userId, { profileCompleted: profile.isProfileComplete });
    }

    return updatedProfile;
  }

  /**
   * Delete a profile
   */
  async remove(userId: string, profileId: string): Promise<void> {
    // Find the profile
    const profile = await this.profileRepository.findOne({ where: { id: profileId } });
    if (!profile) {
      throw new NotFoundException(`Profile with ID ${profileId} not found`);
    }

    // Ensure user is deleting their own profile
    if (profile.userId !== userId) {
      throw new UnauthorizedException('You can only delete your own profile');
    }

    // Delete profile
    await this.profileRepository.remove(profile);

    // Update user's profileCompleted status
    await this.userRepository.update(userId, { profileCompleted: false });
  }
  
  /**
   * Update profile photo
   */
  async addPhoto(userId: string, profileId: string, photoUrl: string, isMain: boolean = false): Promise<ProfileEntity> {
    // Find the profile
    const profile = await this.profileRepository.findOne({ where: { id: profileId } });
    if (!profile) {
      throw new NotFoundException(`Profile with ID ${profileId} not found`);
    }

    // Ensure user is updating their own profile
    if (profile.userId !== userId) {
      throw new UnauthorizedException('You can only update your own profile');
    }

    // Initialize photos array if it doesn't exist
    if (!profile.photos) {
      profile.photos = [];
    }

    // If this is the first photo or isMain is true, set it as the main photo
    if (isMain || profile.photos.length === 0) {
      // Update any existing main photo
      profile.photos = profile.photos.map(photo => ({
        ...photo,
        isMain: false,
      }));
    }

    // Add new photo
    profile.photos.push({
      url: photoUrl,
      order: profile.photos.length,
      isMain: isMain || profile.photos.length === 0,
    });

    // Check profile completion status
    const wasComplete = profile.isProfileComplete;
    profile.updateCompletionStatus();

    // Save updated profile
    const updatedProfile = await this.profileRepository.save(profile);

    // If profile completion status changed, update user record
    if (!wasComplete && profile.isProfileComplete) {
      await this.userRepository.update(userId, { profileCompleted: true });
    }

    return updatedProfile;
  }

  /**
   * Remove profile photo
   */
  async removePhoto(userId: string, profileId: string, photoUrl: string): Promise<ProfileEntity> {
    // Find the profile
    const profile = await this.profileRepository.findOne({ where: { id: profileId } });
    if (!profile) {
      throw new NotFoundException(`Profile with ID ${profileId} not found`);
    }

    // Ensure user is updating their own profile
    if (profile.userId !== userId) {
      throw new UnauthorizedException('You can only update your own profile');
    }

    // Find the photo
    const photoIndex = profile.photos.findIndex(photo => photo.url === photoUrl);
    if (photoIndex === -1) {
      throw new NotFoundException(`Photo with URL ${photoUrl} not found`);
    }

    // Check if it's the main photo
    const removingMainPhoto = profile.photos[photoIndex].isMain;

    // Remove the photo
    profile.photos.splice(photoIndex, 1);

    // If we removed the main photo and there are other photos, set the first one as main
    if (removingMainPhoto && profile.photos.length > 0) {
      profile.photos[0].isMain = true;
    }

    // Reorder remaining photos
    profile.photos = profile.photos.map((photo, index) => ({
      ...photo,
      order: index,
    }));

    // Check profile completion status
    const wasComplete = profile.isProfileComplete;
    profile.updateCompletionStatus();

    // Save updated profile
    const updatedProfile = await this.profileRepository.save(profile);

    // If profile completion status changed, update user record
    if (wasComplete && !profile.isProfileComplete) {
      await this.userRepository.update(userId, { profileCompleted: false });
    }

    return updatedProfile;
  }

  /**
   * Set main photo
   */
  async setMainPhoto(userId: string, profileId: string, photoUrl: string): Promise<ProfileEntity> {
    // Find the profile
    const profile = await this.profileRepository.findOne({ where: { id: profileId } });
    if (!profile) {
      throw new NotFoundException(`Profile with ID ${profileId} not found`);
    }

    // Ensure user is updating their own profile
    if (profile.userId !== userId) {
      throw new UnauthorizedException('You can only update your own profile');
    }

    // Find the photo
    const photoIndex = profile.photos.findIndex(photo => photo.url === photoUrl);
    if (photoIndex === -1) {
      throw new NotFoundException(`Photo with URL ${photoUrl} not found`);
    }

    // Update main photo status
    profile.photos = profile.photos.map((photo, index) => ({
      ...photo,
      isMain: index === photoIndex,
    }));

    // Save updated profile
    return this.profileRepository.save(profile);
  }
}
