import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  renderStatutoryConfirmation,
  processStatutoryMailQueueItem,
  type StatutoryMailJob,
  type StatutoryMailRenderResult,
} from '../../src/server/platform/statutoryMailEngine.js';

describe('Statutory Mail Dispatch Engine (§ 312k Abs. 4 BGB & § 356a BGB)', () => {
  const MOCK_TIMESTAMP = '2026-09-25T14:00:00.000Z';
  const MOCK_PAID_UNTIL = '2026-10-25T14:00:00.000Z';

  it('renders § 312k Abs. 4 BGB cancellation confirmation with mandatory statutory disclosures', () => {
    // Arrange
    const job: StatutoryMailJob = {
      id: 'job-kuendigung-1',
      uid: 'user-kuendigung-123',
      template: 'kuendigung_bestaetigung',
      status: 'offen',
      createdAt: MOCK_TIMESTAMP,
      payload: {
        paidUntil: MOCK_PAID_UNTIL,
        plan: 'plus',
      },
    };

    // Act
    const rendered: StatutoryMailRenderResult = renderStatutoryConfirmation(job);

    // Assert
    assert.match(rendered.subject, /Kündigungsbestätigung/);
    assert.match(rendered.text, /§ 312k/);
    assert.match(rendered.text, /Zugang der Kündigung:/);
    assert.match(rendered.text, /Vertragsende:/);
    assert.match(rendered.text, /user-kuendigung-123/);
    assert.match(rendered.html, /Kündigungsbestätigung/);
    assert.match(rendered.html, /2026/);
  });

  it('renders § 356a BGB withdrawal confirmation with 14-day statutory refund notice', () => {
    // Arrange
    const job: StatutoryMailJob = {
      id: 'job-widerruf-1',
      uid: 'user-widerruf-456',
      template: 'widerruf_bestaetigung',
      status: 'offen',
      createdAt: MOCK_TIMESTAMP,
      payload: {
        plan: 'plus',
        refundStatus: 'offen',
      },
    };

    // Act
    const rendered: StatutoryMailRenderResult = renderStatutoryConfirmation(job);

    // Assert
    assert.match(rendered.subject, /Bestätigung Ihres Widerrufs/);
    assert.match(rendered.text, /§ 356a/);
    assert.match(rendered.text, /§ 357 Abs\. 1 BGB/);
    assert.match(rendered.text, /14 Tagen/);
    assert.match(rendered.html, /Widerruf/);
  });

  it('processStatutoryMailQueueItem successfully processes queue item and writes immutable dispatch digest', async () => {
    // Arrange
    const job: StatutoryMailJob = {
      id: 'job-kuendigung-exec',
      uid: 'user-exec-789',
      template: 'kuendigung_bestaetigung',
      status: 'offen',
      createdAt: MOCK_TIMESTAMP,
      payload: {
        paidUntil: MOCK_PAID_UNTIL,
      },
    };

    let sentEmailTo = '';
    let sentSubject = '';
    let dbUpdated = false;
    let recordedDigest = '';

    const mockResolveEmail = async (uid: string) => {
      assert.equal(uid, 'user-exec-789');
      return 'verbraucher@example.de';
    };

    const mockSendEmail = async (msg: { to: string; subject: string; text: string; html: string }) => {
      sentEmailTo = msg.to;
      sentSubject = msg.subject;
      return { messageId: 'msg-mock-123' };
    };

    const mockUpdateStatus = async (
      jobId: string,
      statusData: { status: string; dispatchedAt: number; dispatchDigest: string; providerMessageId?: string }
    ) => {
      assert.equal(jobId, 'job-kuendigung-exec');
      assert.equal(statusData.status, 'erledigt');
      assert.ok(statusData.dispatchedAt > 0);
      assert.match(statusData.dispatchDigest, /^[a-f0-9]{64}$/);
      dbUpdated = true;
      recordedDigest = statusData.dispatchDigest;
    };

    // Act
    const result = await processStatutoryMailQueueItem(
      job,
      mockResolveEmail,
      mockSendEmail,
      mockUpdateStatus
    );

    // Assert
    assert.equal(result.success, true);
    assert.equal(sentEmailTo, 'verbraucher@example.de');
    assert.match(sentSubject, /Kündigungsbestätigung/);
    assert.equal(dbUpdated, true);
    assert.equal(result.dispatchDigest, recordedDigest);
  });

  it('processStatutoryMailQueueItem fails gracefully when email is not found without leaking PII', async () => {
    // Arrange
    const job: StatutoryMailJob = {
      id: 'job-missing-email',
      uid: 'user-missing',
      template: 'kuendigung_bestaetigung',
      status: 'offen',
      createdAt: MOCK_TIMESTAMP,
    };

    let errorRecorded = false;

    // Act
    const result = await processStatutoryMailQueueItem(
      job,
      async () => null, // No email found
      async () => ({ messageId: 'none' }),
      async (_jobId, data) => {
        if (data.status === 'error') {
          errorRecorded = true;
        }
      }
    );

    // Assert
    assert.equal(result.success, false);
    assert.match(result.error || '', /E-Mail-Adresse nicht ermittelbar/);
    assert.equal(errorRecorded, true);
  });
});
