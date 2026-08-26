import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtStrategy } from './jwt.strategy';

// Regression guard: employees must never be able to authenticate. The
// `employees` table has no password/credential field at all, and this
// strategy must only ever resolve a session against `users`. If a future
// change ever makes it touch `prisma.employees`, this test's mock (which
// intentionally has no `employees` delegate) will throw immediately.
describe('JwtStrategy - employee login regression guard', () => {
  let strategy: JwtStrategy;
  let usersFindUnique: jest.Mock;

  beforeEach(async () => {
    usersFindUnique = jest.fn();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JwtStrategy,
        {
          provide: PrismaService,
          useValue: {
            users: { findUnique: usersFindUnique },
            // Deliberately no `employees` delegate - accessing
            // `prisma.employees` anywhere in validate() would throw
            // "Cannot read properties of undefined", failing these tests.
          },
        },
      ],
    }).compile();

    strategy = module.get<JwtStrategy>(JwtStrategy);
  });

  it('resolves a session by querying only the users table', async () => {
    usersFindUnique.mockResolvedValue({
      uuid: 'u-1',
      email: 'admin@reg.rw',
      phone_number: '+250700000000',
      first_name: 'Admin',
      last_name: 'User',
      status: 'ACTIVE',
      deleted_at: null,
      working_location_id: null,
      department_id: null,
      user_roles: [],
      user_permissions: [],
      user_permission_overrides: [],
    });

    const result = await strategy.validate({ sub: '1' } as any);

    expect(usersFindUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: BigInt(1) } }),
    );
    expect(result.uuid).toBe('u-1');
  });

  it('rejects when no matching user exists, even if an employee with that id might', async () => {
    usersFindUnique.mockResolvedValue(null);

    await expect(strategy.validate({ sub: '999' } as any)).rejects.toThrow(
      UnauthorizedException,
    );
  });
});
