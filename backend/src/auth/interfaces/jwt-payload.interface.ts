export interface JwtPayload {
  sub: string;
  uuid: string;
  email: string;
  phone_number: string;
  first_name: string;
  last_name: string;
  status: string;
  roles: string[];
  permissions: string[];
  permission_overrides?: Array<{
    permission_key: string;
    is_allowed: boolean;
  }>;
  working_location_id: string | null;
  department_id: string | null;
}
