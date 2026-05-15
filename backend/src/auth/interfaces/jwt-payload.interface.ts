export interface JwtPayload {
  sub: string;
  email: string;
  phone_number: string;
  first_name: string;
  last_name: string;
  status: string;
  roles: string[];
  permissions: string[];
  working_location_id: string | null;
  department_id: string | null;
}
