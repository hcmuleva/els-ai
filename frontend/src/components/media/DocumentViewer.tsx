import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Linking } from 'react-native';
import { WebView } from 'react-native-webview';
import { Download, ExternalLink, FileText } from 'lucide-react-native';

type Props = {
  uri: string;
  title?: string;
  accentColor?: string;
  bgColor?: string;
};

function getDocEmoji(uri: string): string {
  const u = uri.toLowerCase();
  if (u.endsWith('.pdf'))                    return '📄';
  if (u.match(/\.(doc|docx)/))              return '📝';
  if (u.match(/\.(xls|xlsx)/))              return '📊';
  if (u.match(/\.(ppt|pptx)/))              return '📑';
  if (u.match(/\.(zip|rar|7z)/))            return '🗜️';
  return '📎';
}

function getDocLabel(uri: string): string {
  const u = uri.toLowerCase();
  if (u.endsWith('.pdf'))             return 'PDF Document';
  if (u.match(/\.(doc|docx)/))       return 'Word Document';
  if (u.match(/\.(xls|xlsx)/))       return 'Spreadsheet';
  if (u.match(/\.(ppt|pptx)/))       return 'Presentation';
  if (u.match(/\.(zip|rar|7z)/))     return 'Archive';
  return 'Document';
}

function isPdf(uri: string) {
  return uri.toLowerCase().endsWith('.pdf');
}

export default function DocumentViewer({ uri, title, accentColor = '#4A90E2', bgColor = '#D6EAFF' }: Props) {
  const emoji    = getDocEmoji(uri);
  const docLabel = getDocLabel(uri);
  const canPreview = isPdf(uri);

  // Google Docs viewer for PDF preview on mobile
  const previewUrl = `https://docs.google.com/gview?embedded=true&url=${encodeURIComponent(uri)}`;

  const openExternal = () => Linking.openURL(uri).catch(() => {});

  return (
    <View style={dv.wrap}>
      {/* Info card */}
      <View style={[dv.infoCard, { backgroundColor: bgColor }]}>
        <View style={[dv.iconBox, { backgroundColor: `${accentColor}20` }]}>
          <Text style={dv.iconEmoji}>{emoji}</Text>
        </View>
        <View style={dv.infoText}>
          <Text style={dv.docLabel}>{docLabel}</Text>
          <Text style={dv.docTitle} numberOfLines={2}>{title || uri.split('/').pop() || 'Document'}</Text>
        </View>
      </View>

      {/* Action buttons */}
      <View style={dv.actions}>
        <Pressable
          style={[dv.actionBtn, { backgroundColor: accentColor }]}
          onPress={openExternal}
        >
          <Download size={16} color="#fff" strokeWidth={2.5} />
          <Text style={dv.actionBtnTxt}>Download</Text>
        </Pressable>
        <Pressable
          style={[dv.actionBtnOutline, { borderColor: accentColor }]}
          onPress={openExternal}
        >
          <ExternalLink size={16} color={accentColor} strokeWidth={2.5} />
          <Text style={[dv.actionBtnOutlineTxt, { color: accentColor }]}>Open</Text>
        </Pressable>
      </View>

      {/* Inline PDF preview */}
      {canPreview && Platform.OS !== 'web' && (
        <View style={dv.previewWrap}>
          <View style={dv.previewHeader}>
            <FileText size={14} color={accentColor} />
            <Text style={[dv.previewHeaderTxt, { color: accentColor }]}>Preview</Text>
          </View>
          <WebView
            source={{ uri: previewUrl }}
            style={dv.webview}
            startInLoadingState
            renderLoading={() => (
              <View style={dv.previewLoading}>
                <Text style={dv.previewLoadingTxt}>Loading preview…</Text>
              </View>
            )}
          />
        </View>
      )}

      {canPreview && Platform.OS === 'web' && (
        <View style={dv.previewWrap}>
          <View style={dv.previewHeader}>
            <FileText size={14} color={accentColor} />
            <Text style={[dv.previewHeaderTxt, { color: accentColor }]}>Preview</Text>
          </View>
          <iframe
            src={previewUrl}
            style={{ width: '100%', height: 400, border: 'none', borderRadius: 12 }}
            title={title || 'Document Preview'}
          />
        </View>
      )}
    </View>
  );
}

const dv = StyleSheet.create({
  wrap: { gap: 12 },

  infoCard: {
    borderRadius: 20, padding: 16,
    flexDirection: 'row', alignItems: 'center', gap: 14,
  },
  iconBox:   { width: 56, height: 56, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  iconEmoji: { fontSize: 30 },
  infoText:  { flex: 1 },
  docLabel:  { fontSize: 11, fontWeight: '700', color: '#9A9AB0', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 3 },
  docTitle:  { fontSize: 15, fontWeight: '800', color: '#1a1a2e', lineHeight: 21 },

  actions: { flexDirection: 'row', gap: 10 },
  actionBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7,
    borderRadius: 14, paddingVertical: 13,
  },
  actionBtnTxt: { fontSize: 14, fontWeight: '800', color: '#fff' },
  actionBtnOutline: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7,
    borderRadius: 14, paddingVertical: 13,
    borderWidth: 1.5, backgroundColor: '#FFFFFF',
  },
  actionBtnOutlineTxt: { fontSize: 14, fontWeight: '800' },

  previewWrap: { gap: 8 },
  previewHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  previewHeaderTxt: { fontSize: 12, fontWeight: '700' },
  webview: { height: 400, borderRadius: 16, overflow: 'hidden' },
  previewLoading: { height: 400, alignItems: 'center', justifyContent: 'center' },
  previewLoadingTxt: { fontSize: 13, color: '#9A9AB0' },
});
