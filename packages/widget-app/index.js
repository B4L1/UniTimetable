import { registerRootComponent } from 'expo';
import { registerWidgetTaskHandler } from 'react-native-android-widget';

import App from './App';
import { widgetTaskHandler } from './widget-task-handler';

// Register the widget task
registerWidgetTaskHandler(widgetTaskHandler);

// Register the main app
registerRootComponent(App);
