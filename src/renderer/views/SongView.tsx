import { useCallback, useEffect, useMemo, useState } from 'react';
import { App, Button, Divider, InputNumber, Layout, Spin, Switch } from 'antd';
import { Content } from 'antd/es/layout/layout';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Playback } from '../components/Playback';
import { SettingsButton } from '../components/SettingsButton';
import { SheetMusic } from '../components/SheetMusic';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faArrowLeft,
  faPause,
  faPlay,
} from '@fortawesome/free-solid-svg-icons';
import { useApp } from '../context/AppContext';
import { useInput } from '../context/InputContext';
import { useSongViewSettings } from '../context/SongViewSettingsContext';
import { ClickControls } from '../components/ClickControls';
import { usePersisted } from '../hooks/usePersisted';
import { useSongLoader } from '../hooks/useSongLoader';
import { useEngine } from '../hooks/useEngine';
import { useVolumeControls } from '../hooks/useVolumeControls';
import { useMuteToggle } from '../hooks/useMuteToggle';
import { ticksToSeconds } from '../../chart-parser/timing';
import { calculateAccuracy } from '../scoring';
import { usePracticeSession } from '../hooks/usePracticeSession';
import { useSheetMusic } from '../hooks/useSheetMusic';
import { useInputControls } from '../hooks/useInputControls';
import { ScoreSummary } from '../components/ScoreSummary';
import { CountIn } from '../components/CountIn';
import { ScoreData } from '../../types';
import { buildSheetPdfHtml } from '../services/pdf-export';
import { serializeMeasureToDsl } from '../components/SheetMusic/drumDsl';
import { AudioVolume } from '../components/AudioVolume';
import { GameMode } from '../types';
import { resolveModePolicy } from '../modes';

export function SongView() {
  const { difficulty } = useApp();
  const { inputMapping, controlMapping, kitControlIds } = useInput();
  const {
    playheadStyle,
    enableColors,
    showBarNumbers,
    showTempo,
    countIn,
    showReference,
    zoom,
  } = useSongViewSettings();
  const { notification, message } = App.useApp();
  const [scoreData, setScoreData] = useState<ScoreData>();
  const [isScoreModalOpen, setIsScoreModalOpen] = useState(false);
  const [isDev, setIsDev] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const gameMode = useMemo<GameMode | undefined>(() => {
    return (searchParams.get('gameMode') as GameMode) ?? undefined;
  }, [searchParams]);
  const policy = useMemo(() => resolveModePolicy(gameMode), [gameMode]);
  const navigate = useNavigate();
  const { fileData, format, songData, trackData } = useSongLoader(id);
  const { chart, parsedMidi, renderData, vexflowContainerRef } = useSheetMusic({
    fileData,
    format,
    fiveLaneDrums: songData?.fiveLaneDrums ?? false,
    proDrums: songData?.proDrums ?? false,
    songId: songData?.id,
    difficulty,
    showBarNumbers: isDev && showBarNumbers,
    enableColors,
    showTempo,
  });
  const measures = useMemo(
    () => renderData.map((rd) => rd.measure),
    [renderData],
  );
  const delaySeconds = songData?.delaySeconds ?? 0;
  const minDurationSeconds = useMemo(() => {
    const measureList = parsedMidi?.measures;
    const lastMeasure = chart && measureList?.[measureList.length - 1];

    if (!lastMeasure) {
      return 0;
    }

    return (
      ticksToSeconds(lastMeasure.endTick, chart.resolution, chart.tempos) +
      delaySeconds
    );
  }, [chart, parsedMidi, delaySeconds]);
  const {
    engine,
    isReady,
    duration,
    timeStore,
    isPlaying,
    isCounting,
    isEnded,
    countInBeat,
    countInBeatMs,
    play,
    playFromTick,
    pause,
    cancel,
    seekSeconds,
    setStemVolume,
    setMasterVolume: setEngineMasterVolume,
  } = useEngine({
    trackData,
    isDev,
    chart,
    measures,
    renderData,
    delaySeconds,
    minDurationSeconds,
    countInEnabled: countIn,
    player: policy.player,
    playheadStyle: policy.playheadOverride ?? playheadStyle,
    mapping: inputMapping,
    onEnded: (score) => {
      if (!policy.scoring) {
        return;
      }

      setScoreData(score);
      setIsScoreModalOpen(true);

      const previousScore = songData?.scoreData?.[difficulty];
      const isHighScore =
        !previousScore ||
        calculateAccuracy(score) > calculateAccuracy(previousScore);
      const isAttempt = (score.hitNotes ?? 0) > 0;

      if (id && isHighScore && isAttempt) {
        window.electron.ipcRenderer.sendMessage('update-song', {
          id,
          scoreData: { [difficulty]: score },
        });
      }
    },
  });
  const { volumeSliders } = useVolumeControls(
    trackData,
    setStemVolume,
    isReady,
  );
  const [clickVolume, setClickVolume] = usePersisted('settings.clickVolume', 0);
  const [clickTone, setClickTone] = usePersisted('settings.clickTone', 50);
  const [masterVolume, setMasterVolume] = usePersisted(
    'settings.masterVolume',
    100,
  );
  const {
    isMuted: isMasterMuted,
    toggleMute: handleMasterMute,
    handleChange: handleMasterChange,
  } = useMuteToggle(masterVolume, setMasterVolume, 100);
  const audioLoading = trackData.length > 0 && !isReady;
  const isLoading = !songData || audioLoading;
  const onNextSong = () => {
    setIsScoreModalOpen(false);
    navigate('/');
  };
  const onRetry = () => {
    setIsScoreModalOpen(false);
    playFromTick(0);
  };
  const onExportPdf = useCallback(() => {
    if (!vexflowContainerRef.current || !songData) {
      return;
    }

    const html = buildSheetPdfHtml({
      name: songData.name,
      artist: songData.artist,
      charter: songData.charter,
      vexflowContainer: vexflowContainerRef.current,
    });
    const fileName = `${songData.name} - ${songData.artist}.pdf`.replace(
      /[/\\:*?"<>|]/g,
      '-',
    );

    setIsExporting(true);
    window.electron.ipcRenderer.once<{
      ok?: boolean;
      canceled?: boolean;
      filePath?: string;
      error?: string;
    }>('export-pdf', (result) => {
      setIsExporting(false);

      if (result.error) {
        notification.error({
          message: 'Export failed',
          description: result.error,
          placement: 'bottomRight',
        });

        return;
      }

      if (result.ok) {
        notification.success({
          message: 'PDF exported',
          description: result.filePath,
          placement: 'bottomRight',
        });
      }
    });
    window.electron.ipcRenderer.sendMessage('export-pdf', { html, fileName });
  }, [vexflowContainerRef, songData, notification]);
  const {
    controlHandlers: practiceControlHandlers,
    focusIndex,
    practiceRange,
    playbackSpeed,
    setPlaybackSpeed,
    isLooping,
    setIsLooping,
    onPracticeRangeChange,
    clearSelection,
  } = usePracticeSession({
    engine,
    policy,
    chart,
    renderData,
    delaySeconds,
    isEnded,
    onExit: () => navigate('/'),
  });

  useInputControls(
    controlMapping,
    policy.scoring
      ? {
          confirm: () => {
            if (isReady && !isPlaying && !isEnded && !isCounting) {
              play();

              return;
            }

            if (isEnded && isScoreModalOpen) {
              onNextSong();
            }
          },
          pause: () => {
            if (isCounting) {
              cancel();

              return;
            }

            if (!isEnded && isPlaying) {
              pause();
            }
          },
          back: () => {
            if (isEnded && isScoreModalOpen) {
              onRetry();

              return;
            }

            cancel();
            pause();
            navigate('/');
          },
        }
      : practiceControlHandlers,
    !isLoading,
    isPlaying || isCounting ? kitControlIds : undefined,
  );

  useEffect(() => {
    window.electron.ipcRenderer.sendMessage('prevent-sleep');

    return () => {
      window.electron.ipcRenderer.sendMessage('resume-sleep');
    };
  }, []);

  useEffect(() => {
    window.electron.ipcRenderer.sendMessage('check-dev');
    window.electron.ipcRenderer.once('check-dev', (dev: boolean) => {
      setIsDev(dev);
    });
  }, []);

  useEffect(() => {
    engine?.setClickSettings(clickVolume / 100, clickTone / 100);
  }, [engine, clickVolume, clickTone]);

  useEffect(() => {
    if (isReady) {
      setEngineMasterVolume(masterVolume / 100);
    }
  }, [setEngineMasterVolume, masterVolume, isReady]);

  return (
    <Layout className="h-full pointer-events-auto">
      <ScoreSummary
        isOpen={isScoreModalOpen}
        onNextSong={onNextSong}
        onRetry={onRetry}
        songData={songData}
        difficulty={difficulty}
        scoreData={scoreData}
      />
      <div
        className="flex items-center p-4 gap-5"
        style={{ background: 'var(--gradient-header)' }}
      >
        <Button
          icon={<FontAwesomeIcon icon={faArrowLeft} />}
          data-testid="back-button"
          onClick={() => {
            cancel();
            pause();
            navigate('/');
          }}
          size="large"
        />

        <Button
          type="primary"
          icon={<FontAwesomeIcon icon={isPlaying ? faPause : faPlay} />}
          loading={audioLoading}
          data-testid="play-toggle"
          onClick={() => {
            if (isCounting) {
              cancel();

              return;
            }

            if (isPlaying) {
              pause();

              return;
            }

            play();
          }}
          shape="circle"
          size="large"
          style={{ width: 50, height: 50 }}
        />

        <div>
          <div className="text-text-body font-ui text-[18px]">
            {songData?.name}
          </div>
          <div className="text-text-faint flex items-center gap-1">
            <div>{songData?.artist}</div>
            <div>·</div>
            <div className="capitalize">{difficulty}</div>
          </div>
        </div>

        <Playback
          timeStore={timeStore}
          disabled={!isReady}
          duration={duration}
          allowScrubbing={isDev || policy.allowScrubbing}
          onChange={(value) => {
            if (!isReady) {
              return;
            }

            seekSeconds((value / 100) * duration);
          }}
        />
        {(policy.speedControl || policy.looping) && (
          <div className="flex items-center gap-2">
            {policy.speedControl && (
              <div className="flex gap-2 items-center">
                <div className="text-text-faint">Speed:</div>

                <InputNumber
                  mode="spinner"
                  size="medium"
                  min={0.3}
                  max={2}
                  step={0.1}
                  value={playbackSpeed}
                  onChange={(newValue) => {
                    if (newValue === null) {
                      return;
                    }

                    setPlaybackSpeed(newValue);
                  }}
                  styles={{
                    input: {
                      width: '5ch',
                    },
                  }}
                />
              </div>
            )}

            {policy.speedControl && policy.looping && <Divider vertical />}

            {policy.looping && (
              <div className="flex gap-2 items-center">
                <div className="text-text-faint">Loop:</div>

                <Switch
                  size="medium"
                  checked={isLooping}
                  onChange={(checked) => {
                    setIsLooping(checked);
                    clearSelection();
                  }}
                />
              </div>
            )}
          </div>
        )}
        <SettingsButton
          page="song-view"
          volumeSliders={volumeSliders}
          gameMode={gameMode}
          clickControls={
            <ClickControls
              volume={clickVolume}
              onVolumeChange={setClickVolume}
              tone={clickTone}
              onToneChange={setClickTone}
            />
          }
          masterVolumeControl={
            <AudioVolume
              name="Master"
              volume={masterVolume}
              onChange={handleMasterChange}
              canSolo={false}
              onMuteClick={handleMasterMute}
              isMuted={isMasterMuted}
            />
          }
          onExportPdf={onExportPdf}
          isExporting={isExporting}
        />
      </div>

      <div className="relative grow flex min-h-0">
        <Content className="grow p-6 m-0 overflow-auto flex flex-col items-center font-display text-ink">
          {songData && chart && parsedMidi && (
            <SheetMusic
              engine={engine}
              isLooping={isLooping}
              renderData={renderData}
              practiceRange={practiceRange}
              focusIndex={focusIndex}
              onPracticeRangeChange={onPracticeRangeChange}
              gameMode={gameMode}
              songData={songData}
              isDev={isDev}
              zoom={zoom}
              enableColors={enableColors}
              showReference={showReference}
              vexflowContainerRef={vexflowContainerRef}
              onSelectMeasure={(measure, event) => {
                if ((event.ctrlKey || event.metaKey) && chart) {
                  navigator.clipboard.writeText(
                    serializeMeasureToDsl(chart, measure),
                  );
                  message.success('Measure DSL copied');

                  return;
                } else if (
                  (isDev || (policy.allowScrubbing && !isLooping)) &&
                  chart
                ) {
                  playFromTick(measure.startTick);
                }
              }}
            />
          )}
        </Content>
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/70 z-10 backdrop-blur-xs">
            <Spin size="large" />
          </div>
        )}
        <CountIn count={countInBeat} beatMs={countInBeatMs} />
      </div>
    </Layout>
  );
}
