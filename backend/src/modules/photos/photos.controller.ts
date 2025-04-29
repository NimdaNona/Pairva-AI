import {
  Controller,
  Post,
  Patch,
  Delete,
  Param,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
  UseGuards,
  Query,
  Request,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Express, Request as ExpressRequest } from 'express';
import { PhotosService } from './photos.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ApiTags, ApiConsumes, ApiOperation, ApiBody, ApiParam } from '@nestjs/swagger';

interface RequestWithUser extends ExpressRequest {
  user: {
    id: string;
    email: string;
  };
}

@ApiTags('photos')
@Controller('photos')
@UseGuards(JwtAuthGuard)
export class PhotosController {
  constructor(private readonly photosService: PhotosService) {}

  @Post(':profileId')
  @ApiOperation({ summary: 'Upload a profile photo' })
  @ApiConsumes('multipart/form-data')
  @ApiParam({ name: 'profileId', type: String })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
        isMain: {
          type: 'boolean',
          default: false,
        },
      },
    },
  })
  @UseInterceptors(
    FileInterceptor('file', {
      limits: {
        fileSize: 5 * 1024 * 1024, // 5MB
      },
      fileFilter: (req, file, callback) => {
        // Check if image
        if (!file.mimetype.includes('image')) {
          return callback(
            new BadRequestException('File must be an image (JPEG, PNG, etc.)'),
            false,
          );
        }
        callback(null, true);
      },
    }),
  )
  async uploadPhoto(
    @Request() req: RequestWithUser,
    @Param('profileId') profileId: string,
    @UploadedFile() file: Express.Multer.File,
    @Query('isMain') isMain?: string,
  ) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    const userId = req.user.id;
    const isMainBool = isMain === 'true';
    
    return this.photosService.uploadProfilePhoto(
      userId,
      profileId,
      file,
      isMainBool,
    );
  }

  @Patch(':profileId/photos/:photoUrl/main')
  @ApiOperation({ summary: 'Set a photo as the main profile photo' })
  @ApiParam({ name: 'profileId', type: String })
  @ApiParam({ name: 'photoUrl', type: String })
  async setMainPhoto(
    @Request() req: RequestWithUser,
    @Param('profileId') profileId: string,
    @Param('photoUrl') photoUrl: string,
  ) {
    const userId = req.user.id;
    const decodedUrl = decodeURIComponent(photoUrl);
    
    return this.photosService.setMainPhoto(userId, profileId, decodedUrl);
  }

  @Delete(':profileId/photos/:photoUrl')
  @ApiOperation({ summary: 'Delete a profile photo' })
  @ApiParam({ name: 'profileId', type: String })
  @ApiParam({ name: 'photoUrl', type: String })
  async deletePhoto(
    @Request() req: RequestWithUser,
    @Param('profileId') profileId: string,
    @Param('photoUrl') photoUrl: string,
  ) {
    const userId = req.user.id;
    const decodedUrl = decodeURIComponent(photoUrl);
    
    return this.photosService.deletePhoto(userId, profileId, decodedUrl);
  }
}
