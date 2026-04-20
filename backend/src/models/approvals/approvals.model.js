const ApiError = require("../../utils/ApiError");
const { pool } = require("../../config/database");
const auditLogsModel = require("../auditLogs/auditLogs.model");

const APPROVAL_ACTIONS = Object.freeze({
  SUBMITTED: "submitted",
  APPROVE: "approve",
  REJECT: "reject",
  SEND_BACK: "send_back"
});

const APPROVAL_MANAGED_STATUSES = new Set([
  "pending_approval",
  "approved",
  "rejected",
  "sent_back"
]);

function matchesStepApprover(step, userId, userRoles = []) {
  const matchesUser = step.approverUserId && Number(step.approverUserId) === Number(userId);
  const matchesRole = step.approverRoleCode && userRoles.includes(step.approverRoleCode);

  return Boolean(matchesUser || matchesRole);
}

function buildApproverLabel(step) {
  if (step.approverUserName) {
    return step.approverUserName;
  }

  if (step.approverRoleName) {
    return step.approverRoleName;
  }

  return "Unassigned approver";
}

async function getInvoiceApprovalBase(executor, invoiceId, { lock = false } = {}) {
  const [rows] = await executor.query(
    `
      SELECT
        i.invoice_id AS invoiceId,
        i.invoice_number AS invoiceNumber,
        i.status,
        i.approval_workflow_id AS approvalWorkflowId,
        i.current_approval_round AS currentApprovalRound,
        i.supplier_id AS supplierId,
        s.supplier_name AS supplierName,
        i.total_amount AS totalAmount,
        i.currency,
        i.created_by_user_id AS createdByUserId,
        i.updated_by_user_id AS updatedByUserId
      FROM invoices i
      INNER JOIN suppliers s ON s.supplier_id = i.supplier_id
      WHERE i.invoice_id = ?
      ${lock ? "FOR UPDATE" : ""}
      LIMIT 1
    `,
    [invoiceId]
  );

  return rows[0] || null;
}

async function getApprovalWorkflowSteps(executor, approvalWorkflowId) {
  const [rows] = await executor.query(
    `
      SELECT
        s.approval_step_id AS approvalStepId,
        s.approval_workflow_id AS approvalWorkflowId,
        s.step_order AS stepOrder,
        s.step_name AS stepName,
        s.approver_role_id AS approverRoleId,
        r.role_code AS approverRoleCode,
        r.role_name AS approverRoleName,
        s.approver_user_id AS approverUserId,
        TRIM(CONCAT(COALESCE(u.first_name, ''), ' ', COALESCE(u.last_name, ''))) AS approverUserName,
        s.min_approvals_required AS minApprovalsRequired,
        s.allow_delegation AS allowDelegation,
        s.due_in_hours AS dueInHours
      FROM approval_steps s
      LEFT JOIN roles r ON r.role_id = s.approver_role_id
      LEFT JOIN users u ON u.user_id = s.approver_user_id
      WHERE s.approval_workflow_id = ?
      ORDER BY s.step_order ASC, s.approval_step_id ASC
    `,
    [approvalWorkflowId]
  );

  return rows.map((row) => ({
    approvalStepId: row.approvalStepId,
    approvalWorkflowId: row.approvalWorkflowId,
    stepOrder: Number(row.stepOrder),
    stepName: row.stepName,
    approverRoleId: row.approverRoleId,
    approverRoleCode: row.approverRoleCode,
    approverRoleName: row.approverRoleName,
    approverUserId: row.approverUserId,
    approverUserName: row.approverUserName?.trim() || null,
    minApprovalsRequired: Number(row.minApprovalsRequired || 1),
    allowDelegation: Boolean(row.allowDelegation),
    dueInHours: row.dueInHours === null ? null : Number(row.dueInHours)
  }));
}

async function getApprovalWorkflowById(executor, approvalWorkflowId) {
  const [rows] = await executor.query(
    `
      SELECT
        approval_workflow_id AS approvalWorkflowId,
        workflow_name AS workflowName,
        workflow_code AS workflowCode,
        description,
        supplier_id AS supplierId,
        currency,
        min_invoice_amount AS minInvoiceAmount,
        max_invoice_amount AS maxInvoiceAmount,
        is_active AS isActive,
        effective_from AS effectiveFrom,
        effective_to AS effectiveTo,
        created_at AS createdAt
      FROM approval_workflows
      WHERE approval_workflow_id = ?
      LIMIT 1
    `,
    [approvalWorkflowId]
  );

  if (!rows[0]) {
    return null;
  }

  return {
    approvalWorkflowId: rows[0].approvalWorkflowId,
    workflowName: rows[0].workflowName,
    workflowCode: rows[0].workflowCode,
    description: rows[0].description,
    supplierId: rows[0].supplierId,
    currency: rows[0].currency,
    minInvoiceAmount: rows[0].minInvoiceAmount === null ? null : Number(rows[0].minInvoiceAmount),
    maxInvoiceAmount: rows[0].maxInvoiceAmount === null ? null : Number(rows[0].maxInvoiceAmount),
    isActive: Boolean(rows[0].isActive),
    effectiveFrom: rows[0].effectiveFrom,
    effectiveTo: rows[0].effectiveTo,
    createdAt: rows[0].createdAt,
    steps: await getApprovalWorkflowSteps(executor, rows[0].approvalWorkflowId)
  };
}

async function findMatchingApprovalWorkflow(executor, invoice) {
  const [rows] = await executor.query(
    `
      SELECT
        aw.approval_workflow_id AS approvalWorkflowId
      FROM approval_workflows aw
      WHERE aw.is_active = 1
        AND (aw.supplier_id IS NULL OR aw.supplier_id = ?)
        AND (aw.currency IS NULL OR aw.currency = ?)
        AND (aw.min_invoice_amount IS NULL OR aw.min_invoice_amount <= ?)
        AND (aw.max_invoice_amount IS NULL OR aw.max_invoice_amount >= ?)
        AND (aw.effective_from IS NULL OR aw.effective_from <= CURRENT_DATE())
        AND (aw.effective_to IS NULL OR aw.effective_to >= CURRENT_DATE())
      ORDER BY
        CASE WHEN aw.supplier_id IS NULL THEN 1 ELSE 0 END ASC,
        CASE WHEN aw.currency IS NULL THEN 1 ELSE 0 END ASC,
        COALESCE(aw.min_invoice_amount, 0) DESC,
        aw.approval_workflow_id ASC
      LIMIT 1
    `,
    [invoice.supplierId, invoice.currency, invoice.totalAmount || 0, invoice.totalAmount || 0]
  );

  if (!rows[0]) {
    return null;
  }

  return getApprovalWorkflowById(executor, rows[0].approvalWorkflowId);
}

async function resolveApprovalWorkflow(executor, invoice) {
  if (invoice.approvalWorkflowId) {
    return getApprovalWorkflowById(executor, invoice.approvalWorkflowId);
  }

  return findMatchingApprovalWorkflow(executor, invoice);
}

async function getApprovalActions(executor, invoiceId) {
  const [rows] = await executor.query(
    `
      SELECT
        a.approval_action_id AS approvalActionId,
        a.invoice_id AS invoiceId,
        a.approval_step_id AS approvalStepId,
        a.approval_round AS approvalRound,
        a.action_by_user_id AS actionByUserId,
        TRIM(CONCAT(COALESCE(u.first_name, ''), ' ', COALESCE(u.last_name, ''))) AS actionByUserName,
        a.action_type AS actionType,
        a.action_notes AS actionNotes,
        a.action_at AS actionAt,
        s.step_name AS stepName,
        s.step_order AS stepOrder
      FROM approval_actions a
      INNER JOIN approval_steps s ON s.approval_step_id = a.approval_step_id
      INNER JOIN users u ON u.user_id = a.action_by_user_id
      WHERE a.invoice_id = ?
      ORDER BY a.approval_round DESC, a.action_at DESC, a.approval_action_id DESC
    `,
    [invoiceId]
  );

  return rows.map((row) => ({
    approvalActionId: row.approvalActionId,
    invoiceId: row.invoiceId,
    approvalStepId: row.approvalStepId,
    approvalRound: Number(row.approvalRound || 0),
    actionByUserId: row.actionByUserId,
    actionByUserName: row.actionByUserName?.trim() || "Unknown user",
    actionType: row.actionType,
    actionNotes: row.actionNotes,
    actionAt: row.actionAt,
    stepName: row.stepName,
    stepOrder: Number(row.stepOrder || 0)
  }));
}

function buildApprovalState(invoice, workflow, allActions, viewer) {
  const currentRound = Number(invoice.currentApprovalRound || 0);
  const currentRoundActions = allActions
    .filter((action) => action.approvalRound === currentRound)
    .sort((left, right) => {
      if (left.stepOrder !== right.stepOrder) {
        return left.stepOrder - right.stepOrder;
      }

      return new Date(left.actionAt).getTime() - new Date(right.actionAt).getTime();
    });
  const steps = workflow?.steps || [];
  const stepStateIndex = new Map();
  let currentStepId = null;

  steps.forEach((step) => {
    const stepActions = currentRoundActions.filter(
      (action) => Number(action.approvalStepId) === Number(step.approvalStepId)
    );
    const approveUserIds = new Set(
      stepActions
        .filter((action) => action.actionType === APPROVAL_ACTIONS.APPROVE)
        .map((action) => Number(action.actionByUserId))
    );
    const approvedCount = approveUserIds.size;
    const stepRejected = stepActions.some((action) => action.actionType === APPROVAL_ACTIONS.REJECT);
    const stepSentBack = stepActions.some((action) => action.actionType === APPROVAL_ACTIONS.SEND_BACK);

    stepStateIndex.set(step.approvalStepId, {
      ...step,
      approverLabel: buildApproverLabel(step),
      approvedCount,
      actions: stepActions,
      isComplete: approvedCount >= step.minApprovalsRequired,
      isRejected: stepRejected,
      isSentBack: stepSentBack
    });
  });

  if (invoice.status === "pending_approval") {
    const nextPendingStep = steps.find((step) => {
      const stepState = stepStateIndex.get(step.approvalStepId);
      return stepState && !stepState.isComplete;
    });

    currentStepId = nextPendingStep?.approvalStepId || null;
  }

  const currentStep = currentStepId ? stepStateIndex.get(currentStepId) : null;
  const canCurrentUserAct =
    Boolean(currentStep) &&
    Boolean(viewer?.userId) &&
    matchesStepApprover(currentStep, viewer.userId, viewer.roles || []) &&
    !currentStep.actions.some(
      (action) =>
        Number(action.actionByUserId) === Number(viewer.userId) &&
        [APPROVAL_ACTIONS.APPROVE, APPROVAL_ACTIONS.REJECT, APPROVAL_ACTIONS.SEND_BACK].includes(
          action.actionType
        )
    );

  const stepViews = steps.map((step) => {
    const stepState = stepStateIndex.get(step.approvalStepId);
    let state = "upcoming";

    if (invoice.status === "approved") {
      state = "approved";
    } else if (invoice.status === "rejected" && currentRound === stepState.actions[0]?.approvalRound) {
      state = stepState.isRejected ? "rejected" : stepState.isComplete ? "approved" : "cancelled";
    } else if (invoice.status === "sent_back" && currentRound === stepState.actions[0]?.approvalRound) {
      state = stepState.isSentBack ? "sent_back" : stepState.isComplete ? "approved" : "cancelled";
    } else if (stepState.isComplete) {
      state = "approved";
    } else if (Number(step.approvalStepId) === Number(currentStepId)) {
      state = "pending";
    }

    return {
      approvalStepId: step.approvalStepId,
      stepOrder: step.stepOrder,
      stepName: step.stepName,
      approverLabel: stepState.approverLabel,
      approverRoleCode: step.approverRoleCode,
      approverUserId: step.approverUserId,
      minApprovalsRequired: step.minApprovalsRequired,
      approvedCount: stepState.approvedCount,
      dueInHours: step.dueInHours,
      state,
      actions: stepState.actions
    };
  });

  return {
    workflow,
    currentRound,
    currentStep: currentStep
      ? {
          approvalStepId: currentStep.approvalStepId,
          stepOrder: currentStep.stepOrder,
          stepName: currentStep.stepName,
          approverLabel: currentStep.approverLabel,
          approverRoleCode: currentStep.approverRoleCode,
          approverUserId: currentStep.approverUserId,
          minApprovalsRequired: currentStep.minApprovalsRequired,
          approvedCount: currentStep.approvedCount
        }
      : null,
    canCurrentUserAct,
    availableActions: canCurrentUserAct
      ? [APPROVAL_ACTIONS.APPROVE, APPROVAL_ACTIONS.REJECT, APPROVAL_ACTIONS.SEND_BACK]
      : [],
    steps: stepViews,
    history: allActions,
    currentRoundHistory: currentRoundActions
      .slice()
      .sort((left, right) => new Date(right.actionAt).getTime() - new Date(left.actionAt).getTime()),
    lastSubmittedAt:
      currentRoundActions.find((action) => action.actionType === APPROVAL_ACTIONS.SUBMITTED)?.actionAt || null,
    lastSubmittedBy:
      currentRoundActions.find((action) => action.actionType === APPROVAL_ACTIONS.SUBMITTED)?.actionByUserName ||
      null
  };
}

async function buildInvoiceApproval(invoiceId, viewer, executor = pool) {
  const invoice = await getInvoiceApprovalBase(executor, invoiceId);

  if (!invoice) {
    return null;
  }

  const workflow = await resolveApprovalWorkflow(executor, invoice);
  const actions = await getApprovalActions(executor, invoiceId);

  return buildApprovalState(invoice, workflow, actions, viewer);
}

async function listApprovalWorkflows() {
  const [rows] = await pool.query(
    `
      SELECT
        approval_workflow_id AS approvalWorkflowId
      FROM approval_workflows
      ORDER BY workflow_name ASC, approval_workflow_id ASC
    `
  );

  return Promise.all(rows.map((row) => getApprovalWorkflowById(pool, row.approvalWorkflowId)));
}

async function insertApprovalAction(
  executor,
  invoiceId,
  approvalStepId,
  approvalRound,
  actorUserId,
  actionType,
  actionNotes
) {
  await executor.query(
    `
      INSERT INTO approval_actions (
        invoice_id,
        approval_step_id,
        approval_round,
        action_by_user_id,
        action_type,
        action_notes
      )
      VALUES (?, ?, ?, ?, ?, ?)
    `,
    [invoiceId, approvalStepId, approvalRound, actorUserId, actionType, actionNotes || null]
  );
}

async function insertStatusHistory(executor, invoiceId, fromStatus, toStatus, changeReason, actorUserId) {
  await executor.query(
    `
      INSERT INTO invoice_status_history (
        invoice_id,
        from_status,
        to_status,
        change_reason,
        changed_by_user_id
      )
      VALUES (?, ?, ?, ?, ?)
    `,
    [invoiceId, fromStatus, toStatus, changeReason || null, actorUserId]
  );
}

async function submitInvoiceForApproval(invoiceId, actorUserId) {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const invoice = await getInvoiceApprovalBase(connection, invoiceId, { lock: true });

    if (!invoice) {
      throw new ApiError(404, "Invoice not found.");
    }

    if (invoice.status === "approved") {
      throw new ApiError(400, "Approved invoices cannot be resubmitted for approval.");
    }

    const workflow = await resolveApprovalWorkflow(connection, invoice);

    if (!workflow) {
      throw new ApiError(400, "No active approval workflow matches this invoice.");
    }

    if (!workflow.steps.length) {
      throw new ApiError(400, "The selected approval workflow does not have any approval steps.");
    }

    const nextRound = Number(invoice.currentApprovalRound || 0) + 1;
    const firstStep = workflow.steps[0];

    await connection.query(
      `
        UPDATE invoices
        SET
          approval_workflow_id = ?,
          current_approval_round = ?,
          status = 'pending_approval',
          updated_by_user_id = ?
        WHERE invoice_id = ?
      `,
      [workflow.approvalWorkflowId, nextRound, actorUserId, invoiceId]
    );

    await insertApprovalAction(
      connection,
      invoiceId,
      firstStep.approvalStepId,
      nextRound,
      actorUserId,
      APPROVAL_ACTIONS.SUBMITTED,
      `Submitted into ${workflow.workflowName}`
    );

    if (invoice.status !== "pending_approval") {
      await insertStatusHistory(
        connection,
        invoiceId,
        invoice.status,
        "pending_approval",
        `Submitted for approval${nextRound > 1 ? ` (round ${nextRound})` : ""}`,
        actorUserId
      );

      await auditLogsModel.createInvoiceAuditLog(connection, {
        invoiceId,
        actorUserId,
        eventType: auditLogsModel.AUDIT_EVENT_TYPES.STATUS_CHANGED,
        actionLabel: "Changed invoice status",
        changedFields: [
          auditLogsModel.buildFieldChange("status", "Status", invoice.status, "pending_approval")
        ].filter(Boolean),
        metadata: {
          reason: `Submitted for approval${nextRound > 1 ? ` (round ${nextRound})` : ""}`
        }
      });
    }

    await auditLogsModel.createInvoiceAuditLog(connection, {
      invoiceId,
      actorUserId,
      eventType: auditLogsModel.AUDIT_EVENT_TYPES.APPROVAL_ACTION,
      actionLabel: "Submitted for approval",
      targetType: auditLogsModel.AUDIT_TARGET_TYPES.APPROVAL,
      targetId: firstStep.approvalStepId,
      metadata: {
        actionType: APPROVAL_ACTIONS.SUBMITTED,
        approvalRound: nextRound,
        workflowName: workflow.workflowName,
        workflowCode: workflow.workflowCode,
        stepName: firstStep.stepName
      }
    });

    await connection.commit();

    return {
      invoiceId,
      approvalWorkflowId: workflow.approvalWorkflowId,
      currentApprovalRound: nextRound
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function submitApprovalDecision(invoiceId, actionType, actionNotes, actorUserId, actorRoles = []) {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const invoice = await getInvoiceApprovalBase(connection, invoiceId, { lock: true });

    if (!invoice) {
      throw new ApiError(404, "Invoice not found.");
    }

    if (invoice.status !== "pending_approval") {
      throw new ApiError(400, "Only invoices pending approval can receive approval decisions.");
    }

    const approvalView = await buildInvoiceApproval(
      invoiceId,
      { userId: actorUserId, roles: actorRoles },
      connection
    );

    if (!approvalView?.workflow) {
      throw new ApiError(400, "This invoice is not linked to a valid approval workflow.");
    }

    if (!approvalView.currentStep) {
      throw new ApiError(400, "There is no active approval step for this invoice.");
    }

    if (!approvalView.canCurrentUserAct) {
      throw new ApiError(403, "You are not assigned to the active approval step for this invoice.");
    }

    await insertApprovalAction(
      connection,
      invoiceId,
      approvalView.currentStep.approvalStepId,
      approvalView.currentRound,
      actorUserId,
      actionType,
      actionNotes
    );

    let nextStatus = invoice.status;
    let changeReason = actionNotes || null;

    if (actionType === APPROVAL_ACTIONS.REJECT) {
      nextStatus = "rejected";
      changeReason = actionNotes || "Invoice rejected during approval.";
    } else if (actionType === APPROVAL_ACTIONS.SEND_BACK) {
      nextStatus = "sent_back";
      changeReason = actionNotes || "Invoice sent back for changes.";
    } else if (actionType === APPROVAL_ACTIONS.APPROVE) {
      const refreshedView = await buildInvoiceApproval(
        invoiceId,
        { userId: actorUserId, roles: actorRoles },
        connection
      );

      if (!refreshedView.currentStep) {
        nextStatus = "approved";
        changeReason = actionNotes || "Invoice fully approved.";
      }
    }

    if (nextStatus !== invoice.status) {
      await connection.query(
        `
          UPDATE invoices
          SET
            status = ?,
            updated_by_user_id = ?
          WHERE invoice_id = ?
        `,
        [nextStatus, actorUserId, invoiceId]
      );

      await insertStatusHistory(connection, invoiceId, invoice.status, nextStatus, changeReason, actorUserId);

      await auditLogsModel.createInvoiceAuditLog(connection, {
        invoiceId,
        actorUserId,
        eventType: auditLogsModel.AUDIT_EVENT_TYPES.STATUS_CHANGED,
        actionLabel: "Changed invoice status",
        changedFields: [
          auditLogsModel.buildFieldChange("status", "Status", invoice.status, nextStatus)
        ].filter(Boolean),
        metadata: {
          reason: changeReason
        }
      });
    }

    await auditLogsModel.createInvoiceAuditLog(connection, {
      invoiceId,
      actorUserId,
      eventType: auditLogsModel.AUDIT_EVENT_TYPES.APPROVAL_ACTION,
      actionLabel:
        actionType === APPROVAL_ACTIONS.APPROVE
          ? "Recorded approval"
          : actionType === APPROVAL_ACTIONS.REJECT
            ? "Rejected invoice"
            : "Sent invoice back",
      targetType: auditLogsModel.AUDIT_TARGET_TYPES.APPROVAL,
      targetId: approvalView.currentStep.approvalStepId,
      metadata: {
        actionType,
        actionNotes,
        approvalRound: approvalView.currentRound,
        stepName: approvalView.currentStep.stepName
      }
    });

    await connection.commit();

    return {
      invoiceId,
      status: nextStatus
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function getApprovalQueue(viewer) {
  const [rows] = await pool.query(
    `
      SELECT invoice_id AS invoiceId
      FROM invoices
      WHERE status = 'pending_approval'
      ORDER BY updated_at DESC, invoice_id DESC
    `
  );

  const approvalItems = await Promise.all(
    rows.map(async (row) => {
      const invoice = await getInvoiceApprovalBase(pool, row.invoiceId);
      const approval = await buildInvoiceApproval(row.invoiceId, viewer, pool);

      if (!invoice || !approval?.currentStep || !approval.canCurrentUserAct) {
        return null;
      }

      return {
        invoiceId: invoice.invoiceId,
        invoiceNumber: invoice.invoiceNumber,
        supplierName: invoice.supplierName,
        totalAmount: invoice.totalAmount === null ? null : Number(invoice.totalAmount),
        currency: invoice.currency,
        status: invoice.status,
        workflowName: approval.workflow?.workflowName || "Workflow",
        workflowCode: approval.workflow?.workflowCode || null,
        currentRound: approval.currentRound,
        currentStep: approval.currentStep,
        lastSubmittedAt: approval.lastSubmittedAt,
        lastSubmittedBy: approval.lastSubmittedBy
      };
    })
  );

  return approvalItems.filter(Boolean);
}

module.exports = {
  APPROVAL_ACTIONS,
  APPROVAL_MANAGED_STATUSES,
  buildInvoiceApproval,
  getApprovalQueue,
  listApprovalWorkflows,
  matchesStepApprover,
  submitApprovalDecision,
  submitInvoiceForApproval
};
