import { useState } from 'react';

async function fallbackCopy(value) {
  const input = document.createElement('textarea');
  input.value = value;
  input.setAttribute('readonly', '');
  input.style.position = 'fixed';
  input.style.opacity = '0';
  document.body.appendChild(input);
  input.select();
  const copied = document.execCommand?.('copy') === true;
  input.remove();
  return copied;
}

export async function copyText(value, clipboard = globalThis.navigator?.clipboard) {
  if (clipboard?.writeText) {
    await clipboard.writeText(value);
    return true;
  }
  return fallbackCopy(value);
}

export function InvitePanel({ code, clipboard }) {
  const [copied, setCopied] = useState('');
  const inviteUrl = `${window.location.origin}/room/${code}`;

  async function copy(value, type) {
    const success = await copyText(value, clipboard);
    setCopied(success ? type : 'error');
  }

  return (
    <section className="invite-panel" aria-labelledby="invite-title">
      <div>
        <p>房间码</p>
        <h2 id="invite-title" data-testid="room-code">{code}</h2>
      </div>
      <div className="invite-actions">
        <button type="button" onClick={() => copy(code, 'code')}>复制房间码</button>
        <button type="button" onClick={() => copy(inviteUrl, 'link')}>复制邀请链接</button>
      </div>
      <p className="copy-status" aria-live="polite">
        {copied === 'code' ? '房间码已复制' : copied === 'link' ? '邀请链接已复制' : copied === 'error' ? '复制失败，请手动复制' : ''}
      </p>
    </section>
  );
}
