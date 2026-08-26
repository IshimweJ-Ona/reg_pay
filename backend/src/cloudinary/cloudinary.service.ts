import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { v2 as cloudinary, UploadApiResponse } from 'cloudinary';

export type AvatarFolder = 'users' | 'employees';

@Injectable()
export class CloudinaryService {
  private readonly logger = new Logger(CloudinaryService.name);
  private configured = false;

  private ensureConfigured() {
    if (this.configured) return;

    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    const apiKey = process.env.CLOUDINARY_API_KEY;
    const apiSecret = process.env.CLOUDINARY_API_SECRET;

    if (!cloudName || !apiKey || !apiSecret) {
      throw new BadRequestException(
        'Cloudinary is not configured on the server. Set CLOUDINARY_CLOUD_NAME/API_KEY/API_SECRET.',
      );
    }

    cloudinary.config({
      cloud_name: cloudName,
      api_key: apiKey,
      api_secret: apiSecret,
    });
    this.configured = true;
  }

  async uploadAvatar(
    buffer: Buffer,
    folder: AvatarFolder,
    publicIdHint?: string,
  ): Promise<{ secure_url: string; public_id: string }> {
    this.ensureConfigured();

    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: `reg-pay/avatars/${folder}`,
          public_id: publicIdHint,
          overwrite: true,
          resource_type: 'image',
          transformation: [{ width: 500, height: 500, crop: 'fill', gravity: 'face' }],
        },
        (error, result?: UploadApiResponse) => {
          if (error || !result) {
            this.logger.error(`Cloudinary upload failed: ${error?.message}`);
            reject(
              new BadRequestException(
                'Failed to upload image. Please try again.',
              ),
            );
            return;
          }
          resolve({ secure_url: result.secure_url, public_id: result.public_id });
        },
      );
      uploadStream.end(buffer);
    });
  }

  async deleteAvatar(publicId: string): Promise<void> {
    this.ensureConfigured();
    try {
      await cloudinary.uploader.destroy(publicId);
    } catch (error) {
      this.logger.warn(`Failed to delete Cloudinary asset ${publicId}: ${error.message}`);
    }
  }
}
