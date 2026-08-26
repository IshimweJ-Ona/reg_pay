import { Test, TestingModule } from '@nestjs/testing';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { CloudinaryService } from '../cloudinary/cloudinary.service';
import { hashPassword } from '../auth/utils/password.util';
import { UsersService } from './users.service';

jest.mock('../auth/utils/password.util', () => ({
  hashPassword: jest.fn(async (plainPassword: string) => `hashed:${plainPassword}`),
}));

describe('UsersService', () => {
  let service: UsersService;
  let prisma: any;
  let mailService: any;
  let cacheManagerMock: any;

  beforeEach(async () => {
    jest.clearAllMocks();
    process.env.FRONTEND_URL = 'https://reg-pay.example.com';

    mailService = {
      sendPasswordResetEmail: jest.fn(),
      sendVerificationCodeEmail: jest.fn(),
      sendUserCreatedEmail: jest.fn(),
    };
    cacheManagerMock = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
    };
    prisma = {
      users: {
        findFirst: jest.fn(),
      },
      roles: {
        findMany: jest
          .fn()
          .mockResolvedValueOnce([{ id: 10n }])
          .mockResolvedValueOnce([{ id: 10n }])
          .mockResolvedValueOnce([{ id: 10n, name: 'BRANCH_MANAGER' }]),
      },
      $transaction: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: PrismaService,
          useValue: prisma,
        },
        {
          provide: NotificationsService,
          useValue: {
            create: jest.fn(),
          },
        },
        {
          provide: MailService,
          useValue: mailService,
        },
        {
          provide: CloudinaryService,
          useValue: {
            uploadAvatar: jest.fn(),
            deleteAvatar: jest.fn(),
          },
        },
        {
          provide: CACHE_MANAGER,
          useValue: cacheManagerMock,
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('creates admin-managed users with a one-time password setup link', async () => {
    const createdUserId = 2n;
    const persistedUser = {
      id: createdUserId,
      uuid: 'created-user-uuid',
      first_name: 'New',
      last_name: 'User',
      email: 'new.user@reg.rw',
      phone_number: '+250788000000',
      gender: 'MALE',
      status: 'ACTIVE',
      working_location_id: null,
      department_id: null,
      user_roles: [
        {
          id: 1n,
          role_id: 10n,
          roles: { name: 'BRANCH_MANAGER', permission_keys: [] },
        },
      ],
      user_permissions: [],
      user_permission_overrides: [],
    };
    const tx = {
      users: {
        create: jest.fn().mockResolvedValue({ id: createdUserId }),
        findUniqueOrThrow: jest.fn().mockResolvedValue(persistedUser),
      },
      user_roles: {
        createMany: jest.fn(),
      },
      user_permissions: {
        createMany: jest.fn(),
      },
      audit_logs: {
        create: jest.fn(),
      },
    };
    prisma.$transaction.mockImplementation((callback: any) => callback(tx));

    const result = await service.createUser(
      {
        first_name: 'New',
        last_name: 'User',
        email: 'new.user@reg.rw',
        phone_number: '+250788000000',
        gender: 'MALE' as any,
        role_ids: ['BRANCH_MANAGER'],
      },
      {
        userId: '1',
        uuid: 'admin-uuid',
        first_name: 'System',
        last_name: 'Administrator',
        email: 'admin@reg.rw',
        phone_number: '+250788111111',
        status: 'ACTIVE',
        roles: ['SUPER_ADMIN'],
        permissions: ['users.create'],
        working_location_id: null,
        department_id: null,
      },
    );

    const createData = tx.users.create.mock.calls[0][0].data;
    expect(createData).toEqual(
      expect.objectContaining({
        status: 'ACTIVE',
        is_verified: true,
        reset_password_token: expect.any(String),
        reset_password_expires: expect.any(Date),
      }),
    );
    expect(hashPassword).toHaveBeenCalledWith(expect.stringMatching(/^[0-9a-f]{64}$/));
    expect(createData.password_hash).toMatch(/^hashed:[0-9a-f]{64}$/);

    expect(mailService.sendUserCreatedEmail).toHaveBeenCalledWith(
      'new.user@reg.rw',
      expect.objectContaining({
        recipientName: 'New User',
        creatorName: 'System Administrator',
        creatorEmail: 'admin@reg.rw',
        roleNames: ['BRANCH_MANAGER'],
        setPasswordUrl: expect.stringMatching(
          /^https:\/\/reg-pay\.example\.com\/auth\/reset-password\/.+/,
        ),
        expiresAt: createData.reset_password_expires,
      }),
    );
    expect(mailService.sendUserCreatedEmail.mock.calls[0][1]).not.toHaveProperty(
      'password',
    );
    expect(result.message).toBe(
      'User created and a password setup link was emailed.',
    );
  });
});
