import { provideIcons } from './app/core/icons/icons';

// Providers every unit test gets (angular.json, test.options.providersFile): the app's icons, so components
// render them as they do in the app
export default [provideIcons()];
