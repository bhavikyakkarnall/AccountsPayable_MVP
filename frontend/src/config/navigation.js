import { APP_ROLES, roleLabels } from "./roles";

export const roles = roleLabels;

export const navigationSections = [
  {
    title: "Overview",
    items: [
      {
        label: "Dashboard",
        path: "/dashboard",
        icon: "bi-speedometer2",
        allowedRoles: Object.values(APP_ROLES)
      }
    ]
  },
  {
    title: "Operations",
    items: [
      {
        label: "Suppliers",
        path: "/suppliers",
        icon: "bi-buildings",
        allowedRoles: [APP_ROLES.AP_ADMIN, APP_ROLES.AP_PROCESSOR, APP_ROLES.FINANCE_MANAGER]
      },
      {
        label: "Invoice Inbox",
        path: "/invoice-inbox",
        icon: "bi-inboxes",
        allowedRoles: [APP_ROLES.AP_ADMIN, APP_ROLES.AP_PROCESSOR]
      },
      {
        label: "Approval Queue",
        path: "/approval-queue",
        icon: "bi-check2-square",
        allowedRoles: [APP_ROLES.AP_ADMIN, APP_ROLES.APPROVER, APP_ROLES.FINANCE_MANAGER]
      },
      {
        label: "Payments",
        path: "/payments",
        icon: "bi-bank",
        allowedRoles: [APP_ROLES.AP_ADMIN, APP_ROLES.FINANCE_MANAGER]
      }
    ]
  },
  {
    title: "Insights",
    items: [
      {
        label: "Reports",
        path: "/reports",
        icon: "bi-bar-chart",
        allowedRoles: [APP_ROLES.AP_ADMIN, APP_ROLES.FINANCE_MANAGER, APP_ROLES.AUDITOR]
      }
    ]
  },
  {
    title: "Administration",
    items: [
      {
        label: "User Management",
        path: "/users",
        icon: "bi-people",
        allowedRoles: [APP_ROLES.AP_ADMIN]
      }
    ]
  }
];

export function hasRequiredRole(userRoles, allowedRoles = []) {
  return allowedRoles.length === 0 || allowedRoles.some((role) => userRoles.includes(role));
}

export function getVisibleNavigation(userRoles) {
  return navigationSections
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => hasRequiredRole(userRoles, item.allowedRoles))
    }))
    .filter((section) => section.items.length > 0);
}
