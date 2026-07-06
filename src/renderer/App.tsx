import { MemoryRouter as Router, Routes, Route } from 'react-router-dom';
import { App as AntdApp, ConfigProvider } from 'antd';
import './App.css';
import { SongListView } from './views/SongListView';
import { SongView } from './views/SongView';
import { antdTheme } from './antdTheme';
import { AppProvider } from './context/AppContext';
import { InputProvider } from './context/InputContext';
import { SongViewSettingsProvider } from './context/SongViewSettingsContext';
import { useAppUpdate } from './hooks/useAppUpdate';
import { ErrorBoundary } from './components/ErrorBoundary';

function UpdateNotifier() {
  useAppUpdate();

  return undefined;
}

export default function App() {
  return (
    <ErrorBoundary>
      <ConfigProvider theme={antdTheme}>
        <AntdApp>
          <UpdateNotifier />
          <AppProvider>
            <InputProvider>
              <SongViewSettingsProvider>
                <Router>
                  <Routes>
                    <Route path="/" element={<SongListView />}>
                      <Route path=":id" element={<SongView />} />
                    </Route>
                  </Routes>
                </Router>
              </SongViewSettingsProvider>
            </InputProvider>
          </AppProvider>
        </AntdApp>
      </ConfigProvider>
    </ErrorBoundary>
  );
}
