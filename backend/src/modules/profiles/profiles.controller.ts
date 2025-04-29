import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Request, Query, UploadedFile, UseInterceptors, BadRequestException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ProfilesService } from './profiles.service';
import { CreateProfileDto } from './dto/create-profile.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { AuthenticatedRequest } from '../auth/interfaces/authenticated-request.interface';

@Controller('profiles')
export class ProfilesController {
  constructor(private readonly profilesService: ProfilesService) {}

  /**
   * Create a new profile
   */
  @Post()
  @UseGuards(JwtAuthGuard)
  async create(@Request() req: AuthenticatedRequest, @Body() createProfileDto: CreateProfileDto) {
    return this.profilesService.create(req.user.id, createProfileDto);
  }

  /**
   * Get all profiles with pagination and filters
   */
  @Get()
  @UseGuards(JwtAuthGuard)
  async findAll(
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
    @Query() filters: Record<string, any>
  ) {
    // Extract pagination params
    const { page: pageParam, limit: limitParam, ...filterParams } = filters;

    return this.profilesService.findAllPaginated({
      page: page,
      limit: limit,
      filters: filterParams
    });
  }

  /**
   * Get current user's profile
   */
  @Get('me')
  @UseGuards(JwtAuthGuard)
  async getMyProfile(@Request() req: AuthenticatedRequest) {
    return this.profilesService.findByUserId(req.user.id);
  }

  /**
   * Get a profile by ID
   */
  @Get(':id')
  @UseGuards(JwtAuthGuard)
  async findOne(@Param('id') id: string) {
    return this.profilesService.findOne(id);
  }

  /**
   * Update current user's profile
   */
  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  async update(
    @Request() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() updateProfileDto: UpdateProfileDto
  ) {
    return this.profilesService.update(req.user.id, id, updateProfileDto);
  }

  /**
   * Delete a profile
   */
  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  async remove(@Request() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.profilesService.remove(req.user.id, id);
  }

  /**
   * Add photo to profile
   */
  @Post(':id/photos')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor('photo'))
  async addPhoto(
    @Request() req: AuthenticatedRequest,
    @Param('id') profileId: string,
    @UploadedFile() file: Express.Multer.File,
    @Body('isMain') isMain: boolean,
    @Body('url') url: string
  ) {
    // In a real implementation we'd upload the file to S3 or similar
    // For now we'll accept a URL in the request body

    if (!url && !file) {
      throw new BadRequestException('Either a file or URL must be provided');
    }

    // Use file URL if provided otherwise we'd generate this from the uploaded file
    const photoUrl = url || `http://example.com/photos/${file.filename}`;

    return this.profilesService.addPhoto(req.user.id, profileId, photoUrl, isMain);
  }

  /**
   * Remove photo from profile
   */
  @Delete(':id/photos/:photoUrl')
  @UseGuards(JwtAuthGuard)
  async removePhoto(
    @Request() req: AuthenticatedRequest,
    @Param('id') profileId: string,
    @Param('photoUrl') photoUrl: string
  ) {
    return this.profilesService.removePhoto(req.user.id, profileId, decodeURIComponent(photoUrl));
  }

  /**
   * Set main photo
   */
  @Patch(':id/photos/:photoUrl/main')
  @UseGuards(JwtAuthGuard)
  async setMainPhoto(
    @Request() req: AuthenticatedRequest,
    @Param('id') profileId: string,
    @Param('photoUrl') photoUrl: string
  ) {
    return this.profilesService.setMainPhoto(req.user.id, profileId, decodeURIComponent(photoUrl));
  }
}
