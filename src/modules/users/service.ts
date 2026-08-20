import type { ActivityLog, Company, UserOptions, UserProfile } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { singleFieldError } from '../../lib/validation.js';
import { ApiError } from '../../middleware/errorHandler.js';
import type { UpdateCompanyRequest, UpdateOptionsRequest, UpdateSelfRequest } from './schema.js';

function serializeSelf(profile: UserProfile) {
  return {
    username: profile.username,
    gender: profile.gender,
    telephone: profile.telephone,
    extension: profile.extension,
    mobile: profile.mobile,
    webdev_email: profile.webdevEmail,
    updated_at: profile.updatedAt.toISOString(),
  };
}

function serializeCompany(company: Company) {
  return { name: company.name, updated_at: company.updatedAt.toISOString() };
}

function serializeOptions(options: UserOptions) {
  return {
    bank_account_validation: options.bankAccountValidation,
    driving_licence_validation: options.drivingLicenceValidation,
    ni_number_validation: options.niNumberValidation,
    passport_validation: options.passportValidation,
    address_insights: options.addressInsights,
    address_lookup: options.addressLookup,
    remote_check: options.remoteCheck,
    property_register_search: options.propertyRegisterSearch,
    nfi_address: options.nfiAddress,
    nfi_amberhill: options.nfiAmberhill,
    email_risk: options.emailRisk,
    otp_email: options.otpEmail,
    otp_sms: options.otpSms,
    phone_match: options.phoneMatch,
    phone_number_validation: options.phoneNumberValidation,
    bankaccount: options.bankaccount,
    credit_activity: options.creditActivity,
    config: {
      full_er: options.configFullEr,
      age_min: options.configAgeMin,
      age_max: options.configAgeMax,
      nfi_address: options.configNfiAddress,
    },
    bridger_client_id: options.bridgerClientId,
    bridger_client_secret: options.bridgerClientSecret,
    bridger_predefined_search: options.bridgerPredefinedSearch,
    bridger_user_id: options.bridgerUserId,
    bridger_customer_toggle: options.bridgerCustomerToggle,
    updated_at: options.updatedAt.toISOString(),
  };
}

function serializeActivityLog(log: ActivityLog) {
  return {
    path_identifier: log.pathIdentifier,
    method: log.method,
    path: log.path,
    ip: log.ip,
    status: log.status,
    application: log.application,
    level: log.level,
    channel: log.channel,
    server_name: log.serverName,
    created_at: log.createdAt.toISOString(),
  };
}

/** Auto-created on first access — no separate "create" step (see spec.md: a Client already is this replica's identity concept). */
export async function getSelf(clientId: string) {
  const profile = await prisma.userProfile.upsert({
    where: { clientId },
    update: {},
    create: { clientId },
  });
  return serializeSelf(profile);
}

export async function updateSelf(clientId: string, input: UpdateSelfRequest) {
  if (input.username !== undefined) {
    const existing = await prisma.userProfile.findUnique({ where: { username: input.username } });
    if (existing && existing.clientId !== clientId) {
      throw new ApiError(422, singleFieldError('username', 1318));
    }
  }
  const profile = await prisma.userProfile.upsert({
    where: { clientId },
    update: input,
    create: { clientId, ...input },
  });
  return serializeSelf(profile);
}

export async function getCompany(clientId: string) {
  const company = await prisma.company.upsert({
    where: { clientId },
    update: {},
    create: { clientId },
  });
  return serializeCompany(company);
}

export async function updateCompany(clientId: string, input: UpdateCompanyRequest) {
  const company = await prisma.company.upsert({
    where: { clientId },
    update: input,
    create: { clientId, ...input },
  });
  return serializeCompany(company);
}

export async function getOptions(clientId: string) {
  const options = await prisma.userOptions.upsert({
    where: { clientId },
    update: {},
    create: { clientId },
  });
  return serializeOptions(options);
}

export async function updateOptions(clientId: string, input: UpdateOptionsRequest) {
  const { config, ...toggles } = input;
  const data = {
    ...(toggles.bank_account_validation !== undefined && {
      bankAccountValidation: toggles.bank_account_validation,
    }),
    ...(toggles.driving_licence_validation !== undefined && {
      drivingLicenceValidation: toggles.driving_licence_validation,
    }),
    ...(toggles.ni_number_validation !== undefined && {
      niNumberValidation: toggles.ni_number_validation,
    }),
    ...(toggles.passport_validation !== undefined && {
      passportValidation: toggles.passport_validation,
    }),
    ...(toggles.address_insights !== undefined && { addressInsights: toggles.address_insights }),
    ...(toggles.address_lookup !== undefined && { addressLookup: toggles.address_lookup }),
    ...(toggles.remote_check !== undefined && { remoteCheck: toggles.remote_check }),
    ...(toggles.property_register_search !== undefined && {
      propertyRegisterSearch: toggles.property_register_search,
    }),
    ...(toggles.nfi_address !== undefined && { nfiAddress: toggles.nfi_address }),
    ...(toggles.nfi_amberhill !== undefined && { nfiAmberhill: toggles.nfi_amberhill }),
    ...(toggles.email_risk !== undefined && { emailRisk: toggles.email_risk }),
    ...(toggles.otp_email !== undefined && { otpEmail: toggles.otp_email }),
    ...(toggles.otp_sms !== undefined && { otpSms: toggles.otp_sms }),
    ...(toggles.phone_match !== undefined && { phoneMatch: toggles.phone_match }),
    ...(toggles.phone_number_validation !== undefined && {
      phoneNumberValidation: toggles.phone_number_validation,
    }),
    ...(toggles.bankaccount !== undefined && { bankaccount: toggles.bankaccount }),
    ...(toggles.credit_activity !== undefined && { creditActivity: toggles.credit_activity }),
    ...(toggles.bridger_client_id !== undefined && { bridgerClientId: toggles.bridger_client_id }),
    ...(toggles.bridger_client_secret !== undefined && {
      bridgerClientSecret: toggles.bridger_client_secret,
    }),
    ...(toggles.bridger_predefined_search !== undefined && {
      bridgerPredefinedSearch: toggles.bridger_predefined_search,
    }),
    ...(toggles.bridger_user_id !== undefined && { bridgerUserId: toggles.bridger_user_id }),
    ...(toggles.bridger_customer_toggle !== undefined && {
      bridgerCustomerToggle: toggles.bridger_customer_toggle,
    }),
    ...(config?.full_er !== undefined && { configFullEr: config.full_er }),
    ...(config?.age_min !== undefined && { configAgeMin: config.age_min }),
    ...(config?.age_max !== undefined && { configAgeMax: config.age_max }),
    ...(config?.nfi_address !== undefined && { configNfiAddress: config.nfi_address }),
  };
  const options = await prisma.userOptions.upsert({
    where: { clientId },
    update: data,
    create: { clientId, ...data },
  });
  return serializeOptions(options);
}

export interface ActivityLogFilters {
  path_identifier?: string;
  method?: string;
  path?: string;
  ip?: string;
  status?: number;
  application?: string;
  level?: string;
  channel?: string;
  server_name?: string;
}

export async function listActivityLogs(
  clientId: string,
  filters: ActivityLogFilters,
  page: number,
  perPage: number,
): Promise<{ items: ReturnType<typeof serializeActivityLog>[]; total: number }> {
  const where = {
    clientId,
    ...(filters.path_identifier && { pathIdentifier: filters.path_identifier }),
    ...(filters.method && { method: filters.method }),
    ...(filters.path && { path: filters.path }),
    ...(filters.ip && { ip: filters.ip }),
    ...(filters.status !== undefined && { status: filters.status }),
    ...(filters.application && { application: filters.application }),
    ...(filters.level && { level: filters.level }),
    ...(filters.channel && { channel: filters.channel }),
    ...(filters.server_name && { serverName: filters.server_name }),
  };
  const [items, total] = await Promise.all([
    prisma.activityLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * perPage,
      take: perPage,
    }),
    prisma.activityLog.count({ where }),
  ]);
  return { items: items.map(serializeActivityLog), total };
}
