import React from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { Trash2, AlertTriangle, X } from 'lucide-react-native';

export type ConfirmModalProps = {
  visible: boolean;
  title?: string;
  itemName?: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
  loading?: boolean;
  danger?: boolean;
  onConfirm: () => void;
  onClose: () => void;
};

export default function ConfirmModal({
  visible,
  title = 'Confirm Delete',
  itemName,
  message,
  confirmText = 'Delete',
  cancelText = 'Cancel',
  loading = false,
  danger = true,
  onConfirm,
  onClose,
}: ConfirmModalProps) {
  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;

  if (!visible) return null;

  const defaultMsg = itemName
    ? `Are you sure you want to delete "${itemName}"? This action cannot be undone.`
    : 'Are you sure you want to delete this item? This action cannot be undone.';

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={[styles.card, isDesktop && styles.cardDesktop]}>
          <Pressable style={styles.closeBtn} onPress={onClose}>
            <X size={18} color="#525C6B" />
          </Pressable>

          <View style={[styles.iconWrap, danger ? styles.iconWrapDanger : styles.iconWrapWarning]}>
            {danger ? <Trash2 size={24} color="#DC2626" /> : <AlertTriangle size={24} color="#D97706" />}
          </View>

          <Text style={styles.title}>{title}</Text>
          <Text style={styles.message}>{message || defaultMsg}</Text>

          <View style={styles.actions}>
            <Pressable style={styles.cancelBtn} onPress={onClose} disabled={loading}>
              <Text style={styles.cancelBtnText}>{cancelText}</Text>
            </Pressable>
            <Pressable
              style={[styles.confirmBtn, danger ? styles.confirmBtnDanger : styles.confirmBtnPrimary]}
              onPress={onConfirm}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  {danger && <Trash2 size={14} color="#fff" />}
                  <Text style={styles.confirmBtnText}>{confirmText}</Text>
                </>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 8,
    position: 'relative',
  },
  cardDesktop: {
    width: 420,
  },
  closeBtn: {
    position: 'absolute',
    top: 16,
    right: 16,
    padding: 6,
    borderRadius: 8,
  },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  iconWrapDanger: {
    backgroundColor: '#FEE2E2',
  },
  iconWrapWarning: {
    backgroundColor: '#FEF3C7',
  },
  title: {
    fontSize: 18,
    fontWeight: '900',
    color: '#0F172A',
    textAlign: 'center',
    marginBottom: 8,
  },
  message: {
    fontSize: 13,
    color: '#4B5768',
    textAlign: 'center',
    lineHeight: 19,
    marginBottom: 24,
    paddingHorizontal: 8,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#475569',
  },
  confirmBtn: {
    flex: 1,
    flexDirection: 'row',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  confirmBtnDanger: {
    backgroundColor: '#DC2626',
  },
  confirmBtnPrimary: {
    backgroundColor: '#2D5DC9',
  },
  confirmBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#ffffff',
  },
});
