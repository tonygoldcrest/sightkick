import { ReactNode } from 'react';
import { Button, Divider, Switch } from 'antd';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faDrum,
  faFilePdf,
  faInfoCircle,
} from '@fortawesome/free-solid-svg-icons';
import { PLAYHEAD_STYLES, PlayheadStyle } from '../../types';
import { SettingLabel } from './SettingLabel';
import { Tooltip } from '../Tooltip';
import themedark from '../../theme';

interface Props {
  playheadStyle: PlayheadStyle;
  onPlayheadStyleChange: (style: PlayheadStyle) => void;
  enableColors: boolean;
  onEnableColorsChange: (value: boolean) => void;
  showBarNumbers: boolean;
  onShowBarNumbersChange: (value: boolean) => void;
  showReference: boolean;
  onShowReferenceChange: (value: boolean) => void;
  showTempo: boolean;
  onShowTempoChange: (value: boolean) => void;
  countIn: boolean;
  onCountInChange: (value: boolean) => void;
  isDev: boolean;
  onSetupInput: () => void;
  onExportPdf?: () => void;
  isExporting?: boolean;
  volumeSliders?: ReactNode[];
  currentInputName?: string;
}

export function SongViewSettings({
  playheadStyle,
  onPlayheadStyleChange,
  enableColors,
  onEnableColorsChange,
  showBarNumbers,
  onShowBarNumbersChange,
  showTempo,
  onShowTempoChange,
  showReference,
  onShowReferenceChange,
  countIn,
  onCountInChange,
  isDev,
  onSetupInput,
  onExportPdf,
  isExporting,
  volumeSliders,
  currentInputName,
}: Props) {
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
              onClick={() => onPlayheadStyleChange(s)}
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
          onChange={onEnableColorsChange}
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
              onChange={onShowBarNumbersChange}
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
        <Switch size="small" checked={showTempo} onChange={onShowTempoChange} />
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
              onChange={onShowReferenceChange}
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
        <Switch size="small" checked={countIn} onChange={onCountInChange} />
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
            {volumeSliders}
          </div>
        </>
      ) : null}
    </>
  );
}
