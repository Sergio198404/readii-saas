// Permission matrix for the 4 staff roles.
// v1: all staff can read everything; writes are gated here on the frontend
// (and by RLS policies from migration 000014 for critical tables).

export const STAFF_ROLES = {
  COPYWRITER: 'copywriter',
  PROJECT_MANAGER: 'project_manager',
  CUSTOMER_MANAGER: 'customer_manager',
  BDM: 'bdm',
}

export const STAFF_ROLE_LABELS = {
  copywriter: 'Kelly · 文案',
  project_manager: 'Lisa · 项目负责人',
  customer_manager: 'Tim · 客户经理',
  bdm: 'Ryan · BDM',
}

export const STAFF_PERMISSIONS = {
  copywriter: {
    updateProgress: false,
    answerQA: true,
    uploadDocs: true,
    signOffHR: false,
    verifyAppendix: false,
    generateReports: true,
    createMeeting: false,
    enterFinancials: false,
  },
  project_manager: {
    updateProgress: true,
    answerQA: true,
    uploadDocs: true,
    signOffHR: true,
    verifyAppendix: true,
    generateReports: true,
    createMeeting: true,
    enterFinancials: false,
  },
  customer_manager: {
    updateProgress: true,
    answerQA: true,
    uploadDocs: true,
    signOffHR: false,
    verifyAppendix: false,
    generateReports: true,
    createMeeting: true,
    enterFinancials: false,
  },
  bdm: {
    updateProgress: false,
    answerQA: false,
    uploadDocs: false,
    signOffHR: false,
    verifyAppendix: false,
    generateReports: false,
    createMeeting: false,
    enterFinancials: true,
  },
}

export function hasPermission(staffRole, action) {
  if (!staffRole) return false
  return STAFF_PERMISSIONS[staffRole]?.[action] ?? false
}
