import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { v2 as cloudinary, UploadApiResponse } from 'cloudinary';

export type AvatarFolder = 'users' | 'employees';

@Injectable()
export class CloudinaryService {
  private readonly logger = new Logger(CloudinaryService.name);
  private configured = false;

  private normalizeEnvValue(value?: string) {
    return value?.trim().replace(/^['"]|['"]$/g, '');
  }

  private ensureConfigured() {
    if (this.configured) return;

    const cloudName = this.normalizeEnvValue(process.env.CLOUDINARY_CLOUD_NAME);
    const apiKey = this.normalizeEnvValue(process.env.CLOUDINARY_API_KEY);
    const apiSecret = this.normalizeEnvValue(process.env.CLOUDINARY_API_SECRET);

    if (!cloudName || !apiKey || !apiSecret) {
      throw new BadRequestException(
        'Cloudinary is not configured on the server. Set CLOUDINARY_CLOUD_NAME/API_KEY/API_SECRET.',
      );
    }

    if (!/^[a-zA-Z0-9-]+$/.test(cloudName)) {
      throw new BadRequestException(
        'Invalid CLOUDINARY_CLOUD_NAME. Use the exact Cloudinary cloud name from your dashboard; underscores and spaces are not allowed.',
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
    } catch (error: any) {
      this.logger.warn(`Failed to delete Cloudinary asset ${publicId}: ${error.message}`);
    }
  }
}
