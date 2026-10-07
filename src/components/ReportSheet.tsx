import React, { useEffect, useState } from 'react';
import { Banner, Button, Chip, Row, Sheet, TextField } from './ui';
import { useLanguage } from '../contexts/LanguageContext';
import { useToast } from '../contexts/ToastContext';
import { REPORT_REASONS, ReportReason, ReportTarget, submitReport } from '../api/reports';
import { errorKey } from '../lib/errors';

export function ReportSheet({ visible, onClose, targetType, targetId }: { visible: boolean; onClose: () => void; targetType: ReportTarget; targetId: string | null }) {
  const { t } = useLanguage();
  const toast = useToast();
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [details, setDetails] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { if (visible) { setReason(null); setDetails(''); setError(null); } }, [visible]);

  const send = async () => {
    if (!reason || !targetId) return;
    setBusy(true); setError(null);
    try { await submitReport(targetType, targetId, reason, details); toast.show(t('report.sent'), 'success'); onClose(); }
    catch (e) { setError(t(errorKey(e))); }
    finally { setBusy(false); }
  };

  return (
    <Sheet visible={visible} onClose={onClose} title={t('report.title')}>
      {error ? <Banner kind="error" text={error} /> : null}
      <Row style={{ flexWrap: 'wrap' }}>{REPORT_REASONS.map(r => <Chip key={r} label={t(`report.reason.${r}` as never)} selected={reason === r} onPress={() => setReason(r)} />)}</Row>
      <TextField value={details} onChangeText={setDetails} multiline maxLength={1000} placeholder={t('report.details')} />
      <Button title={t('report.send')} variant="danger" disabled={!reason} loading={busy} onPress={send} />
    </Sheet>
  );
}
