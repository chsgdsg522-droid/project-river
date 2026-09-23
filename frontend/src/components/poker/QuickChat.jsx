const MESSAGES = Object.freeze([
  ['hello', '你好'],
  ['nice-hand', '好牌'],
  ['good-luck', '祝好运'],
  ['thinking', '思考中'],
  ['wow', '哇'],
  ['oops', '失误了'],
  ['thanks', '谢谢'],
  ['well-played', '打得好'],
  ['laugh', '哈哈'],
  ['clap', '鼓掌'],
  ['fire', '火热'],
  ['wave', '挥手'],
]);

export const QUICK_CHAT_LABELS = Object.freeze(Object.fromEntries(MESSAGES));

export function QuickChat({ onSend, disabled = false }) {
  return (
    <section className="quick-chat" aria-label="快捷聊天">
      <p>快捷消息 Quick chat</p>
      <div>
        {MESSAGES.map(([id, label]) => (
          <button key={id} type="button" disabled={disabled} aria-label={`快捷消息 ${label}`} onClick={() => onSend(id)}>{label}</button>
        ))}
      </div>
    </section>
  );
}
