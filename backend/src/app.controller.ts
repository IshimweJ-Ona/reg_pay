import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AppService } from './app.service';

@ApiTags('App')
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  @ApiOperation({
    summary: 'Root endpoint',
    description:
      'Simple greeting to confirm the API is reachable. Public, no auth required.',
  })
  @ApiResponse({ status: 200, description: 'Greeting string.' })
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('health')
  @ApiOperation({
    summary: 'Health check',
    description:
      'Used by uptime monitors / container orchestration to confirm the service is alive. Public, no auth required.',
  })
  @ApiResponse({
    status: 200,
    description: 'Service status and current server timestamp.',
  })
  health() {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }
}
