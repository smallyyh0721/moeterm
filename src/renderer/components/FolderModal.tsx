import { useState } from 'react';
import { Modal } from './Modal';

export function FolderModal({
  mode,
  initialName,
  onClose,
  onSubmit,
}: {
  mode: 'create' | 'rename';
  initialName?: string;
  onClose: () => void;
  onSubmit: (name: string) => Promise<void>;
}) {
  const [name, setName] = useState(initialName ?? '');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  return (
    <Modal title={mode === 'create' ? '新建目录' : '重命名'} onClose={onClose}>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          setBusy(true);
          void onSubmit(name).then(
            () => undefined,
            (reason: unknown) => {
              setBusy(false);
              setError(reason instanceof Error ? reason.message : '没有保存成功');
            },
          );
        }}
      >
        <div className="modal-body">
          <label className="field">
            <span>名称</span>
            <input autoFocus value={name} onChange={(event) => setName(event.target.value)} />
          </label>
          {error ? <p className="form-error">{error}</p> : null}
        </div>
        <div className="modal-actions">
          <button type="button" className="btn" onClick={onClose}>
            取消
          </button>
          <button type="submit" className="btn primary" disabled={busy}>
            保存
          </button>
        </div>
      </form>
    </Modal>
  );
}
