import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Res,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import type { Response } from 'express';
import { FilesInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { mkdirSync } from 'fs';
import { extname } from 'path';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import type { CurrentUserType } from '../auth/types/current-user.type';
import { ApprovePayrollItemDto } from './dto/approve-payroll-item.dto';
import { CreatePayrollBatchDto } from './dto/create-payroll-batch.dto';
import { RejectPayrollItemDto } from './dto/reject-payroll-item.dto';
import { PayrollService } from './payroll.service';

// Every approve/reject route below accepts the broad 'payroll.approve' key
// OR either of the specific step keys. Roles are meant to hold exactly one
// of the specific keys (BRANCH_MANAGER: payroll.approve_initial, HR:
// payroll.approve_final) - requiring only the umbrella key here would block
// both of them at the route guard before PayrollService.ensureActorCanApproveBatch
// ever gets a chance to apply the real, step-aware business rule.
const APPROVE_OR_REJECT_PERMISSIONS = [
  'payroll.approve',
  'payroll.approve_initial',
  'payroll.approve_final',
];

@ApiTags('Payroll')
@ApiBearerAuth('jwt')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Controller('payroll')
export class PayrollController {
  constructor(private readonly payrollService: PayrollService) {}

  @Permissions('payroll.create')
  @Post('batches')
  @ApiOperation({
    summary: 'Create a payroll batch',
    description:
      'Calculates a DRAFT payroll batch for a date range (defaults to a calendar month) and optional location/department filter. Base pay, overtime, allowances, tax, and Ikimina are computed per employee from attendance and their active payment structure. Requires `payroll.create`.',
  })
  @ApiResponse({
    status: 201,
    description: 'Draft payroll batch created with calculated items.',
  })
  @ApiResponse({
    status: 400,
    description:
      'Invalid date range, or a non-terminal batch already exists for this period.',
  })
  createBatch(
    @Body() dto: CreatePayrollBatchDto,
    @CurrentUser() actor: CurrentUserType,
  ) {
    return this.payrollService.createBatch(dto, actor);
  }

  @Permissions('payroll.create', 'payroll.approve')
  @Post('batches/:uuid/attachments')
  @ApiOperation({
    summary: 'Attach supporting files to a payroll batch',
    description:
      'Uploads up to 10 files (max 10MB each) attached to a batch for audit/reference purposes. Requires `payroll.create` or `payroll.approve`.',
  })
  @ApiParam({ name: 'uuid', description: 'Payroll batch UUID.' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        attachments: {
          type: 'array',
          items: { type: 'string', format: 'binary' },
        },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'Attachments saved to the batch.' })
  @UseInterceptors(
    FilesInterceptor('attachments', 10, {
      storage: diskStorage({
        destination: (_req, _file, cb) => {
          const uploadDir = './uploads/payroll';
          mkdirSync(uploadDir, { recursive: true });
          cb(null, uploadDir);
        },
        filename: (_req, file, cb) => {
          const safeBase = file.originalname
            .replace(/\.[^/.]+$/, '')
            .replace(/[^a-zA-Z0-9_-]+/g, '-')
            .slice(0, 60);
          cb(
            null,
            `${Date.now()}-${safeBase || 'attachment'}${extname(file.originalname)}`,
          );
        },
      }),
      limits: { files: 10, fileSize: 10 * 1024 * 1024 },
    }),
  )
  addBatchAttachments(
    @Param('uuid') uuid: string,
    @UploadedFiles() files: Express.Multer.File[],
    @CurrentUser() actor: CurrentUserType,
  ) {
    return this.payrollService.addBatchAttachments(uuid, files ?? [], actor);
  }

  @Permissions('payroll.create')
  @Post('batches/:uuid/submit')
  @ApiOperation({
    summary: 'Submit a payroll batch for approval',
    description:
      'Moves a DRAFT or previously-REJECTED batch to PENDING and notifies the correct first approver: the branch manager if one exists for this working location, otherwise SUPER_ADMIN. Requires `payroll.create`.',
  })
  @ApiParam({ name: 'uuid', description: 'Payroll batch UUID.' })
  @ApiResponse({ status: 200, description: 'Batch submitted and now PENDING.' })
  @ApiResponse({
    status: 400,
    description:
      'Only DRAFT or REJECTED batches can be submitted, or the batch is already APPROVED.',
  })
  submitBatch(
    @Param('uuid') uuid: string,
    @CurrentUser() actor: CurrentUserType,
  ) {
    return this.payrollService.submitBatch(uuid, actor);
  }

  @Permissions('payroll.read')
  @Get('batches')
  @ApiOperation({
    summary: 'List payroll batches',
    description:
      "Returns payroll batches scoped to the caller's working location, unless they hold `payroll.read_all` or SUPER_ADMIN. Requires `payroll.read`.",
  })
  @ApiQuery({
    name: 'q',
    required: false,
    description: 'Search by batch code.',
  })
  @ApiQuery({
    name: 'status',
    required: false,
    description:
      'Comma-separated list of statuses to filter to (e.g. "PENDING,IN_REVIEW,MANAGER_APPROVED").',
  })
  @ApiQuery({
    name: 'position_id',
    required: false,
    description:
      'Only return batches with at least one item for this position (id or uuid).',
  })
  @ApiResponse({ status: 200, description: 'List of payroll batches.' })
  findBatches(
    @CurrentUser() actor: CurrentUserType,
    @Query('q') q?: string,
    @Query('status') status?: string,
    @Query('position_id') positionId?: string,
  ) {
    return this.payrollService.findBatches(actor, q, status, positionId);
  }

  @Permissions('payroll.read')
  @Get('batches/:uuid')
  @ApiOperation({
    summary: 'Get one payroll batch with its items',
    description:
      'Returns the full batch detail: items, transactions, approval history, and calculation breakdown. Requires `payroll.read`.',
  })
  @ApiParam({ name: 'uuid', description: 'Payroll batch UUID.' })
  @ApiResponse({ status: 200, description: 'Payroll batch detail.' })
  @ApiResponse({ status: 404, description: 'Payroll batch not found.' })
  findBatch(
    @Param('uuid') uuid: string,
    @CurrentUser() actor: CurrentUserType,
  ) {
    return this.payrollService.findBatch(uuid, actor);
  }

  @Permissions('payroll.read')
  @Get('batches/:uuid/export')
  @ApiOperation({
    summary: 'Export a payroll batch as CSV',
    description:
      'Downloads a CSV with one row per employee: batch code, period, location, department, gross/net pay, tax, deductions, and status. Requires `payroll.read`.',
  })
  @ApiParam({ name: 'uuid', description: 'Payroll batch UUID.' })
  @ApiResponse({ status: 200, description: 'CSV file stream.' })
  async exportBatch(
    @Param('uuid') uuid: string,
    @CurrentUser() actor: CurrentUserType,
    @Res({ passthrough: true }) response: Response,
  ) {
    const exportFile = await this.payrollService.exportBatchCsv(uuid, actor);
    response.setHeader('Content-Type', 'text/csv; charset=utf-8');
    response.setHeader(
      'Content-Disposition',
      `attachment; filename="${exportFile.filename}"`,
    );
    return exportFile.content;
  }

  @Permissions(...APPROVE_OR_REJECT_PERMISSIONS)
  @Patch('batches/:uuid/approve')
  @ApiOperation({
    summary: 'Approve a payroll batch (initial or final step)',
    description:
      "Two-step approval: step 1 (initial) is normally the branch manager; step 2 (final) follows the hierarchy HR of the batch's own working location -> HR at HQ -> SUPER_ADMIN. Approving the final step marks every non-rejected item APPROVED and its transaction PAID. Requires `payroll.approve`, `payroll.approve_initial`, or `payroll.approve_final` (the specific step permission actually held determines what the caller may do).",
  })
  @ApiParam({ name: 'uuid', description: 'Payroll batch UUID.' })
  @ApiResponse({
    status: 200,
    description: 'Batch approved (moved to MANAGER_APPROVED or APPROVED).',
  })
  @ApiResponse({
    status: 400,
    description:
      'Caller is not the correct approver for this step, or the batch is not in a reviewable state.',
  })
  approveBatch(
    @Param('uuid') uuid: string,
    @Body() dto: ApprovePayrollItemDto,
    @CurrentUser() actor: CurrentUserType,
  ) {
    return this.payrollService.approveBatch(uuid, dto, actor);
  }

  @Permissions(...APPROVE_OR_REJECT_PERMISSIONS)
  @Patch('batches/:uuid/reject')
  @ApiOperation({
    summary: 'Reject a payroll batch',
    description:
      'Rejects the whole batch with a required reason, returning it to the submitter for correction and resubmission. Requires `payroll.approve`, `payroll.approve_initial`, or `payroll.approve_final`.',
  })
  @ApiParam({ name: 'uuid', description: 'Payroll batch UUID.' })
  @ApiResponse({ status: 200, description: 'Batch rejected.' })
  rejectBatch(
    @Param('uuid') uuid: string,
    @Body() dto: RejectPayrollItemDto,
    @CurrentUser() actor: CurrentUserType,
  ) {
    return this.payrollService.rejectBatch(uuid, dto, actor);
  }

  @Permissions(...APPROVE_OR_REJECT_PERMISSIONS)
  @Patch('batches/items/:uuid/approve')
  @ApiOperation({
    summary: 'Approve a single payroll batch item',
    description:
      "Approves one employee's line item within a batch without approving the whole batch. Requires `payroll.approve`, `payroll.approve_initial`, or `payroll.approve_final`.",
  })
  @ApiParam({ name: 'uuid', description: 'Payroll batch item UUID.' })
  @ApiResponse({ status: 200, description: 'Item approved.' })
  approveItem(
    @Param('uuid') uuid: string,
    @Body() dto: ApprovePayrollItemDto,
    @CurrentUser() actor: CurrentUserType,
  ) {
    return this.payrollService.approveItem(uuid, dto, actor);
  }

  @Permissions(...APPROVE_OR_REJECT_PERMISSIONS)
  @Patch('batches/items/:uuid/reject')
  @ApiOperation({
    summary: 'Reject a single payroll batch item',
    description:
      "Rejects one employee's line item, splitting it out of the batch with a reason, while the rest of the batch continues through approval. Requires `payroll.approve`, `payroll.approve_initial`, or `payroll.approve_final`.",
  })
  @ApiParam({ name: 'uuid', description: 'Payroll batch item UUID.' })
  @ApiResponse({ status: 200, description: 'Item rejected.' })
  rejectItem(
    @Param('uuid') uuid: string,
    @Body() dto: RejectPayrollItemDto,
    @CurrentUser() actor: CurrentUserType,
  ) {
    return this.payrollService.rejectItem(uuid, dto, actor);
  }
}
