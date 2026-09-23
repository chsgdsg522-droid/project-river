const BOT_PERSONAS = Object.freeze([
  ['songguo', '松果'],
  ['yanshu', '岩叔'],
  ['xiaoman', '小满'],
  ['ace', '阿策'],
  ['youyou', '悠悠'],
]);

export function HostControls({ room, onAddBot, onStart }) {
  const participants = room.seats.filter(seat => seat.kind !== null);
  const available = BOT_PERSONAS.filter(([id]) => !room.seats.some(seat => seat.personaId === id));
  const emptySeats = room.seats.some(seat => seat.kind === null);
  const canStart = participants.length >= 2;
  return (
    <section className="host-controls" aria-labelledby="host-controls-title">
      <div>
        <h2 id="host-controls-title">房主设置</h2>
        <p>电脑玩家会立即入座，开局后阵容将锁定。</p>
      </div>
      {emptySeats && available.length > 0 && (
        <label className="bot-picker">
          <span>添加电脑玩家</span>
          <select defaultValue="" onChange={event => {
            if (event.target.value) onAddBot(event.target.value);
            event.target.value = '';
          }}>
            <option value="" disabled>选择风格</option>
            {available.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
          </select>
        </label>
      )}
      <div className="start-control">
        <button type="button" className="primary-button" disabled={!canStart} onClick={onStart}>开始牌局</button>
        {!canStart && <p>至少需要两名参与者</p>}
      </div>
    </section>
  );
}
