import { Router, Request, Response } from 'express';
import { getDatabase } from '../../db/database.ts';
import { workspaceAuth, requireUserType } from '../middleware/auth.ts';
import { CustomerRequest, AssistantSuggestion } from '../../src/types.ts';
import { parseRequestId } from '../utils/requestId.ts';
import { sendProblem } from '../utils/problem.ts';

const router = Router();
router.use(workspaceAuth, requireUserType('WORKPLACE'));

router.get('/requests/:requestId', (req: Request, res: Response) => {
  const db = getDatabase();
  const wsId = req.workspace!.id;
  const requestId = parseRequestId(req.params.requestId);

  if (requestId === null) {
    sendProblem(req, res, 422, 'INVALID_REQUEST_ID', 'Request ID must be a five-digit integer that does not start with 0.', { requestId: 'Use a five-digit integer that does not start with 0.' });
    return;
  }

  const request = db.prepare(
    'SELECT * FROM requests WHERE id = ? AND workspace_id = ?'
  ).get(requestId, wsId) as CustomerRequest | undefined;

  if (!request) {
    sendProblem(req, res, 404, 'NOT_FOUND', 'Request not found in this workspace.');
    return;
  }

  const suggestions: AssistantSuggestion[] = [];

  // Suggestion logic based on request state
  if (request.status === 'NEW') {
    const isDetailed = request.description.length > 30;
    const hasContact = Boolean(request.customer_id);

    if (isDetailed && hasContact) {
      suggestions.push({
        id: 'sug_qualify',
        type: 'QUALIFY_REQUEST',
        title: 'Ready for Qualification',
        reasoning: 'Customer contact information and technical failure description are complete. No blocking missing prerequisites detected.',
        suggestedActionLabel: 'Review & Qualify Request',
        targetStatus: 'QUALIFIED',
        confidence: 'HIGH'
      });
    }

    if (!request.preferred_date) {
      suggestions.push({
        id: 'sug_followup',
        type: 'SCHEDULE_FOLLOWUP',
        title: 'Customer Availability Clarification',
        reasoning: 'Customer did not specify a preferred service access date. Recommend confirming availability with the client.',
        suggestedActionLabel: 'Log Dispatch Followup Note',
        confidence: 'MEDIUM'
      });
    }
  } else if (request.status === 'QUALIFIED') {
    if (!request.work_item_id) {
      const defaultDate = request.preferred_date || new Date(Date.now() + 86400000 * 2).toISOString().split('T')[0];
      suggestions.push({
        id: 'sug_convert',
        type: 'CONVERT_TO_WORK_ITEM',
        title: 'Convert to Work Order',
        reasoning: `Request is fully qualified. Create official work order for field technician dispatch with proposed schedule date ${defaultDate}.`,
        suggestedActionLabel: 'Launch Work Order Conversion',
        suggestedScheduledDate: defaultDate,
        confidence: 'HIGH'
      });
    } else {
      suggestions.push({
        id: 'sug_monitoring',
        type: 'SCHEDULE_FOLLOWUP',
        title: 'Work Order Active',
        reasoning: 'This request has already been converted to an active work order. Track progress in the Work Items tab.',
        suggestedActionLabel: 'View Converted Work Order',
        confidence: 'HIGH'
      });
    }
  } else if (request.status === 'CLOSED') {
    suggestions.push({
      id: 'sug_closed',
      type: 'SCHEDULE_FOLLOWUP',
      title: 'Archived Record',
      reasoning: 'This request is closed. All logs and history remain read-only for audit compliance.',
      suggestedActionLabel: 'Reopen to New if Inquired Again',
      targetStatus: 'NEW',
      confidence: 'MEDIUM'
    });
  }

  res.json({
    data: {
      request_id: requestId,
      suggestions,
      rules_evaluated_count: 5,
      evaluated_at: new Date().toISOString()
    }
  });
});

export default router;
