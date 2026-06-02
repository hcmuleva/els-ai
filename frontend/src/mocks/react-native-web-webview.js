// Stub for react-native-web-webview used by react-native-youtube-iframe on web.
// On web, youtube-iframe renders via an <iframe>, not a WebView, so this is never actually called.
import React from 'react';
import { View } from 'react-native';
export const WebView = (props) => React.createElement(View, props);
export default WebView;
