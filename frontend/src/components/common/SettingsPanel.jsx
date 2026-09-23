const CHOICES = {
  theme: [['dark', '深色'], ['light', '浅色']],
  deck: [['fourColor', '四色牌'], ['twoColor', '双色牌']],
};

function ChoiceGroup({ label, name, value, options, onChange }) {
  return (
    <fieldset className="settings-group">
      <legend>{label}</legend>
      <div className="segmented-control">
        {options.map(([optionValue, optionLabel]) => (
          <label key={optionValue}>
            <input
              type="radio"
              name={name}
              value={optionValue}
              checked={value === optionValue}
              onChange={() => onChange(optionValue)}
            />
            <span>{optionLabel}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export function SettingsPanel({ preferences, onChange }) {
  const update = patch => onChange({ ...preferences, ...patch });
  return (
    <section className="settings-panel" aria-labelledby="settings-title">
      <div>
        <p className="settings-kicker">显示与声音</p>
        <h2 id="settings-title">设置</h2>
      </div>
      <ChoiceGroup label="界面主题" name="theme" value={preferences.theme} options={CHOICES.theme} onChange={theme => update({ theme })} />
      <ChoiceGroup label="牌面配色" name="deck" value={preferences.deck} options={CHOICES.deck} onChange={deck => update({ deck })} />
      <label className="settings-toggle">
        <span>静音</span>
        <input type="checkbox" checked={preferences.muted} onChange={event => update({ muted: event.target.checked })} />
      </label>
      <label className="settings-toggle">
        <span>减少动态效果</span>
        <input type="checkbox" checked={preferences.reducedMotion} onChange={event => update({ reducedMotion: event.target.checked })} />
      </label>
    </section>
  );
}
