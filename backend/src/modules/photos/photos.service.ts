import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ProfilesService } from '../profiles/profiles.service';
import * as AWS from 'aws-sdk';
import { v4 as uuid } from 'uuid';
import * as sharp from 'sharp';
import { ProfileEntity } from '../profiles/entities/profile.entity';

@Injectable()
export class PhotosService {
  private readonly logger = new Logger(PhotosService.name);
  private readonly s3: AWS.S3;
  private readonly bucketName: string;
  private readonly cloudFrontDomain: string | undefined;

  constructor(
    private readonly configService: ConfigService,
    private readonly profilesService: ProfilesService,
  ) {
    // Initialize AWS S3 client
    this.s3 = new AWS.S3({
      region: this.configService.get<string>('AWS_REGION', 'us-east-1'),
    });
    this.bucketName = this.configService.get<string>('MEDIA_BUCKET_NAME', 'perfect-match-media-dev');
    this.cloudFrontDomain = this.configService.get<string>('CLOUDFRONT_DOMAIN');
  }

  /**
   * Upload a profile photo to S3
   * @param userId User's ID
   * @param profileId Profile ID
   * @param file File to upload
   * @param isMain Whether this is the main profile photo
   * @returns Updated profile with the new photo URL
   */
  async uploadProfilePhoto(
    userId: string, 
    profileId: string, 
    file: Express.Multer.File, 
    isMain: boolean = false
  ): Promise<ProfileEntity> {
    // First check if profile exists
    const profile = await this.profilesService.findOne(profileId);
    
    if (!profile) {
      throw new NotFoundException(`Profile with ID ${profileId} not found`);
    }

    try {
      // Process the image (resize, optimize, etc.)
      const processedImageBuffer = await this.processImage(file.buffer);
      
      // Generate a unique filename
      const fileExtension = file.originalname.split('.').pop();
      const filename = `${uuid()}.${fileExtension}`;
      const key = `profiles/${profileId}/${filename}`;
      
      // Upload to S3
      await this.s3.upload({
        Bucket: this.bucketName,
        Key: key,
        Body: processedImageBuffer,
        ContentType: file.mimetype,
        ACL: 'private', // Private access - will be served through CloudFront
      }).promise();
      
      // Construct the CloudFront URL
      let photoUrl: string;
      
      if (this.cloudFrontDomain) {
        // Use CloudFront if configured
        photoUrl = `https://${this.cloudFrontDomain}/media/${key}`;
      } else {
        // Fall back to direct S3 URL
        photoUrl = `https://${this.bucketName}.s3.amazonaws.com/${key}`;
      }
      
      // Add the photo to the profile
      return this.profilesService.addPhoto(userId, profileId, photoUrl, isMain);
    } catch (error) {
      this.logger.error(`Failed to upload photo for profile ${profileId}`, error.stack);
      throw new BadRequestException('Failed to upload photo. Please try again.');
    }
  }
  
  /**
   * Set a photo as the main profile photo
   * @param userId User's ID
   * @param profileId Profile ID
   * @param photoUrl URL of the photo to set as main
   * @returns Updated profile with the new main photo
   */
  async setMainPhoto(userId: string, profileId: string, photoUrl: string): Promise<ProfileEntity> {
    return this.profilesService.setMainPhoto(userId, profileId, photoUrl);
  }
  
  /**
   * Delete a profile photo
   * @param userId User's ID
   * @param profileId Profile ID
   * @param photoUrl URL of the photo to delete
   * @returns Updated profile without the deleted photo
   */
  async deletePhoto(userId: string, profileId: string, photoUrl: string): Promise<ProfileEntity> {
    const profile = await this.profilesService.findOne(profileId);
    
    if (!profile) {
      throw new NotFoundException(`Profile with ID ${profileId} not found`);
    }
    
    // Delete from S3 if it's an S3 URL
    if (photoUrl.includes('amazonaws.com') || (this.cloudFrontDomain && photoUrl.includes(this.cloudFrontDomain))) {
      try {
        // Extract the key from the URL
        let key: string | undefined;
        
        if (photoUrl.includes('amazonaws.com')) {
          // Parse S3 URL
          const urlParts = photoUrl.split('.s3.amazonaws.com/');
          if (urlParts.length > 1) {
            key = urlParts[1];
          }
        } else if (this.cloudFrontDomain && photoUrl.includes(this.cloudFrontDomain)) {
          // Parse CloudFront URL
          const mediaParts = photoUrl.split('/media/');
          if (mediaParts.length > 1) {
            key = mediaParts[1];
          }
        }
        
        // Delete from S3 if we extracted a valid key
        if (key) {
          await this.s3.deleteObject({
            Bucket: this.bucketName,
            Key: key,
          }).promise();
        }
      } catch (error) {
        this.logger.error(`Failed to delete photo from S3: ${photoUrl}`, error.stack);
        // Continue anyway so we can at least remove it from the profile
      }
    }
    
    // Remove the photo from the profile
    return this.profilesService.removePhoto(userId, profileId, photoUrl);
  }
  
  /**
   * Process an image before upload (resize, optimize, etc.)
   * @param buffer Original image buffer
   * @returns Processed image buffer
   */
  private async processImage(buffer: Buffer): Promise<Buffer> {
    try {
      // Resize the image to a maximum width and height while preserving aspect ratio
      // Also convert to JPEG format for consistent format and good quality/size balance
      return await sharp(buffer)
        .resize({
          width: 1200,
          height: 1200,
          fit: 'inside',
          withoutEnlargement: true,
        })
        .jpeg({ quality: 80, progressive: true })
        .toBuffer();
    } catch (error) {
      this.logger.error('Failed to process image', error.stack);
      return buffer; // Return original if processing fails
    }
  }
}
