import type { Permission, Role } from './types'

/**
 * The five roles every workspace starts with.
 *
 * Access to a case is decided by `case.viewAll`: roles that hold it see the
 * whole workspace, and Investigator — which deliberately does not — sees only
 * the cases whose SPRINT names them. Changing that permission in the Role
 * Setting page changes who is confined to their orders, so it is the one
 * switch worth understanding here.
 */
export const DEFAULT_ROLES: Role[] = [
  {
    id: 'r-admin',
    name: 'Admin',
    description: 'Runs the workspace: users, roles, templates, questions and retention. Sees every case.',
    color: '#F59E0B',
    system: true,
    permissions: [
      'case.view', 'case.viewAll', 'case.create', 'case.edit', 'case.delete',
      'sprint.view', 'sprint.manage',
      'interview.view', 'interview.conduct',
      'evidence.view', 'evidence.upload', 'evidence.verify',
      'report.view', 'report.edit', 'report.publish',
      'admin.settings', 'admin.users',
    ],
  },
  {
    id: 'r-investigator',
    name: 'Investigator',
    description:
      'Works the cases they are named on. Confined to the cases whose SPRINT lists them — no workspace-wide view.',
    color: '#3B82F6',
    system: true,
    permissions: [
      'case.view', 'case.edit',
      'sprint.view',
      'interview.view', 'interview.conduct',
      'evidence.view', 'evidence.upload', 'evidence.verify',
      'report.view', 'report.edit',
    ],
  },
  {
    id: 'r-management',
    name: 'Management',
    description: 'Oversees the caseload: opens cases, assigns teams by SPRINT and signs off reports.',
    color: '#8B5CF6',
    permissions: [
      'case.view', 'case.viewAll', 'case.create', 'case.edit',
      'sprint.view', 'sprint.manage',
      'interview.view',
      'evidence.view', 'evidence.verify',
      'report.view', 'report.edit', 'report.publish',
    ],
  },
  {
    id: 'r-executive',
    name: 'Executive Management',
    description: 'Workspace-wide oversight and final sign-off. Reads everything, works nothing directly.',
    color: '#06B6D4',
    permissions: [
      'case.view', 'case.viewAll',
      'sprint.view',
      'interview.view',
      'evidence.view',
      'report.view', 'report.publish',
    ],
  },
  {
    id: 'r-stakeholder',
    name: 'Stakeholder',
    description: 'Read-only observer — reports and case status, no evidence handling and no interviews.',
    color: '#6A7FA3',
    permissions: ['case.view', 'case.viewAll', 'sprint.view', 'report.view'],
  },
]

export const DEFAULT_ROLE_ID = 'r-investigator'

/**
 * Roles from before the five-role model. Kept so an existing browser database
 * upgrades instead of stranding its users on ids that no longer exist.
 */
export const LEGACY_ROLE_MAP: Record<string, string> = {
  'r-lead': 'r-investigator',
  'r-analyst': 'r-investigator',
  'r-reviewer': 'r-management',
  'r-viewer': 'r-stakeholder',
}

export const PERMISSION_GROUPS: { group: string; items: { id: Permission; label: string; hint: string }[] }[] = [
  {
    group: 'Cases',
    items: [
      { id: 'case.view', label: 'View cases', hint: 'Open a case they have access to' },
      { id: 'case.viewAll', label: 'View all cases', hint: 'See every case, not only the ones their SPRINT names' },
      { id: 'case.create', label: 'Create cases', hint: 'Open a new investigation' },
      { id: 'case.edit', label: 'Edit cases', hint: 'Change graph, status and details' },
      { id: 'case.delete', label: 'Delete cases', hint: 'Permanently remove a case' },
    ],
  },
  {
    group: 'SPRINT',
    items: [
      { id: 'sprint.view', label: 'View SPRINT', hint: 'Read the Surat Perintah and its team' },
      { id: 'sprint.manage', label: 'Issue & revoke SPRINT', hint: 'Name investigators — this is what grants case access' },
    ],
  },
  {
    group: 'Interview',
    items: [
      { id: 'interview.view', label: 'View interviews', hint: 'Read the terperiksa list and completed BAP' },
      { id: 'interview.conduct', label: 'Conduct BAP', hint: 'Record answers and close out a BAP' },
    ],
  },
  {
    group: 'Evidence',
    items: [
      { id: 'evidence.view', label: 'View evidence', hint: 'Open the evidence register' },
      { id: 'evidence.upload', label: 'Upload evidence', hint: 'Add items to the register' },
      { id: 'evidence.verify', label: 'Verify evidence', hint: 'Mark an item as verified' },
    ],
  },
  {
    group: 'Reports',
    items: [
      { id: 'report.view', label: 'View reports', hint: 'Read investigation reports' },
      { id: 'report.edit', label: 'Edit reports', hint: 'Draft and revise findings' },
      { id: 'report.publish', label: 'Publish reports', hint: 'Move a report to final' },
    ],
  },
  {
    group: 'Administration',
    items: [
      { id: 'admin.settings', label: 'Workspace settings', hint: 'Change company configuration' },
      { id: 'admin.users', label: 'Manage users', hint: 'Add, deactivate and assign roles' },
    ],
  },
]

export const ALL_PERMISSIONS = PERMISSION_GROUPS.flatMap((g) => g.items)
