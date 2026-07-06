import { Component, ErrorInfo, ReactNode } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faTriangleExclamation,
  faRotateRight,
  faUpRightFromSquare,
} from '@fortawesome/free-solid-svg-icons';

const DISCORD_URL = 'https://discord.gg/kwBx9VZt3';

interface Props {
  children: ReactNode;
}

interface State {
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = {};

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Uncaught error:', error, info.componentStack);
  }

  render() {
    const { error } = this.state;

    if (!error) {
      return this.props.children;
    }

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-bg p-6 text-text">
        <div className="flex max-w-lg flex-col items-center gap-5 text-center">
          <FontAwesomeIcon
            icon={faTriangleExclamation}
            className="text-5xl text-accent"
          />
          <div className="flex flex-col gap-2">
            <div className="font-display text-2xl">
              Oups! Something&apos;s gone terribly wrong.
            </div>
            <div className="text-sm text-text-faint">
              An unexpected error crashed the app. Sorry about that.
            </div>
          </div>
          <pre className="max-h-40 w-full overflow-auto whitespace-pre-wrap rounded-md border border-border bg-surface-sunken p-3 text-left text-xs text-text-muted select-text">
            {error.stack}
          </pre>
          <div className="text-sm text-text-faint">
            Please raise an issue with the dev team on our{' '}
            <button
              type="button"
              className="text-accent-text underline"
              onClick={() => window.open(DISCORD_URL)}
            >
              Discord
              <FontAwesomeIcon
                icon={faUpRightFromSquare}
                className="ml-1 text-[0.7em]"
              />
            </button>
            .
          </div>
          <button
            type="button"
            className="flex items-center gap-2 rounded-md border border-border bg-fill px-4 py-2 text-sm text-text-body hover:bg-fill-strong"
            onClick={() => window.location.reload()}
          >
            <FontAwesomeIcon icon={faRotateRight} />
            Reload
          </button>
        </div>
      </div>
    );
  }
}
