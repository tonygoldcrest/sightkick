import { ReactNode, useEffect, useState } from 'react';
import { Button, Divider, InputNumber, Switch } from 'antd';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faDrum,
  faFilePdf,
  faInfoCircle,
} from '@fortawesome/free-solid-svg-icons';
import { PLAYHEAD_STYLES } from '../../types';
import { useSongViewSettings } from '../../context/SongViewSettingsContext';
import { SettingLabel } from './SettingLabel';
import { Tooltip } from '../Tooltip';
import themedark from '../../theme';

interface Props {
  onSetupInput: () => void;
  currentInputName?: string;
  onExportPdf?: () => void;
  isExporting?: boolean;
  volumeSliders?: ReactNode[];
  clickControls?: ReactNode;
  masterVolumeControl?: ReactNode;
}

export function SongViewSettings({
  onSetupInput,
  currentInputName,
  onExportPdf,
  isExporting,
  volumeSliders,
  clickControls,
  masterVolumeControl,
}: Props) {
  const {
    playheadStyle,
    setPlayheadStyle,
    enableColors,
    setEnableColors,
    showBarNumbers,
    setShowBarNumbers,
    showTempo,
    setShowTempo,
    showReference,
    setShowReference,
    countIn,
    setCountIn,
    zoom,
    setZoom,
  } = useSongViewSettings();
  const [isDev, setIsDev] = useState(false);

  useEffect(() => {
    window.electron.ipcRenderer.sendMessage('check-dev');
    window.electron.ipcRenderer.once('check-dev', (dev: boolean) => {
      setIsDev(dev);
    });
  }, []);

  return (
    <>
      <Tooltip
        title="Hook up your e-kit (or keyboard if you fancy) so we can score your hits"
        placement="bottom"
      >
        <Button
          className="grow"
          icon={<FontAwesomeIcon icon={faDrum} />}
          onClick={onSetupInput}
        >
          {currentInputName ?? 'Setup input'}
        </Button>
      </Tooltip>

      {onExportPdf && (
        <Tooltip
          title="Save the sheet music as a PDF you can print or share"
          placement="bottom"
        >
          <Button
            icon={<FontAwesomeIcon icon={faFilePdf} />}
            loading={isExporting}
            onClick={onExportPdf}
          >
            Export PDF
          </Button>
        </Tooltip>
      )}

      <Divider />

      <div className="flex flex-col gap-3">
        <SettingLabel
          label="Playhead style"
          tooltip="How you follow along: a cursor that glides through the notes, or just the current bar lit up."
        />

        <div className="flex gap-2">
          {PLAYHEAD_STYLES.map((s) => (
            <Button
              key={s}
              className="grow"
              type={playheadStyle === s ? 'primary' : 'default'}
              onClick={() => setPlayheadStyle(s)}
            >
              {s}
            </Button>
          ))}
        </div>
      </div>

      <Divider />

      <div className="flex items-center justify-between gap-3">
        <SettingLabel
          label="Enable colors"
          tooltip="Color-code each drum so you can tell them apart at a glance."
        />
        <Switch
          size="small"
          checked={enableColors}
          onChange={setEnableColors}
        />
      </div>
      {isDev && (
        <>
          <Divider />
          <div className="flex items-center justify-between gap-3">
            <SettingLabel
              label="Show bar numbers"
              tooltip="Slap a number on every bar so you can find your spot fast."
            />
            <Switch
              size="small"
              checked={showBarNumbers}
              onChange={setShowBarNumbers}
            />
          </div>
        </>
      )}

      <Divider />

      <div className="flex items-center justify-between gap-3">
        <SettingLabel
          label="Show tempo"
          tooltip="Write the BPM into the sheet wherever the tempo changes."
        />
        <Switch size="small" checked={showTempo} onChange={setShowTempo} />
      </div>

      <Divider />

      {enableColors && (
        <>
          <div className="flex items-center justify-between gap-3">
            <SettingLabel
              label="Show reference"
              tooltip="Pop a little cheat sheet at the bottom showing which color is which drum."
            />
            <Switch
              size="small"
              checked={showReference}
              onChange={setShowReference}
            />
          </div>

          <Divider />
        </>
      )}

      <div className="flex items-center justify-between gap-3">
        <SettingLabel
          label="Count-in"
          tooltip="A few clicks before the song starts so you're not caught off guard."
        />
        <Switch size="small" checked={countIn} onChange={setCountIn} />
      </div>

      <Divider />

      <div className="flex items-center justify-between gap-3">
        <SettingLabel label="Zoom" tooltip="Sheet music zoom" />
        <InputNumber
          mode="spinner"
          size="small"
          min={0.5}
          max={2}
          step={0.1}
          value={zoom}
          onChange={(newValue) => {
            if (newValue === null) {
              return;
            }

            setZoom(newValue);
          }}
          styles={{
            input: {
              width: '5ch',
            },
          }}
        />
      </div>

      {volumeSliders ? (
        <>
          <div className="flex items-center gap-3">
            <div
              className="grow h-px"
              style={{ background: 'var(--gradient-accent-fade-reverse)' }}
            />
            <div className="flex items-center gap-2">
              <div className="text-accent-text uppercase font-semibold text-[13px]">
                Mixer
              </div>

              <Tooltip
                title="Set how loud each track is. Mute the drums and play them yourself."
                placement="bottom"
              >
                <FontAwesomeIcon
                  icon={faInfoCircle}
                  color={themedark.color.accentText}
                />
              </Tooltip>
            </div>
            <div
              className="grow h-px"
              style={{ background: 'var(--gradient-accent-fade)' }}
            />
          </div>
          <div className="grid grid-cols-[max-content_1fr_max-content_max-content] items-center gap-x-2 gap-y-1">
            {masterVolumeControl}

            {volumeSliders}
          </div>
        </>
      ) : null}

      {clickControls}
    </>
  );
}
