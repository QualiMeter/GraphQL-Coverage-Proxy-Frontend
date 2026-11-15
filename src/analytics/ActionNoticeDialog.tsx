import {useEffect, useRef} from 'react';

export function ActionNoticeDialog({title, message, onClose}: {title: string; message: string; onClose: () => void}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (!dialog.current?.open) dialog.current?.showModal();
  }, []);

  function close() {
    dialog.current?.close();
    onClose();
  }

  return (
    <dialog ref={dialog} className="create-service-dialog snapshot-dialog" aria-labelledby="action-notice-title"
      onCancel={event => {event.preventDefault(); close()}}
      onClick={event => {if (event.target === event.currentTarget) close()}}>
      <div className="snapshot-dialog-content">
        <h2 id="action-notice-title">{title}</h2>
        <p>{message}</p>
        <div className="create-service-actions">
          <button type="button" autoFocus onClick={close}>Закрыть</button>
        </div>
      </div>
    </dialog>
  );
}
