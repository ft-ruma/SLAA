// Map Postgres errors (raised by the constraints in db/*.sql) to messages a
// member of the public can act on. The rules live in the database; this file
// only translates them.

export type AppError = { status: number; message: string; field?: string };

type PgLike = { code?: string; constraint_name?: string; constraint?: string; message?: string };

const UNIQUE: Record<string, AppError> = {
  member_nic_uq: { status: 409, message: "This ID is already registered.", field: "identity" },
  member_postal_uq: { status: 409, message: "This ID is already registered.", field: "identity" },
  coach_slaa_license_no_key: {
    status: 409,
    message: "This SLAA licence number is already registered to another coach.",
    field: "licenseNo",
  },
  athlete_coach_primary_uq: { status: 400, message: "Only one current coach can be primary.", field: "coaches" },
  athlete_event_pkey: { status: 400, message: "An event is selected twice.", field: "events" },
  athlete_coach_current_uq: { status: 400, message: "The same coach is listed twice as current.", field: "coaches" },
};

const CHECK: Record<string, AppError> = {
  nic_matches_dob: { status: 400, message: "The date of birth does not match the NIC.", field: "dateOfBirth" },
  nic_matches_gender: { status: 400, message: "The gender does not match the NIC.", field: "gender" },
  coach_events_valid: { status: 400, message: "Please choose events from the list.", field: "disciplines" },
  athlete_events_valid: { status: 400, message: "Please choose events from the list.", field: "mainEvents" },
  athlete_event_pb_format: {
    status: 400,
    message: "Enter the personal best as numbers, e.g. 10.85, 1:52.30 or 6.45.",
    field: "events",
  },
  coach_request_phone_for_current: {
    status: 400,
    message: "Enter a Sri Lankan mobile number, e.g. 0771234567.",
    field: "unlistedCoaches",
  },
  has_identity: { status: 400, message: "An NIC or Postal ID is required.", field: "identity" },
};

const FOREIGN_KEY: Record<string, AppError> = {
  member_district_fk: { status: 400, message: "Please choose a district from the list.", field: "district" },
  athlete_coach_coach_id_fkey: { status: 400, message: "A selected coach could not be found.", field: "coaches" },
};

export function mapPgError(e: unknown): AppError | null {
  const err = e as PgLike;
  const name = err?.constraint_name ?? err?.constraint ?? "";
  switch (err?.code) {
    case "23505":
      return UNIQUE[name] ?? { status: 409, message: "This record already exists." };
    case "23514":
      return CHECK[name] ?? { status: 400, message: "Some details are not valid. Please check the form." };
    case "23503":
      return FOREIGN_KEY[name] ?? { status: 400, message: "Some details refer to records that do not exist." };
    case "22023":
      return { status: 400, message: "The NIC number is not valid.", field: "identity" };
    default:
      return null;
  }
}
