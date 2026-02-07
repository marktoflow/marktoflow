import { useSettingsStore } from '../../../stores/settingsStore';
import { SettingToggle } from '../controls/SettingToggle';
import { SettingNumber } from '../controls/SettingNumber';

export function CanvasSettings() {
  const { settings, updateSetting } = useSettingsStore();

  return (
    <div className="divide-y divide-border-default">
      <SettingToggle
        label="Show Grid"
        description="Display grid lines on the canvas background"
        checked={settings.canvas.showGrid}
        onChange={(v) => updateSetting('canvas', 'showGrid', v)}
      />
      <SettingToggle
        label="Snap to Grid"
        description="Nodes snap to grid positions when dragging"
        checked={settings.canvas.snapToGrid}
        onChange={(v) => updateSetting('canvas', 'snapToGrid', v)}
      />
      <SettingNumber
        label="Grid Size"
        description="Grid spacing in pixels"
        value={settings.canvas.gridSize}
        min={5}
        max={100}
        step={5}
        onChange={(v) => updateSetting('canvas', 'gridSize', v)}
      />
      <SettingToggle
        label="Show Minimap"
        description="Display minimap navigation in the corner"
        checked={settings.canvas.showMinimap}
        onChange={(v) => updateSetting('canvas', 'showMinimap', v)}
      />
      <SettingToggle
        label="Animate Edges"
        description="Show animated flow along connection edges"
        checked={settings.canvas.animateEdges}
        onChange={(v) => updateSetting('canvas', 'animateEdges', v)}
      />
    </div>
  );
}
