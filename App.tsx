import { StatusBar } from 'expo-status-bar';
import { Provider } from 'react-redux';
import { PersistGate } from 'redux-persist/integration/react';
import { store, persistor } from '@/store';
import { AppNavigator } from '@/navigation/AppNavigator';
import { useEffect } from 'react';
import Toast from 'react-native-toast-notifications';
import NotificationsService from '@/services/notifications';
import ToastService from '@/services/toast';
import { ThemeProvider } from '@/contexts/ThemeContext';

export default function App() {
  useEffect(() => {
    // Initialize notification service on app start
    const initializeNotifications = async () => {
      try {
        await NotificationsService.setup();
        console.log('Notifications initialized successfully');
      } catch (error) {
        console.error('Error initializing notifications:', error);
      }
    };

    initializeNotifications();
  }, []);

  return (
    <Provider store={store}>
      <PersistGate loading={null} persistor={persistor}>
        <ThemeProvider>
          <AppNavigator />
          <Toast ref={(ref) => ToastService.setToastRef(ref)} />
          <StatusBar />
        </ThemeProvider>
      </PersistGate>
    </Provider>
  );
}
